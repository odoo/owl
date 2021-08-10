export interface Operations {
  mountBefore(block: any, anchor: any): void;
  patch(block1: any, block2: any): void;
  moveBefore(block: any, anchor: any): void;
  remove(block: any): void;
  firstChildNode(block: any): ChildNode | null;
}

// Text
export interface BlockText {
  ops: Operations;
  el: Text | undefined;
  key: any | undefined;
  data: string;
  content: undefined;
}

// Elem

export type Builder = any;

export interface ElemData {
  builder: Builder;
  data: any[];
  //   handlers?: [object, string][]
  //   refs: (HTMLElement | Text)[]
}

export interface BlockElement {
  ops: Operations;
  el: HTMLElement | undefined;
  key: any | undefined;
  data: ElemData;
  content: undefined | Block[];
}

// Multi
export interface BlockMulti {
  ops: Operations;
  el: undefined;
  key: any | undefined;
  data: Anchor[] | undefined;
  content: (Block | undefined)[];
}

// List
export interface BlockList {
  ops: Operations;
  el: undefined;
  key: any | undefined;
  data: { anchor: Anchor | undefined; isOnlyChild: boolean; hasNoComponent: boolean };
  content: Block[];
}

export type Block = BlockText | BlockElement | BlockMulti | BlockList;

export type Anchor = Text;
