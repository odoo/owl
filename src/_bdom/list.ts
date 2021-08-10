import { Anchor, Block, BlockList, Operations } from "./types";

// -----------------------------------------------------------------------------
//  List blocks
// -----------------------------------------------------------------------------

export function list(
  blocks: Block[],
  isOnlyChild: boolean = false,
  hasNoComponent: boolean = false
): BlockList {
  return {
    ops: LIST_OPS,
    el: undefined,
    key: undefined,
    data: { anchor: undefined, isOnlyChild, hasNoComponent },
    content: blocks,
  };
}

const LIST_OPS: Operations = {
  mountBefore(block: any, anchor: Anchor) {
    const children = block.content;
    const _anchor = document.createTextNode("");
    block.data.anchor = _anchor;
    anchor.before(_anchor);
    const l = children.length;
    if (l) {
      const mountBefore = children[0].ops.mountBefore;
      for (let i = 0; i < l; i++) {
        mountBefore(children[i], _anchor);
      }
    }
  },
  patch(block1: any, block2: any) {
    if (block1 === block2) {
      return;
    }
    const oldCh = block1.content;
    const newCh: Block[] = (block2 as any).content;
    if (newCh.length === 0 && oldCh.length === 0) {
      return;
    }
    const ops: Operations = oldCh[0] ? oldCh[0].ops : newCh[0].ops;
    const { firstChildNode, moveBefore, mountBefore, patch, remove: removeBlock } = ops;

    const data = block1.data;
    const _anchor = data.anchor!;

    // fast path
    if (newCh.length === 0 && data.isOnlyChild) {
      // if (!data.hasNoComponent) {
      //   for (let i = 0; i < oldCh.length; i++) {
      //     beforeRemove(oldCh[i]);
      //   }
      // }

      const parent = _anchor.parentElement!;
      _anchor.remove();
      parent.textContent = "";
      parent.appendChild(_anchor);
      block1.content = newCh;
      return;
    }

    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldStartBlock = oldCh[0];
    let newStartBlock = newCh[0];

    let oldEndIdx = oldCh.length - 1;
    let newEndIdx = newCh.length - 1;
    let oldEndBlock = oldCh[oldEndIdx];
    let newEndBlock = newCh[newEndIdx];

    let mapping: any = undefined;
    let noFullRemove = data.hasNoComponent;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      // -------------------------------------------------------------------
      if (oldStartBlock === null) {
        oldStartBlock = oldCh[++oldStartIdx];
      }
      // -------------------------------------------------------------------
      else if (oldEndBlock === null) {
        oldEndBlock = oldCh[--oldEndIdx];
      }
      // -------------------------------------------------------------------
      else if (oldStartBlock.key === newStartBlock.key) {
        patch(oldStartBlock, newStartBlock);
        newCh[newStartIdx] = oldStartBlock;
        oldStartBlock = oldCh[++oldStartIdx];
        newStartBlock = newCh[++newStartIdx];
      }
      // -------------------------------------------------------------------
      else if (oldEndBlock.key === newEndBlock.key) {
        patch(oldEndBlock, newEndBlock);
        newCh[newEndIdx] = oldEndBlock;
        oldEndBlock = oldCh[--oldEndIdx];
        newEndBlock = newCh[--newEndIdx];
      }
      // -------------------------------------------------------------------
      else if (oldStartBlock.key === newEndBlock.key) {
        // bnode moved right
        patch(oldStartBlock, newEndBlock);
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.el || firstChildNode(nextChild)! : _anchor;
        moveBefore(oldStartBlock, anchor);
        newCh[newEndIdx] = oldStartBlock;
        oldStartBlock = oldCh[++oldStartIdx];
        newEndBlock = newCh[--newEndIdx];
      }
      // -------------------------------------------------------------------
      else if (oldEndBlock.key === newStartBlock.key) {
        // bnode moved left
        patch(oldEndBlock, newStartBlock);
        const nextChild = oldCh[oldStartIdx];
        const anchor = nextChild ? nextChild.el || firstChildNode(nextChild)! : _anchor;
        moveBefore(oldEndBlock, anchor);
        newCh[newStartIdx] = oldEndBlock;
        oldEndBlock = oldCh[--oldEndIdx];
        newStartBlock = newCh[++newStartIdx];
      }
      // -------------------------------------------------------------------
      else {
        mapping = mapping || createMapping(oldCh, oldStartIdx, oldEndIdx);
        let idxInOld = mapping[newStartBlock.key];
        if (idxInOld === undefined) {
          mountBefore(newStartBlock, oldStartBlock.el || (firstChildNode(oldStartBlock)! as any));
        } else {
          const elmToMove = oldCh[idxInOld];
          moveBefore(elmToMove, oldStartBlock.el || (firstChildNode(oldStartBlock) as any));
          patch(elmToMove, newStartBlock);
          newCh[newStartIdx] = elmToMove;
          oldCh[idxInOld] = null as any;
        }
        newStartBlock = newCh[++newStartIdx];
      }
    }
    // ---------------------------------------------------------------------
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      if (oldStartIdx > oldEndIdx) {
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.el || firstChildNode(nextChild)! : _anchor;
        for (let i = newStartIdx; i <= newEndIdx; i++) {
          mountBefore(newCh[i], anchor as any);
        }
      } else {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
          let ch = oldCh[i];
          if (ch) {
            if (noFullRemove) {
              // remove(ch);
              removeBlock(ch);
            } else {
              removeBlock(ch);
            }
          }
        }
      }
    }
    block1.content = newCh;
  },
  moveBefore(block: any, anchor: any) {
    // todo
  },
  remove(block: any) {
    const { isOnlyChild, anchor } = block.data;
    if (isOnlyChild) {
      anchor!.parentElement!.textContent = "";
    } else {
      const children = block.content;
      const l = children.length;
      if (l) {
        const removeBlock = children[0].ops.remove;
        for (let i = 0; i < l; i++) {
          removeBlock(children[i]);
        }
      }
      anchor!.remove();
    }
  },
  firstChildNode(block: any): ChildNode | null {
    const first = block.content[0];
    return first ? first.el || first.ops.firstChildNode(first) : null;
  },
};

function createMapping(
  oldCh: any[],
  oldStartIdx: number,
  oldEndIdx: number
): { [key: string]: any } {
  let mapping: any = {};
  for (let i = oldStartIdx; i <= oldEndIdx; i++) {
    mapping[oldCh[i].key] = i;
  }
  return mapping;
}
