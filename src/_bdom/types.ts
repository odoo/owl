export const enum BLOCK_TYPE {
  Text,
  Element,
  Multi,
  List,
}

// Text
export interface BlockText {
  type: BLOCK_TYPE.Text;
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
  type: BLOCK_TYPE.Element;
  el: HTMLElement | undefined;
  key: any | undefined;
  data: ElemData;
  content: undefined | Block[];
}

// Multi
export interface BlockMulti {
  type: BLOCK_TYPE.Multi;
  el: undefined;
  key: any | undefined;
  data: Anchor[] | undefined;
  content: (Block | undefined)[];
}

// List
export interface BlockList {
  type: BLOCK_TYPE.List;
  el: undefined;
  key: any | undefined;
  data: { anchor: Anchor | undefined; isOnlyChild: boolean; hasNoComponent: boolean };
  content: Block[];
}

export type Block = BlockText | BlockElement | BlockMulti | BlockList;

export type Anchor = Text;
