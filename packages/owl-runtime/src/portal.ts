import { Signal } from "@odoo/owl-core";
import { Component } from "./component";
import { ComponentNode } from "./component_node";
import { useEffect } from "./hooks";
import { onWillDestroy } from "./lifecycle_hooks";
import { useProps } from "./props";
import { forwardErrorToParent } from "./rendering/error_handling";
import { xml } from "./template_set";
import { types as t } from "./types";

// Inner sub-root that simply renders the consumer's default slot. Module-level
// so its template is compiled once and shared across all Portal instances.
class PortalContent extends Component {
  static template = xml`<t t-call-slot="default"/>`;
}

export type PortalTarget = string | HTMLElement | Signal<HTMLElement | null> | null | undefined;

export class Portal extends Component {
  static template = xml``;

  props = useProps({
    slots: t.object(["default"]),
    target: t.or([t.string(), t.signal(t.instanceOf(HTMLElement)), t.instanceOf(HTMLElement)]),
    // Opt in to keeping this portal's content ordered relative to the other
    // ordered portals sharing the same target. Off by default: appending is
    // both cheaper and the semantics most portals want (dialogs, popovers and
    // tooltips stack in the order they open, not in the order they are
    // declared). See OrderedPortals below.
    ordered: t.boolean().optional(false),
  });

  setup() {
    const portalNode = this.__owl__;
    const app = portalNode.app;
    const slots = this.props.slots;
    let root: ReturnType<typeof app.createRoot> | null = null;

    const tearDown = () => {
      if (root) {
        root.destroy();
        root = null;
      }
    };

    useEffect(() => {
      const target = resolveTarget(this.props.target);
      if (!target) {
        return;
      }

      root = app.createRoot(PortalContent, {
        props: { slots },
        // Forward the plugin chain from this Portal (createRoot defaults
        // sub-roots to the app-level plugin manager) so `providePlugins`
        // contributions from ancestors are visible inside the portaled content.
        pluginManager: portalNode.pluginManager,
        // Route errors from the portaled subtree back through Portal's parent
        // chain so consumer `onError` handlers still catch them. Without this,
        // sub-root errors would propagate to app._handleError and tear down
        // the whole app.
        onError: forwardErrorToParent(portalNode),
        // Let the scheduler see through the sub-root boundary, so renders of
        // the portaled content yield to in-flight ancestor renders (e.g. a
        // t-if about to remove this Portal).
        host: portalNode,
      } as any);

      root.mount(target);

      if (!this.props.ordered) {
        return tearDown;
      }
      const group = OrderedPortals.get(target);
      const entry: OrderedEntry = { portalNode, contentNode: null };
      group.add(entry);
      // `Root` does not expose its node, so take it from the mounted instance.
      // The promise settles in a microtask (before paint) unless the content
      // has a pending `onWillStart`, and stays pending on a destroyed root.
      root.promise.then((component: PortalContent) => {
        if (group.entries.has(entry)) {
          entry.contentNode = component.__owl__;
          group.place();
        }
      }, () => {});
      return () => {
        group.delete(entry);
        tearDown();
      };
    });

    onWillDestroy(tearDown);
  }
}

function resolveTarget(target: PortalTarget): HTMLElement | null {
  if (typeof target === "function") {
    target = (target as () => HTMLElement | null)();
  }
  if (typeof target === "string") {
    return document.querySelector<HTMLElement>(target);
  }
  if (target instanceof HTMLElement) {
    return target;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Ordered portals
// -----------------------------------------------------------------------------

interface OrderedEntry {
  // The Portal itself, left in place in the source tree. Its bdom is a single
  // empty text node (`Portal.template` is empty), which owl keeps where the
  // Portal was declared and moves along with it — including when a keyed
  // t-foreach reorders its items. That node is the only thing that knows the
  // order the author wrote, so it is what we sort on.
  portalNode: ComponentNode;
  // The sub-root holding the portaled content, which is what we move. Null
  // until that sub-root has mounted.
  contentNode: ComponentNode | null;
}

/**
 * Keeps the content of the `ordered` portals sharing one target in the order
 * their `<Portal/>` tags appear in the document, rather than in the order they
 * happened to mount.
 *
 * A portal cannot do this alone: it knows nothing of its siblings, so the
 * comparison has to happen per target. Two things can put the group out of
 * order, and each needs its own trigger:
 *  - a portal mounting or unmounting, which `add`/`delete` handle;
 *  - a plain reorder of an unchanged set of portals, which owl performs by
 *    moving nodes without re-rendering, so nothing in owl reports it. Hence the
 *    MutationObserver on the parents the anchors live under.
 */
class OrderedPortals {
  static groups = new WeakMap<HTMLElement, OrderedPortals>();

  static get(target: HTMLElement): OrderedPortals {
    let group = OrderedPortals.groups.get(target);
    if (!group) {
      group = new OrderedPortals(target);
      OrderedPortals.groups.set(target, group);
    }
    return group;
  }

  entries = new Set<OrderedEntry>();
  observers = new Map<Node, MutationObserver>();
  // Marks the end of the group inside the target, so the ordered content stays
  // where the group first landed instead of being appended past whatever else
  // the target may hold.
  end = document.createComment("");

  constructor(public target: HTMLElement) {}

  add(entry: OrderedEntry) {
    if (!this.end.isConnected) {
      this.target.appendChild(this.end);
    }
    this.entries.add(entry);
    this.place();
  }

  delete(entry: OrderedEntry) {
    this.entries.delete(entry);
    if (this.entries.size) {
      this.place();
      return;
    }
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    this.end.remove();
    OrderedPortals.groups.delete(this.target);
  }

  /** Sorted entries, and the first DOM node of each one's content. */
  sorted(): [OrderedEntry, Node][] {
    const placeable: [OrderedEntry, Node, Node][] = [];
    for (const entry of this.entries) {
      const anchorEl = entry.portalNode.firstNode();
      const firstEl = entry.contentNode?.firstNode();
      if (anchorEl?.isConnected && firstEl) {
        placeable.push([entry, firstEl, anchorEl]);
      }
    }
    placeable.sort(([, , anchorEl], [, , otherAnchorEl]) =>
      anchorEl.compareDocumentPosition(otherAnchorEl) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    return placeable.map(([entry, firstEl]) => [entry, firstEl]);
  }

  place() {
    this.observe();
    const sorted = this.sorted();
    if (this.isOrdered(sorted)) {
      return;
    }
    // Moving each one in turn to just before `end` leaves them in sorted order.
    for (const [entry] of sorted) {
      entry.contentNode!.moveBeforeDOMNode(this.end, this.target);
    }
  }

  /** Whether the target already holds the group's content in sorted order. */
  isOrdered(sorted: [OrderedEntry, Node][]): boolean {
    const expected = new Set(sorted.map(([, firstEl]) => firstEl));
    let index = 0;
    for (const childEl of this.target.childNodes) {
      if (expected.has(childEl) && childEl !== sorted[index++]?.[1]) {
        return false;
      }
    }
    return index === sorted.length;
  }

  /**
   * Watch the parents the anchors sit under, so that a reorder among them
   * re-sorts the target. Anchors of one group may live under different parents
   * (portals to a shared target need not be siblings, or even share a root).
   */
  observe() {
    const parentEls = new Set<Node>();
    for (const entry of this.entries) {
      const parentEl = entry.portalNode.firstNode()?.parentNode;
      if (parentEl) {
        parentEls.add(parentEl);
      }
    }
    for (const [parentEl, observer] of this.observers) {
      if (!parentEls.has(parentEl)) {
        observer.disconnect();
        this.observers.delete(parentEl);
      }
    }
    for (const parentEl of parentEls) {
      if (!this.observers.has(parentEl)) {
        const observer = new MutationObserver(() => this.place());
        observer.observe(parentEl, { childList: true });
        this.observers.set(parentEl, observer);
      }
    }
  }
}
