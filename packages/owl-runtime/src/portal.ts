import { Signal } from "@odoo/owl-core";
import { Component } from "./component";
import { useEffect } from "./hooks";
import { onWillDestroy } from "./lifecycle_hooks";
import { props } from "./props";
import { forwardErrorToParent, nodeErrorHandlers } from "./rendering/error_handling";
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

  props = props({
    slots: t.object(["default"]),
    target: t.or([t.string(), t.signal(t.instanceOf(HTMLElement)), t.instanceOf(HTMLElement)]),
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

      root = app.createRoot(PortalContent, { props: { slots } } as any);

      // Forward the plugin chain from this Portal (same pattern as Suspense:
      // createRoot defaults sub-roots to the app-level plugin manager; we
      // override so `providePlugins` contributions from ancestors are visible
      // inside the portaled content).
      root.node.pluginManager = portalNode.pluginManager;

      // Route errors from the portaled subtree back through Portal's parent
      // chain so consumer `onError` handlers still catch them. Without this,
      // sub-root errors would propagate to app._handleError and tear down
      // the whole app.
      nodeErrorHandlers.set(root.node, [forwardErrorToParent(portalNode)]);

      root.mount(target);

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
