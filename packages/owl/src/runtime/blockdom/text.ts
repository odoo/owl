import type { VNode } from "./index";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
let nodeInsertBefore: typeof Node.prototype.insertBefore;
let characterDataSetData: (v: string) => void;
let nodeRemoveChild: typeof Node.prototype.removeChild;
if (typeof Node !== "undefined") {
  const nodeProto = Node.prototype;
  nodeInsertBefore = nodeProto.insertBefore;
  nodeRemoveChild = nodeProto.removeChild;
  characterDataSetData = getDescriptor(CharacterData.prototype, "data").set!;
}

class VText {
  text: string | String;
  parentEl?: HTMLElement | undefined;
  el?: any;

  constructor(text: string | String) {
    this.text = text;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
    const node = document.createTextNode(toText(this.text));
    nodeInsertBefore.call(parent, node, afterNode);
    this.el = node;
  }

  moveBeforeDOMNode(node: Node | null, parent = this.parentEl) {
    this.parentEl = parent;
    nodeInsertBefore.call(parent, this.el!, node);
  }

  moveBeforeVNode(other: VText | null, afterNode: Node | null) {
    nodeInsertBefore.call(this.parentEl, this.el!, other ? other.el! : afterNode);
  }

  beforeRemove() {}

  remove() {
    nodeRemoveChild.call(this.parentEl, this.el!);
  }

  firstNode(): Node {
    return this.el!;
  }

  patch(other: VText) {
    const text2 = other.text;
    if (this.text !== text2) {
      characterDataSetData.call(this.el!, toText(text2));
      this.text = text2;
    }
  }

  toString() {
    return this.text;
  }
}

export function text(str: string | String): VNode<VText> {
  return new VText(str);
}

export function toText(value: any): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return String(value);
    case "boolean":
      return value ? "true" : "false";
    default:
      return value || "";
  }
}
