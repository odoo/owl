import { Block } from "./block";

// -----------------------------------------------------------------------------
//  Html Block
// -----------------------------------------------------------------------------

export class BHtml implements Block<BHtml> {
  el: ChildNode | null = null;
  html: string;
  content: ChildNode[] = [];
  anchor: ChildNode | null = null;
  constructor(html: any) {
    this.html = String(html);
  }

  firstChildNode(): ChildNode | null {
    return this.content[0];
  }

  mountBefore(anchor: ChildNode) {
    const _anchor = document.createTextNode("");
    this.build();
    anchor.before(_anchor);
    for (let elem of this.content) {
      _anchor.before(elem);
    }
    this.anchor = _anchor;
  }

  moveBefore(anchor: ChildNode): void {
    anchor.before(this.anchor!);
    for (let elem of this.content) {
      this.anchor!.before(elem);
    }
  }

  build() {
    const div = document.createElement("div");
    div.innerHTML = this.html;
    this.content = [...div.childNodes];
    this.el = this.content[0];
  }

  beforeRemove() {}
  remove() {
    for (let elem of this.content) {
      elem.remove();
    }
    this.anchor!.remove();
  }

  patch(other: BHtml) {
    for (let elem of this.content) {
      elem.remove();
    }
    this.html = other.html;
    this.build();
    for (let elem of this.content) {
      this.anchor!.before(elem);
    }
  }

  toString(): string {
    return this.html;
  }
}
