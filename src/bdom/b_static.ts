import { Block } from "./block";

// -----------------------------------------------------------------------------
//  Static Block
// -----------------------------------------------------------------------------

export class BStatic implements Block<BStatic> {
  static el: ChildNode;
  el: ChildNode | null = null;

  firstChildNode(): ChildNode | null {
    return this.el;
  }

  toString(): string {
    return (this.constructor as any).el!.cloneNode(true).outerHTML;
  }

  mountBefore(anchor: ChildNode) {
    this.el = (this.constructor as any).el.cloneNode(true);
    anchor.before(this.el!);
  }

  moveBefore(anchor: ChildNode) {
    anchor.before(this.el!);
  }

  patch() {}

  beforeRemove() {}

  remove() {
    this.el!.remove();
  }
}
