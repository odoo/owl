import type { VNode } from "./index";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;
const characterDataProto = CharacterData.prototype;

const nodeInsertBefore = nodeProto.insertBefore;
const characterDataSetData = getDescriptor(characterDataProto, "data").set!;
const nodeRemoveChild = nodeProto.removeChild;

abstract class VSimpleNode {
  text: string | String;
  parentEl?: HTMLElement | undefined;
  el?: any;

  constructor(text: string | String) {
    this.text = text;
  }

  mountNode(node: Node, parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
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

  toString() {
    return this.text;
  }
}

class VText extends VSimpleNode {
  mount(parent: HTMLElement, afterNode: Node | null) {
    this.mountNode(document.createTextNode(toText(this.text)), parent, afterNode);
  }

  patch(other: VText) {
    const text2 = other.text;
    if (this.text !== text2) {
      characterDataSetData.call(this.el!, toText(text2));
      this.text = text2;
    }
  }
}

class VComment extends VSimpleNode {
  mount(parent: HTMLElement, afterNode: Node | null) {
    this.mountNode(document.createComment(toText(this.text)), parent, afterNode);
  }

  patch() {}
}

export function text(str: string | String): VNode<VText> {
  return new VText(str);
}

export function comment(str: string): VNode<VComment> {
  return new VComment(str);
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
