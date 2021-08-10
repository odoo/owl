import type { VNode } from "./index";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;
const characterDataProto = CharacterData.prototype;

const nodeInsertBefore = nodeProto.insertBefore;
const characterDataSetData = getDescriptor(characterDataProto, "data").set!;
const nodeRemoveChild = nodeProto.removeChild;

class VText {
  text: string;
  parentEl?: HTMLElement | undefined;
  el?: Text;

  constructor(text: string) {
    this.text = text;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
    const node = document.createTextNode(this.text);
    nodeInsertBefore.call(parent, node, afterNode);
    this.el = node;
  }

  moveBefore(other: VText | null, afterNode: Node | null) {
    const target = other ? other.el! : afterNode;
    nodeInsertBefore.call(this.parentEl, this.el!, target);
  }

  patch(other: VText) {
    const text2 = other.text;
    if (this.text !== text2) {
      characterDataSetData.call(this.el, text2);
    }
  }

  remove() {
    nodeRemoveChild.call(this.parentEl, this.el!);
  }

  firstNode(): Node {
    return this.el!;
  }
}

export function text(str: string): VNode<VText> {
  return new VText(str);
}
