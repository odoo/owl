import {
  Block,
  Builder,
  Anchor,
  BlockElement,
  BlockMulti,
  BlockList,
  BlockText,
  Operations,
} from "./types";

// -----------------------------------------------------------------------------
//  Text blocks
// -----------------------------------------------------------------------------

export function text(text: string): BlockText {
  return {
    ops: TEXT_OPS,
    el: undefined,
    key: undefined,
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

// -----------------------------------------------------------------------------
//  Multi blocks
// -----------------------------------------------------------------------------

export function multi(blocks: (Block | undefined)[]): BlockMulti {
  return {
    ops: MULTI_BLOCK_OPS,
    el: undefined,
    key: undefined,
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
          patch(block, newBlock);
        } else {
          children[i] = undefined;
          remove(block);
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
        remove(child);
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

// -----------------------------------------------------------------------------
//  Element blocks
// -----------------------------------------------------------------------------

export function elem(builder: Builder, data: any[] = [], children: Block[] = []): BlockElement {
  return {
    ops: ELEMENT_OPS,
    el: undefined,
    key: undefined,
    data: { builder, data },
    content: children,
  };
}

const ELEMENT_OPS: Operations = {
  mountBefore(block: any, anchor: Anchor) {
    const data = block.data;
    const builder = new data.builder(data, block.content);
    data.builder = builder;
    const el = builder.el;
    anchor.before(el);
    block.el = el;
  },
  patch(block1: any, block2: any) {
    if (block1 === block2) {
      return;
    }
    (block1 as any).data.builder.update((block2 as any).data, block2.content);
  },
  moveBefore(block: any, anchor: any) {
    anchor.before(block.el!);
  },
  remove(block: any) {
    const el = block.el!;
    el.parentElement!.removeChild(el);
  },
  firstChildNode(block: any): ChildNode | null {
    return block.el;
  },
};

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
    const { firstChildNode, moveBefore, mountBefore, remove: removeBlock } = ops;

    const data = block1.data;
    const _anchor = data.anchor!;

    // fast path
    if (newCh.length === 0 && data.isOnlyChild) {
      if (!data.hasNoComponent) {
        for (let i = 0; i < oldCh.length; i++) {
          beforeRemove(oldCh[i]);
        }
      }

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
              remove(ch);
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

export function beforeRemove(block: Block) {}

// -----------------------------------------------------------------------------
//  BDom main entry points
// -----------------------------------------------------------------------------

export function mount(block: Block, target: HTMLElement) {
  const anchor = document.createTextNode("");
  target.appendChild(anchor);
  block.ops.mountBefore(block, anchor);
  anchor.remove();
}

export function patch(block1: Block, block2: Block) {
  block1.ops.patch(block1, block2);
}

export function remove(block: Block) {
  beforeRemove(block);
  block.ops.remove(block);
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
