import { Anchor, Block } from "./types";

export interface BlockText extends Block<BlockText> {
  el: Text | null;
  text: string;
}

export function text(text: string): BlockText {
  return new BText(text);
}

export class BText implements Block<BlockText> {
  text: string;
  el: Text | null = null;

  constructor(text: string) {
    this.text = text;
  }

  mountBefore(anchor: Anchor) {
    let el = document.createTextNode(this.text);
    this.el = el;
    anchor.before(el);
  }

  patch(block: BText) {
    if (this === block) {
      return;
    }
    let text = block.text as any;
    if (this.text !== text) {
      this.text = text;
      this.el!.textContent = text;
    }
  }

  moveBefore(anchor: any) {
    anchor.before(this.el);
  }

  remove() {
    const el = this.el!;
    el.parentElement!.removeChild(el);
  }

  firstChildNode(): ChildNode | null {
    return this.el;
  }
}
