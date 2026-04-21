import { Component } from "./component";
import type { ComponentNode } from "./component_node";
import { useEffect } from "./hooks";
import { onWillDestroy } from "./lifecycle_hooks";
import { Signal } from "./reactivity/signal";
import { nodeErrorHandlers } from "./rendering/error_handling";
import { xml } from "./template_set";

// Inner sub-root that simply renders the consumer's default slot. Module-level
// so its template is compiled once and shared across all Portal instances.
class PortalContent extends Component {
  static template = xml`<t t-call-slot="default"/>`;
}

export type PortalTarget = string | HTMLElement | Signal<HTMLElement | null> | null | undefined;

export class Portal extends Component {
  static template = xml``;

  setup() {
    const portalNode = this.__owl__;
    const app = portalNode.app;
    const slots = portalNode.props.slots;
    let root: ReturnType<typeof app.createRoot> | null = null;

    const tearDown = () => {
      if (root) {
        root.destroy();
        root = null;
      }
    };

    useEffect(() => {
      const target = resolveTarget(portalNode.props.target);
      if (!target) {
        return;
      }

      root = app.createRoot(PortalContent, { props: { slots } } as any);

      // Forward the plugin chain from this Portal (same pattern as Suspense:
      // createRoot defaults sub-roots to the app-level plugin manager; we
      // override so `providePlugins` contributions from ancestors are visible
      // inside the portaled content).
      root.node.pluginManager = portalNode.pluginManager;

      // Route errors thrown inside the portaled subtree back through the
      // Portal's parent chain, so consumer onError handlers still catch them.
      // Without this, a sub-root error would propagate to app._handleError
      // and tear down the whole app.
      nodeErrorHandlers.set(root.node, [
        (error, finalize) => {
          let current: ComponentNode | null = portalNode;
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
          portalNode.app._handleError(owlError);
        },
      ]);

      root.commit(target);

      return tearDown;
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
