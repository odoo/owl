import { Component } from "./component";
import type { ComponentNode } from "./component_node";
import { onWillDestroy } from "./lifecycle_hooks";
import { effect } from "./reactivity/effect";
import { signal } from "./reactivity/signal";
import { nodeErrorHandlers } from "./rendering/error_handling";
import { xml } from "./template_set";

// Internal component used as the shadow root — its sole job is to render the
// consumer's `default` slot so that descendant components are constructed and
// their onWillStart fires. Not exported.
class SuspenseHost extends Component {
  static template = xml`<t t-call-slot="default"/>`;
}

// Suspense splits its DOM into two siblings:
//   - an always-present content div (the sub-root's mount target)
//   - a conditional fallback wrapper, removed once the sub-root commits
// Separating them avoids diff conflicts: Owl's diff only patches what it
// rendered, so the content div's externally-mounted children are untouched.
export class Suspense extends Component {
  static template = xml`
    <div class="o-suspense-fallback" t-if="!this.committed()">
      <t t-call-slot="fallback"/>
    </div>
    <div class="o-suspense-content" t-ref="this.contentRef"/>
  `;

  contentRef = signal<HTMLElement | null>(null);
  private prepared = signal(false);
  committed = signal(false);

  setup() {
    const suspenseNode = this.__owl__;
    // A sub-root renders the default slot independently of the enclosing
    // MountFiber — its willStart fires in parallel with the outer tree.
    const root = suspenseNode.app.createRoot(SuspenseHost, {
      props: { slots: suspenseNode.props.slots },
    } as any);

    // Thread the plugin manager so `providePlugins` contributions from
    // ancestors are visible inside the default slot. (createRoot defaults
    // sub-roots to the app-level plugin manager; override here.) Destroy
    // cascade is handled explicitly below via `onWillDestroy`.
    root.node.pluginManager = suspenseNode.pluginManager;

    // Route errors from the shadow subtree back into Suspense's parent chain
    // so consumer onError handlers still catch descendant failures. Walk the
    // chain ourselves rather than re-entering handleError, which would mark
    // the outer tree's fibers as in-error and stall the enclosing mount.
    nodeErrorHandlers.set(root.node, [
      (error, finalize) => {
        let current: ComponentNode | null = suspenseNode;
        while (current) {
          const handlers = nodeErrorHandlers.get(current);
          if (handlers) {
            for (let i = handlers.length - 1; i >= 0; i--) {
              try {
                handlers[i](error, finalize);
                return;
              } catch (e) {
                error = e;
              }
            }
          }
          current = current.parent;
        }
        const owlError = finalize();
        suspenseNode.app._handleError(owlError);
      },
    ]);

    // Kick off the render phase now — descendants' onWillStart fires in
    // parallel with the outer tree's mount, no target needed yet.
    root.prepare().then(() => this.prepared.set(true));

    // Commit as soon as the content div is in the DOM and the render phase
    // has finished. Both are signals; the effect re-fires until both are
    // satisfied, after which commit() is idempotent.
    effect(() => {
      const target = this.contentRef();
      const ready = this.prepared();
      if (target && ready && !this.committed()) {
        root.commit(target);
        this.committed.set(true);
      }
    });

    onWillDestroy(() => root.destroy());
  }
}
