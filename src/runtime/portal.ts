import { onMounted, onWillUnmount } from "./lifecycle_hooks";
import { BDom, text, VNode } from "./blockdom";
import { Component } from "./component";
import { OwlError } from "../common/owl_error";

const VText: any = text("").constructor;

class VPortal extends VText implements Partial<VNode<VPortal>> {
  content: BDom | null;
  selector: string;
  target: HTMLElement | null = null;

  constructor(selector: string, content: BDom) {
    super("");
    this.selector = selector;
    this.content = content;
  }

  mount(parent: HTMLElement, anchor: ChildNode) {
    super.mount(parent, anchor);
    this.target = document.querySelector(this.selector) as any;
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
    return new VPortal(ctx.props.target, callSlot(ctx, node, key, "default", false, null));
  };
}

export class Portal extends Component {
  static template = "__portal__";
  static props = {
    target: {
      type: String,
    },
    slots: true,
  };

  setup() {
    const node: any = this.__owl__;

    onMounted(() => {
      const portal: VPortal = node.bdom;
      if (!portal.target) {
        const target: HTMLElement = document.querySelector(this.props.target);
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
