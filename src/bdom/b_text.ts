import { Block } from "./block";

// -----------------------------------------------------------------------------
//  Text Block
// -----------------------------------------------------------------------------

export class BText implements Block<BText> {
  el: Text;
  text: string;

  constructor(text: string) {
    this.el = document.createTextNode(text);
    this.text = text;
  }

  firstChildNode(): ChildNode | null {
    return this.el;
  }

  mountBefore(anchor: ChildNode) {
    anchor.before(this.el);
  }

  moveBefore(anchor: ChildNode) {
    anchor.before(this.el);
  }

  patch(other: BText) {
    if (other.text !== this.text) {
      this.el.textContent = other.el.textContent;
      this.text = other.text;
    }
  }

  toString() {
    return this.el.textContent!;
  }

  beforeRemove() {}
  remove() {
    this.el.remove();
  }
}
