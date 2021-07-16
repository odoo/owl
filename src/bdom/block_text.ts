import { Block } from "./block";

// -----------------------------------------------------------------------------
//  Text Block
// -----------------------------------------------------------------------------

export class BText extends Block {
  el: Text;
  text: string;
  constructor(text: string) {
    super();
    this.el = document.createTextNode(text);
    this.text = text;
  }

  firstChildNode(): ChildNode | null {
    return this.el;
  }

  mountBefore(anchor: ChildNode, mounted?: any[], patched?: any[]) {
    anchor.before(this.el);
  }

  moveBefore(anchor: ChildNode) {
    anchor.before(this.el);
  }
  patch(other: BText, mounted?: any[], patched?: any) {
    if (other.text !== this.text) {
      this.el.textContent = other.el.textContent;
      this.text = other.text;
    }
  }

  toString() {
    return this.el.textContent;
  }

  remove() {
    this.el.remove();
  }
}
