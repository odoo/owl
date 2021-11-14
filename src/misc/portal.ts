import type { ComponentNode } from "../component/component_node";
import { Component } from "../component/component";
import { xml } from "../tags";
import { BDom, text, VNode } from "../blockdom";

const VText: any = text("").constructor;

class VPortal extends VText implements Partial<VNode<VPortal>> {
  //   selector: string;
  realBDom: BDom | null;
  target: HTMLElement | null = null;

  constructor(selector: string, realBDom: BDom) {
    super("");
    this.selector = selector;
    this.realBDom = realBDom;
  }
  mount(parent: HTMLElement, anchor: ChildNode) {
    super.mount(parent, anchor);
    this.target = document.querySelector(this.selector) as any;
    if (!this.target) {
      let el: any = this.el;
      while (el && el.parentElement instanceof HTMLElement) {
        el = el.parentElement;
      }
      this.target = el && el.querySelector(this.selector);
      if (!this.target) {
        throw new Error("invalid portal target");
      }
    }
    this.realBDom!.mount(this.target!, null);
  }

  beforeRemove() {
    this.realBDom!.beforeRemove();
  }
  remove() {
    super.remove();
    this.realBDom!.remove();
    this.realBDom = null;
  }

  patch(other: VPortal) {
    super.patch(other);
    if (this.realBDom) {
      this.realBDom.patch(other.realBDom!, true);
    } else {
      this.realBDom = other.realBDom;
      this.realBDom!.mount(this.target!, null);
    }
  }
}

export class Portal extends Component {
  static template = xml`<t t-slot="default"/>`;
  static props = {
    target: {
      type: String,
    },
  };

  constructor(props: any, env: any, node: ComponentNode) {
    super(props, env, node);
    node._render = function (fiber: any) {
      const bdom = new VPortal(props.target, this.renderFn());
      fiber.bdom = bdom;
      fiber.root.counter--;
    };
  }
}
