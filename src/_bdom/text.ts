import { Anchor, BlockText, Operations } from "./types";

// -----------------------------------------------------------------------------
//  Text blocks
// -----------------------------------------------------------------------------

export function text(text: string): BlockText {
  return {
    ops: TEXT_OPS,
    el: undefined,
    data: text,
    content: undefined,
  };
}

const TEXT_OPS: Operations = {
  mountBefore(block: any, anchor: Anchor) {
    let el = document.createTextNode(block.data);
    block.el = el;
    anchor.before(el);
  },
  patch(block1: any, block2: any) {
    if (block1 === block2) {
      return;
    }
    let text = block2.data as any;
    if (block1.data !== text) {
      block1.data = text;
      block1.el!.textContent = text;
    }
  },
  moveBefore(block: any, anchor: any) {
    anchor.before(block.el);
  },
  remove(block: any) {
    const el = block.el!;
    el.parentElement!.removeChild(el);
  },
  firstChildNode(block: any): ChildNode | null {
    return block.el;
  },
};
