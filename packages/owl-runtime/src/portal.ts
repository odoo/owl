import { batched, Signal } from "@odoo/owl-core";
import { Component } from "./component";
import type { ComponentNode } from "./component_node";
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
    // Rank among the portals sharing this target: they are placed in ascending
    // `position` order instead of in the order they happened to mount. Left out
    // (the default), this portal simply appends, which is what a stack of
    // dialogs or toasts wants. See PortalGroup below.
    position: t.number().optional(),
  });

  setup() {
    const portalNode = this.__owl__;
    const app = portalNode.app;
    const slots = this.props.slots;
    let root: ReturnType<typeof app.createRoot> | null = null;
    let group: PortalGroup | null = null;
    const entry: PortalEntry = { position: undefined, contentNode: null };

    const tearDown = () => {
      if (root) {
        root.destroy();
        root = null;
      }
      if (group) {
        group.entries.delete(entry);
        group = null;
      }
      entry.contentNode = null;
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

      group = PortalGroup.get(target);
      group.entries.add(entry);
      // `Root` does not expose its node, so take it from the mounted instance.
      // The promise settles in a microtask (before paint) unless the content
      // has a pending `onWillStart`, and stays pending on a destroyed root.
      root.promise.then(
        (component: PortalContent) => {
          if (group?.entries.has(entry)) {
            entry.contentNode = component.__owl__;
            group.place();
          }
        },
        () => {}
      );

      return tearDown;
    });

    // Deliberately its own effect: this one owns nothing, so a reorder costs a
    // number and a batched re-placement. Reading the position in the effect
    // above would tear the sub-root down and rebuild the portaled content.
    useEffect(() => {
      entry.position = this.props.position;
      group?.place();
    });

    onWillDestroy(tearDown);
  }
}

// -----------------------------------------------------------------------------
// Ordered portals
// -----------------------------------------------------------------------------

interface PortalEntry {
  // Rank given by the `position` prop, or undefined for a portal that does not
  // take part in the ordering and is left wherever it landed.
  position: number | undefined;
  // The sub-root holding the portaled content, which is what gets moved. Null
  // until that sub-root has mounted.
  contentNode: ComponentNode | null;
}

/**
 * Places the content of the portals that share one target in ascending
 * `position` order, rather than in the order they happened to mount.
 *
 * A portal cannot do this alone, knowing nothing of its siblings, so the
 * ordering is held per target. The rank comes in as a prop, which means a
 * reorder of the source list reaches us as a prop change: nothing here reads
 * the source DOM, so the placement does not depend on what markup sits between
 * a `<Portal/>` and the list that reorders it.
 */
export class PortalGroup {
  // Weak, so a group dies with the target it is keyed on. `entries` cannot be:
  // placing means iterating them, and a WeakSet is not iterable. It is drained
  // by `tearDown`, from both the effect cleanup and `onWillDestroy`.
  static groups = new WeakMap<HTMLElement, PortalGroup>();

  static get(target: HTMLElement): PortalGroup {
    let group = PortalGroup.groups.get(target);
    if (!group) {
      group = new PortalGroup(target);
      PortalGroup.groups.set(target, group);
    }
    return group;
  }

  entries = new Set<PortalEntry>();

  constructor(public target: HTMLElement) {}

  /**
   * Re-place the whole group, once per microtick. Each portal only knows its
   * own position and their hooks run one at a time, so placing an entry as soon
   * as its own position changes would sort it against its siblings' stale
   * positions, and leave it there.
   */
  place = batched(() => {
    const placed: PortalEntry[] = [];
    for (const entry of this.entries) {
      if (
        entry.position !== undefined &&
        entry.contentNode?.firstNode()?.parentNode === this.target
      ) {
        placed.push(entry);
      }
    }
    placed.sort((entry, other) => entry.position! - other.position!);
    if (this.isOrdered(placed)) {
      return;
    }
    // Appending them in turn leaves the group ordered, at the end of the target.
    for (const entry of placed) {
      entry.contentNode!.moveBeforeDOMNode(null, this.target);
    }
  });

  /** Whether the target already holds the group's content in `placed` order. */
  isOrdered(placed: PortalEntry[]): boolean {
    let index = 0;
    for (const childEl of this.target.childNodes) {
      if (childEl === placed[index]?.contentNode!.firstNode()) {
        index++;
      }
    }
    return index === placed.length;
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
