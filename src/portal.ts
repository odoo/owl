import { BDom, text, VNode } from "./blockdom";

const VText: any = text("").constructor;

export class VPortal extends VText implements Partial<VNode<VPortal>> {
  //   selector: string;
  realBDom: BDom | null;
  target: HTMLElement | null = null;

  constructor(selector: string, realBDom: BDom, ownerComponent: ComponentNode) {
    super("");
    this.ownerComponent = ownerComponent;
    this.selector = selector;
    this.realBDom = realBDom;
  }
  mount(parent: HTMLElement, anchor: ChildNode) {
    super.mount(parent, anchor);
    this.ownerComponent.willDestroy.push(() => this.cleanup());
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
