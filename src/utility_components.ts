import { Block } from "./bdom";
import { BText } from "./bdom/block_text";
import { Component } from "./component";
import type { OwlNode } from "./owl_node";
import { xml } from "./tags";

export class NoUpdate extends Component {
  static template = xml`<t t-slot="default"/>`;

  constructor(props: any, env: any, node: OwlNode) {
    super(props, env, node);
    node._render = function (fiber: any) {
      if (!this.bdom) {
        this.bdom = this.renderFn();
        this.bdom!.patch = () => {};
      }
      fiber.bdom = this.bdom;
      fiber.root.counter--;
    };
  }
}

class BPortal extends BText {
  selector: string;
  realBDom: Block | null;
  target: HTMLElement | null = null;

  constructor(selector: string, realBDom: Block) {
    super("");
    this.selector = selector;
    this.realBDom = realBDom;
  }
  mountBefore(anchor: ChildNode, mounted: any[], patched: any[]) {
    super.mountBefore(anchor);
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
    this.realBDom!.mount(this.target!, mounted, patched);
  }
  remove() {
    super.remove();
    this.realBDom!.remove();
    this.realBDom = null;
  }

  patch(other: BPortal, mountedNodes: any[], patchedNodes: any[]) {
    super.patch(other);
    if (this.realBDom) {
      this.realBDom.patch(other.realBDom!, mountedNodes, patchedNodes);
    } else {
      this.realBDom = other.realBDom;
      this.realBDom!.mount(this.target!, mountedNodes, patchedNodes);
    }
  }
}
export class Portal extends Component {
  static template = xml`<t t-slot="default"/>`;

  constructor(props: any, env: any, node: OwlNode) {
    super(props, env, node);
    node._render = function (fiber: any) {
      // (this as any).realBdom = this.renderFn();
      const bdom = new BPortal(props.target, this.renderFn());
      fiber.bdom = bdom;
      fiber.root.counter--;
    };
  }
}
