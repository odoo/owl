import { Anchor, Block } from "./types";

export interface BlockList extends Block<BlockList> {
  blocks: Block[];
  isOnlyChild: boolean;
  hasNoComponent: boolean;
  anchor: any;
}

// -----------------------------------------------------------------------------
//  List blocks
// -----------------------------------------------------------------------------

export function list(
  blocks: Block[],
  isOnlyChild: boolean = false,
  hasNoComponent: boolean = false
): BlockList {
  return new BList(blocks, isOnlyChild, hasNoComponent);
}

export class BList implements Block<BlockList> {
  blocks: Block[];
  isOnlyChild: boolean;
  hasNoComponent: boolean;
  anchor: any;

  constructor(blocks: Block[], isOnlyChild: boolean, hasNoComponent: boolean) {
    this.blocks = blocks;
    this.isOnlyChild = isOnlyChild;
    this.hasNoComponent = hasNoComponent;
    this.anchor = undefined;
  }

  mountBefore(anchor: Anchor) {
    const children = this.blocks;
    const _anchor = document.createTextNode("");
    this.anchor = _anchor;
    anchor.before(_anchor);
    const l = children.length;
    if (l) {
      for (let i = 0; i < l; i++) {
        children[i].mountBefore(_anchor);
      }
    }
  }

  patch(block: BList) {
    if (this === block) {
      return;
    }
    const oldCh = this.blocks;
    const newCh: Block[] = block.blocks;
    if (newCh.length === 0 && oldCh.length === 0) {
      return;
    }

    const _anchor = this.anchor!;
    const isOnlyChild = this.isOnlyChild;

    // fast path: no new child => only remove
    if (newCh.length === 0 && isOnlyChild) {
      // if (!data.hasNoComponent) {
      //   for (let i = 0; i < oldCh.length; i++) {
      //     beforeRemove(oldCh[i]);
      //   }
      // }

      const parent = _anchor.parentElement!;
      parent.textContent = "";
      parent.appendChild(_anchor);
      this.blocks = newCh;
      return;
    }

    // fast path: only new child and isonlychild => can use fragment
    // if (oldCh.length === 0 && isOnlyChild) {
    //   const frag = document.createDocumentFragment();
    //   const parent = _anchor.parentElement!;
    //   frag.appendChild(_anchor);
    //   for (let i = 0, l = newCh.length; i < l; i++) {
    //     newCh[i].mountBefore(_anchor);
    //   }
    //   parent.appendChild(frag);
    //   parent.appendChild(_anchor);
    //   this.blocks = newCh;
    //   return;
    // }

    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldStartBlock = oldCh[0];
    let newStartBlock = newCh[0];

    let oldEndIdx = oldCh.length - 1;
    let newEndIdx = newCh.length - 1;
    let oldEndBlock = oldCh[oldEndIdx];
    let newEndBlock = newCh[newEndIdx];

    let mapping: any = undefined;
    let noFullRemove = this.hasNoComponent;

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
        oldStartBlock.patch(newStartBlock);
        newCh[newStartIdx] = oldStartBlock;
        oldStartBlock = oldCh[++oldStartIdx];
        newStartBlock = newCh[++newStartIdx];
      }
      // -------------------------------------------------------------------
      else if (oldEndBlock.key === newEndBlock.key) {
        oldEndBlock.patch(newEndBlock);
        newCh[newEndIdx] = oldEndBlock;
        oldEndBlock = oldCh[--oldEndIdx];
        newEndBlock = newCh[--newEndIdx];
      }
      // -------------------------------------------------------------------
      else if (oldStartBlock.key === newEndBlock.key) {
        // bnode moved right
        oldStartBlock.patch(newEndBlock);
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.el || nextChild.firstChildNode()! : _anchor;
        oldStartBlock.moveBefore(anchor);
        newCh[newEndIdx] = oldStartBlock;
        oldStartBlock = oldCh[++oldStartIdx];
        newEndBlock = newCh[--newEndIdx];
      }
      // -------------------------------------------------------------------
      else if (oldEndBlock.key === newStartBlock.key) {
        // bnode moved left
        oldEndBlock.patch(newStartBlock);
        const nextChild = oldCh[oldStartIdx];
        const anchor = nextChild ? nextChild.el || nextChild.firstChildNode()! : _anchor;
        oldEndBlock.moveBefore(anchor);
        newCh[newStartIdx] = oldEndBlock;
        oldEndBlock = oldCh[--oldEndIdx];
        newStartBlock = newCh[++newStartIdx];
      }
      // -------------------------------------------------------------------
      else {
        mapping = mapping || createMapping(oldCh, oldStartIdx, oldEndIdx);
        let idxInOld = mapping[newStartBlock.key];
        if (idxInOld === undefined) {
          newStartBlock.mountBefore(oldStartBlock.el || (oldStartBlock.firstChildNode()! as any));
        } else {
          const elmToMove = oldCh[idxInOld];
          elmToMove.moveBefore(oldStartBlock.el || (oldStartBlock.firstChildNode() as any));
          elmToMove.patch(newStartBlock);
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
        const anchor = nextChild ? nextChild.el || nextChild.firstChildNode()! : _anchor;
        for (let i = newStartIdx; i <= newEndIdx; i++) {
          newCh[i].mountBefore(anchor as any);
        }
      } else {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
          let ch = oldCh[i];
          if (ch) {
            if (noFullRemove) {
              // remove(ch);
              ch.remove();
            } else {
              ch.remove();
            }
          }
        }
      }
    }
    this.blocks = newCh;
  }
  moveBefore(anchor: any) {
    // todo
  }
  remove() {
    const { isOnlyChild, anchor } = this;
    if (isOnlyChild) {
      anchor!.parentElement!.textContent = "";
    } else {
      const children = this.blocks;
      const l = children.length;
      if (l) {
        for (let i = 0; i < l; i++) {
          children[i].remove();
        }
      }
      anchor!.remove();
    }
  }
  firstChildNode(): ChildNode | null {
    const first = this.blocks[0];
    return first ? first.el || first.firstChildNode() : null;
  }
}

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
