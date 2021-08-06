// -----------------------------------------------------------------------------
//  Types
// -----------------------------------------------------------------------------

const enum BLOCK_TYPE {
  Text,
  Element,
  Multi,
}

interface BlockText {
  type: BLOCK_TYPE.Text;
  el: Text | undefined;
  data: string;
  content: undefined;
}

interface BlockMulti {
  type: BLOCK_TYPE.Multi;
  el: undefined;
  data: undefined;
  content: Block[];
}

type Block = BlockText | BlockMulti;

type Anchor = Text;

// -----------------------------------------------------------------------------
//  Factories
// -----------------------------------------------------------------------------

export function text(text: string): Block {
  return {
    type: BLOCK_TYPE.Text,
    el: undefined,
    data: text,
    content: undefined,
  };
}

export function multi(blocks: Block[]): Block {
  return {
    type: BLOCK_TYPE.Multi,
    el: undefined,
    data: undefined,
    content: blocks,
  };
}

// -----------------------------------------------------------------------------
//  BDom manipulation
// -----------------------------------------------------------------------------

export function mountBefore(block: Block, anchor: Anchor) {
  switch (block.type) {
    case BLOCK_TYPE.Text: {
      let el = document.createTextNode(block.data);
      block.el = el;
      anchor.before(el);
    }
  }
}

export function remove(block: Block) {
  switch (block.type) {
    case BLOCK_TYPE.Text:
      block.el!.remove();
  }
}

export function beforeRemove(block: Block) {}

export function mountBlock(block: Block, target: HTMLElement) {
  const anchor = document.createTextNode("");
  target.appendChild(anchor);
  mountBefore(block, anchor);
  anchor.remove();
}

export function removeBlock(block: Block) {
  beforeRemove(block);
  remove(block);
}
