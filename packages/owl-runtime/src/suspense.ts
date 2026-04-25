import { signal } from "@odoo/owl-core";
import { Component } from "./component";
import { useEffect } from "./hooks";
import { onMounted, onWillDestroy } from "./lifecycle_hooks";
import { props } from "./props";
import { forwardErrorToParent, nodeErrorHandlers } from "./rendering/error_handling";
import type { MountFiber } from "./rendering/fibers";
import { xml } from "./template_set";
import { types as t } from "./types";

// Internal component used as the sub-root — its sole job is to render the
// consumer's `default` slot so that descendant components are constructed and
// their onWillStart fires. Not exported.
class SuspenseHost extends Component {
  static template = xml`<t t-call-slot="default"/>`;
}

// Suspense renders only the `fallback` slot (under a `t-if`) and only for as
// long as the sub-root's render phase is pending. Once prepared and Suspense
// itself is mounted, the sub-root is mounted into Suspense's parent element
// immediately before the fallback's first DOM node; flipping `prepared` then
// makes the `t-if` body disappear — Owl's diff replaces the fallback with an
// anchor text node at the same position. Final DOM: [sub-root, anchor].
// Owl's diff only patches what it rendered (the anchor), so the
// externally-mounted sub-root content is left alone.
//
// For fully-synchronous subtrees, `prepared` is flipped during setup (see
// the fast-path check below), so the very first render skips the fallback
// and produces just the anchor — no flash.
export class Suspense extends Component {
  static template = xml`
    <t t-if="!this.prepared()">
      <t t-call-slot="fallback"/>
    </t>
  `;

  props = props({ slots: t.object(["default", "fallback?"]) });

  private prepared = signal(false);
  private mounted = signal(false);
  private subRootMounted = false;

  setup() {
    const suspenseNode = this.__owl__;
    // A sub-root renders the default slot independently of the enclosing
    // MountFiber — its willStart fires in parallel with the outer tree.
    const root = suspenseNode.app.createRoot(SuspenseHost, {
      props: { slots: this.props.slots },
    } as any);

    // Thread the plugin manager so `providePlugins` contributions from
    // ancestors are visible inside the default slot. (createRoot defaults
    // sub-roots to the app-level plugin manager; override here.) Destroy
    // cascade is handled explicitly below via `onWillDestroy`.
    root.node.pluginManager = suspenseNode.pluginManager;

    // Route errors from the sub-root back into Suspense's parent chain so
    // consumer `onError` handlers still catch descendant failures.
    nodeErrorHandlers.set(root.node, [forwardErrorToParent(suspenseNode)]);

    // Kick off the render phase now — descendants' onWillStart fires in
    // parallel with the outer tree's mount, no target needed yet.
    root.prepare().then(() => this.prepared.set(true));

    // Sync fast path: try to render the sub-root immediately. If the subtree
    // has no async onWillStart anywhere, the render completes synchronously
    // and counter drops to 0 — we flip `prepared` right now so the first
    // render of Suspense skips the fallback entirely (no flash). If async
    // hooks are present, fiber.render starts the cascade and the rest
    // resolves through microtasks; the scheduler then commits at the next
    // tick without re-rendering this fiber (its bdom is already set).
    const fiber = root.node.fiber as MountFiber | null;
    if (fiber && fiber.bdom === null) {
      fiber.render();
    }
    if (fiber && fiber.counter === 0) {
      this.prepared.set(true);
    }

    onMounted(() => this.mounted.set(true));

    // Mount the sub-root once the render phase has finished and Suspense is
    // in the DOM. `bdom.firstNode()` is either the fallback's first DOM node
    // (async case) or the anchor text node produced by the `t-if`-false
    // branch (sync case); in both cases it sits exactly at Suspense's
    // position, which is where the sub-root belongs.
    useEffect(() => {
      if (this.subRootMounted || !this.prepared() || !this.mounted()) {
        return;
      }
      this.subRootMounted = true;
      const anchor = suspenseNode.bdom!.firstNode()!;
      root.mount(anchor.parentElement!, { afterNode: anchor });
    });

    onWillDestroy(() => root.destroy());
  }
}
