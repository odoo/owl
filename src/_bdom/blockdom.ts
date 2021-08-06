import {
  Block,
  BLOCK_TYPE,
  Builder,
  Anchor,
  BlockElement,
  BlockMulti,
  BlockList,
  BlockText,
} from "./types";

// -----------------------------------------------------------------------------
//  Factories
// -----------------------------------------------------------------------------

export function text(text: string): BlockText {
  return {
    type: BLOCK_TYPE.Text,
    el: undefined,
    key: undefined,
    data: text,
    content: undefined,
  };
}

export function elem(builder: Builder, data: any[] = [], children: Block[] = []): BlockElement {
  return {
    type: BLOCK_TYPE.Element,
    el: undefined,
    key: undefined,
    data: { builder, data },
    content: children,
  };
}

export function multi(blocks: (Block | undefined)[]): BlockMulti {
  return {
    type: BLOCK_TYPE.Multi,
    el: undefined,
    key: undefined,
    data: undefined,
    content: blocks,
  };
}

export function list(
  blocks: Block[],
  isOnlyChild: boolean = false,
  hasNoComponent: boolean = false
): BlockList {
  return {
    type: BLOCK_TYPE.List,
    el: undefined,
    key: undefined,
    data: { anchor: undefined, isOnlyChild, hasNoComponent },
    content: blocks,
  };
}
// -----------------------------------------------------------------------------
//  BDom manipulation
// -----------------------------------------------------------------------------

export function mountBefore(block: Block, anchor: Anchor) {
  switch (block.type) {
    case BLOCK_TYPE.Text:
      {
        let el = document.createTextNode(block.data);
        block.el = el;
        anchor.before(el);
      }
      break;
    case BLOCK_TYPE.Element:
      {
        const data = block.data;
        const builder = new data.builder(data, block.content);
        data.builder = builder;
        const el = builder.el;
        anchor.before(el);
        block.el = el;
      }
      break;
    case BLOCK_TYPE.Multi:
      {
        const children = block.content;
        const anchors = new Array(children.length);
        for (let i = 0, l = children.length; i < l; i++) {
          let child = children[i];
          const childAnchor = document.createTextNode("");
          anchor.before(childAnchor);
          anchors![i] = childAnchor;
          if (child) {
            mountBefore(child, childAnchor);
          }
        }
        block.data = anchors;
      }
      break;
    case BLOCK_TYPE.List: {
      const children = block.content;
      const _anchor = document.createTextNode("");
      block.data.anchor = _anchor;
      anchor.before(_anchor);
      for (let i = 0, l = children.length; i < l; i++) {
        mountBefore(children[i], _anchor);
      }
    }
  }
}

function moveBefore(block: Block, anchor: Anchor | ChildNode) {
  switch (block.type) {
    case BLOCK_TYPE.Text:
      {
        anchor.before(block.el!);
      }
      break;
    case BLOCK_TYPE.Element:
      {
        anchor.before(block.el!);
      }
      break;
    case BLOCK_TYPE.Multi:
      {
        // console.warn('movebefore', block, (anchor as any).innerHTML)
        const children = block.content;
        const anchors = block.data!;
        for (let i = 0, l = children.length; i < l; i++) {
          let child = children[i];
          let _anchor = anchors[i];
          // console.warn(child!.el!.nextSibling === _anchor)
          // console.warn('c', child)
          anchor.before(_anchor);
          if (child) {
            moveBefore(child, _anchor);
          }
        }
      }
      break;
    case BLOCK_TYPE.List: {
      // const children = block.content;
      // const _anchor = document.createTextNode("");
      // block.data.anchor = _anchor;
      // anchor.before(_anchor);
      // for (let i = 0, l = children.length; i < l; i++) {
      //   mountBefore(children[i], _anchor);
      // }
    }
  }
}

export function removeBlock(block: Block) {
  switch (block.type) {
    case BLOCK_TYPE.Text:
    case BLOCK_TYPE.Element:
      block.el!.remove();
      break;
    case BLOCK_TYPE.Multi:
      {
        const children = block.content;
        const anchors = block.data;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child) {
            remove(child);
          }
          anchors![i].remove();
        }
      }
      break;
    case BLOCK_TYPE.List: {
      const { isOnlyChild, anchor } = block.data;
      if (isOnlyChild) {
        anchor!.parentElement!.textContent = "";
      } else {
        const children = block.content;
        for (let i = 0, l = children.length; i < l; i++) {
          removeBlock(children[i]);
        }
        anchor!.remove();
      }
    }
  }
}

export function beforeRemove(block: Block) {}

// -----------------------------------------------------------------------------
//  BDom main entry points
// -----------------------------------------------------------------------------

export function mount(block: Block, target: HTMLElement) {
  const anchor = document.createTextNode("");
  target.appendChild(anchor);
  mountBefore(block, anchor);
  anchor.remove();
}

export function patch(block1: Block, block2: Block) {
  switch (block1.type) {
    case BLOCK_TYPE.Text:
      {
        let text = block2.data as any;
        if (block1.data !== text) {
          block1.data = text;
          block1.el!.textContent = text;
        }
      }
      break;
    case BLOCK_TYPE.Element:
      (block1 as any).data.builder.update((block2 as any).data, block2.content);
      break;
    case BLOCK_TYPE.Multi:
      {
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
            mountBefore(newBlock, anchors[i]);
          }
        }
        // block1.content = block2.content!;
      }
      break;
    case BLOCK_TYPE.List:
      {
        const oldCh = block1.content;
        const newCh: Block[] = (block2 as any).content;
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

        // console.warn('oldch', oldCh[0].content)
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
          // console.warn('iteration', oldStartIdx, oldEndIdx, newStartIdx, newEndIdx);
          // -------------------------------------------------------------------
          if (oldStartBlock === null) {
            // todo: comment this and check it is useful
            oldStartBlock = oldCh[++oldStartIdx];
          }
          // -------------------------------------------------------------------
          else if (oldEndBlock === null) {
            oldEndBlock = oldCh[--oldEndIdx];
          }
          // -------------------------------------------------------------------
          else if (newStartBlock === null) {
            // todo: understand why these 2 next elseifs are useful
            newStartBlock = newCh[++newStartIdx];
          }
          // -------------------------------------------------------------------
          else if (newEndBlock === null) {
            newEndBlock = newCh[--newEndIdx];
          }
          // -------------------------------------------------------------------
          else if (oldStartBlock.key === newStartBlock.key) {
            // console.warn('same start', oldStartBlock, newStartBlock);
            patch(oldStartBlock, newStartBlock);
            newCh[newStartIdx] = oldStartBlock;
            oldStartBlock = oldCh[++oldStartIdx];
            newStartBlock = newCh[++newStartIdx];
          }
          // -------------------------------------------------------------------
          else if (oldEndBlock.key === newEndBlock.key) {
            // console.warn('same end');
            patch(oldEndBlock, newEndBlock);
            // console.warn('oeb', oldEndBlock)
            newCh[newEndIdx] = oldEndBlock;
            // console.warn(newCh[newEndIdx])
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
            // console.warn('in else')
            mapping = mapping || createMapping(oldCh, oldStartIdx, oldEndIdx);
            // console.warn('mapping', mapping)
            let idxInOld = mapping[newStartBlock.key];
            if (idxInOld === undefined) {
              // new element
              mountBefore(
                newStartBlock,
                oldStartBlock.el || (firstChildNode(oldStartBlock)! as any)
              );
              // console.log(document.body.innerHTML)
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
        // console.warn('after')
        if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
          if (oldStartIdx > oldEndIdx) {
            const nextChild = newCh[newEndIdx + 1];
            // console.warn('next', nextChild)
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
      }
      break;
  }
}

function firstChildNode(block: Block): ChildNode | null {
  switch (block.type) {
    case BLOCK_TYPE.Multi:
      {
        const children = block.content;
        for (let i = 0, l = children.length; i < l; i++) {
          const child = children[i];
          if (child) {
            return child.el || firstChildNode(child);
          }
        }
      }
      break;
    case BLOCK_TYPE.List: {
      const first = block.content[0];
      return first ? first.el || firstChildNode(first) : null;
    }
  }
  return null;
}

export function remove(block: Block) {
  beforeRemove(block);
  removeBlock(block);
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
