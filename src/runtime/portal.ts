import { onMounted, onWillUnmount } from "./lifecycle_hooks";
import { BDom, text, VNode } from "./blockdom";
import { Component } from "./component";
import { OwlError } from "./error_handling";

const VText: any = text("").constructor;

function getTarget(
  currentParentEl: HTMLElement | Document,
  selector: string,
  isClosest: boolean
): HTMLElement | null {
  if (!isClosest || currentParentEl === document) {
    return document.querySelector(selector);
  }
  const attempt = currentParentEl.querySelector(selector) as HTMLElement | null;
  return attempt || getTarget(currentParentEl.parentElement!, selector, true);
}

class VPortal extends VText implements Partial<VNode<VPortal>> {
  content: BDom | null;
  selector: string;
  isClosest: boolean;
  target: HTMLElement | null = null;

  constructor(selector: string, isClosest: boolean, content: BDom) {
    super("");
    this.selector = selector;
    this.isClosest = isClosest;
    this.content = content;
  }

  mount(parent: HTMLElement, anchor: ChildNode) {
    super.mount(parent, anchor);
    this.target = getTarget(parent, this.selector, this.isClosest);
    if (this.target) {
      this.content!.mount(this.target!, null);
    } else {
      this.content!.mount(parent, anchor);
    }
  }

  beforeRemove() {
    this.content!.beforeRemove();
  }
  remove() {
    if (this.content) {
      super.remove();
      this.content!.remove();
      this.content = null;
    }
  }

  patch(other: VPortal) {
    super.patch(other);
    if (this.content) {
      this.content.patch(other.content!, true);
    } else {
      this.content = other.content;
      this.content!.mount(this.target!, null);
    }
  }
}

/**
 * kind of similar to <t t-slot="default"/>, but it wraps it around a VPortal
 */
export function portalTemplate(app: any, bdom: any, helpers: any) {
  let { callSlot } = helpers;
  return function template(ctx: any, node: any, key = ""): any {
    return new VPortal(
      ctx.props.target,
      ctx.props.isClosest,
      callSlot(ctx, node, key, "default", false, null)
    );
  };
}

export class Portal extends Component {
  static template = "__portal__";
  static props = {
    target: String,
    isClosest: { type: Boolean, optional: true },
    slots: true,
  };

  setup() {
    const node: any = this.__owl__;

    onMounted(() => {
      const portal: VPortal = node.bdom;
      if (!portal.target) {
        const target = getTarget(portal.parentEl, this.props.target, this.props.isClosest);
        if (target) {
          portal.content!.moveBeforeDOMNode(target.firstChild, target);
        } else {
          throw new OwlError("invalid portal target");
        }
      }
    });

    onWillUnmount(() => {
      const portal: VPortal = node.bdom;
      portal.remove();
    });
  }
}
