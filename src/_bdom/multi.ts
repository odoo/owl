import { Anchor, Block, BlockMulti, Operations } from "./types";

// -----------------------------------------------------------------------------
//  Multi blocks
// -----------------------------------------------------------------------------

export function multi(blocks: (Block | undefined)[]): BlockMulti {
  return {
    ops: MULTI_BLOCK_OPS,
    el: undefined,
    data: undefined,
    content: blocks,
  };
}

const MULTI_BLOCK_OPS: Operations = {
  mountBefore(block: any, anchor: Anchor) {
    const children = block.content;
    const anchors = new Array(children.length);
    for (let i = 0, l = children.length; i < l; i++) {
      let child = children[i];
      const childAnchor = document.createTextNode("");
      anchor.before(childAnchor);
      anchors![i] = childAnchor;
      if (child) {
        child.ops.mountBefore(child, childAnchor);
      }
    }
    block.data = anchors;
  },
  patch(block1: any, block2: any) {
    if (block1 === block2) {
      return;
    }
    const children = block1.content;
    const newChildren = block2.content!;
    const anchors = block1.data!;
    for (let i = 0, l = children.length; i < l; i++) {
      const block = children[i];
      const newBlock = newChildren[i];
      if (block) {
        if (newBlock) {
          block.ops.patch(block, newBlock);
        } else {
          children[i] = undefined;
          block.ops.remove(block);
        }
      } else if (newBlock) {
        children[i] = newBlock;
        newBlock.ops.mountBefore(newBlock, anchors[i]);
      }
    }
  },
  moveBefore(block: any, anchor: any) {
    const children = block.content;
    const anchors = block.data!;
    for (let i = 0, l = children.length; i < l; i++) {
      let child = children[i];
      let _anchor = anchors[i];
      anchor.before(_anchor);
      if (child) {
        child.ops.moveBefore(child, _anchor);
      }
    }
  },
  remove(block: any) {
    const children = block.content;
    const anchors = block.data;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child) {
        child.ops.remove(child);
      }
      anchors![i].remove();
    }
  },
  firstChildNode(block: any): ChildNode | null {
    const children = block.content;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (child) {
        return child.el || child.ops.firstChildNode(child);
      }
    }
    return null;
  },
};
