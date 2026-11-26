import { Signal, STATUS } from "@odoo/owl-core";
import { Component } from "./component";
import { useEffect } from "./hooks";
import { onMounted, onWillDestroy } from "./lifecycle_hooks";
import { useProps } from "./props";
import { Content, create, mountOwner, Owner } from "./rendering/content";
import { helpers } from "./rendering/template_helpers";
import { xml } from "./template_set";
import { types as t } from "./types";

export type PortalTarget = string | HTMLElement | Signal<HTMLElement | null> | null | undefined;

/**
 * Renders its default slot in another element. The slot content belongs to
 * the portal (its components are children of the portal, and its errors go to
 * the portal's parents), it is only inserted elsewhere.
 */
export class Portal extends Component {
  static template = xml``;

  props = useProps({
    slots: t.object(["default"]),
    target: t.or([t.string(), t.signal(t.instanceOf(HTMLElement)), t.instanceOf(HTMLElement)]),
    position: t.number().optional(),
  });

  setup() {
    const node = this.__owl__;
    let current: { owner: Owner; content: Content } | null = null;

    const tearDown = () => {
      if (current) {
        const { owner, content } = current;
        current = null;
        owner.unmount();
        content.remove();
        owner.dispose();
      }
    };

    // the content is inserted once the portal itself is mounted, so that a
    // selector target (or a ref) can be resolved
    let isMounted = false;
    const render = () => {
      const target = resolveTarget(this.props.target);
      if (!target) {
        return;
      }
      const owner = new Owner(node, node.owner);
      const ctx = { this: this, __owl__: node };
      const content = create(owner, () => helpers.callSlot(ctx, node, "default", null, null, null));
      current = { owner, content };
      content.mount(target, null);
      if (node.status === STATUS.MOUNTED) {
        mountOwner(owner);
      }
    };

    onMounted(() => {
      isMounted = true;
      render();
    });

    useEffect(() => {
      // tracks the target
      resolveTarget(this.props.target);
      if (isMounted) {
        tearDown();
        render();
      }
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
