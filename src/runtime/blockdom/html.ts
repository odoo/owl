import type { VNode } from "./index";

const nodeProto = Node.prototype;

const nodeInsertBefore = nodeProto.insertBefore;
const nodeRemoveChild = nodeProto.removeChild;

class VHtml {
  html: string;
  parentEl?: HTMLElement | undefined;
  content: ChildNode[] = [];

  constructor(html: string) {
    this.html = html;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
    const template = document.createElement("template");
    template.innerHTML = this.html;
    this.content = [...(template.content.childNodes as any)];
    for (let elem of this.content) {
      nodeInsertBefore.call(parent, elem, afterNode);
    }
    if (!this.content.length) {
      const textNode = document.createTextNode("");
      this.content.push(textNode);
      nodeInsertBefore.call(parent, textNode, afterNode);
    }
  }

  moveBeforeDOMNode(node: Node | null) {
    const parent = this.parentEl;
    for (let elem of this.content) {
      nodeInsertBefore.call(parent, elem, node);
    }
  }

  moveBeforeVNode(other: VHtml | null, afterNode: Node | null) {
    const target = other ? other.content[0] : afterNode;
    this.moveBeforeDOMNode(target);
  }

  patch(other: VHtml) {
    if (this === other) {
      return;
    }
    const html2 = other.html;
    if (this.html !== html2) {
      const parent = this.parentEl;
      // insert new html in front of current
      const afterNode = this.content[0];
      const template = document.createElement("template");
      template.innerHTML = html2;
      const content = [...(template.content.childNodes as any)];
      for (let elem of content) {
        nodeInsertBefore.call(parent, elem, afterNode);
      }
      if (!content.length) {
        const textNode = document.createTextNode("");
        content.push(textNode);
        nodeInsertBefore.call(parent, textNode, afterNode);
      }

      // remove current content
      this.remove();
      this.content = content;
      this.html = other.html;
    }
  }

  beforeRemove() {}

  remove() {
    const parent = this.parentEl;
    for (let elem of this.content) {
      nodeRemoveChild.call(parent, elem);
    }
  }

  firstNode(): Node {
    return this.content[0]!;
  }

  toString() {
    return this.html;
  }
}

export function html(str: string): VNode<VHtml> {
  return new VHtml(str);
}
