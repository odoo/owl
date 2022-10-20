import type { VNode } from "./index";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;
const nodeInsertBefore = nodeProto.insertBefore;
const nodeSetTextContent = getDescriptor(nodeProto, "textContent").set!;
const nodeRemoveChild = nodeProto.removeChild;

// -----------------------------------------------------------------------------
// Multi NODE
// -----------------------------------------------------------------------------

export class VMulti {
  children: (VNode | undefined)[];
  anchors?: Node[] | undefined;
  parentEl?: HTMLElement | undefined;
  isOnlyChild?: boolean | undefined;

  constructor(children: (VNode | undefined)[]) {
    this.children = children;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    const children = this.children;
    const l = children.length;
    const anchors = new Array(l);
    for (let i = 0; i < l; i++) {
      let child = children[i];
      if (child) {
        child.mount(parent, afterNode);
      } else {
        const childAnchor = document.createTextNode("");
        anchors[i] = childAnchor;
        nodeInsertBefore.call(parent, childAnchor, afterNode);
      }
    }
    this.anchors = anchors;
    this.parentEl = parent;
  }

  moveBeforeDOMNode(node: Node | null, parent = this.parentEl) {
    this.parentEl = parent;
    const children = this.children;
    const anchors = this.anchors;
    for (let i = 0, l = children.length; i < l; i++) {
      let child = children[i];
      if (child) {
        child.moveBeforeDOMNode(node, parent);
      } else {
        const anchor = anchors![i];
        nodeInsertBefore.call(parent, anchor, node);
      }
    }
  }

  moveBeforeVNode(other: VMulti | null, afterNode: Node | null) {
    if (other) {
      const next = other!.children[0];
      afterNode = (next ? next.firstNode() : other!.anchors![0]) || null;
    }
    const children = this.children;
    const parent = this.parentEl;
    const anchors = this.anchors;
    for (let i = 0, l = children.length; i < l; i++) {
      let child = children[i];
      if (child) {
        child.moveBeforeVNode(null, afterNode);
      } else {
        const anchor = anchors![i];
        nodeInsertBefore.call(parent, anchor, afterNode);
      }
    }
  }

  patch(other: VMulti, withBeforeRemove: boolean) {
    if (this === other) {
      return;
    }
    const children1 = this.children;
    const children2 = other.children;
    const anchors = this.anchors!;
    const parentEl = this.parentEl!;
    for (let i = 0, l = children1.length; i < l; i++) {
      const vn1 = children1[i];
      const vn2 = children2[i];
      if (vn1) {
        if (vn2) {
          vn1.patch(vn2, withBeforeRemove);
        } else {
          const afterNode = vn1.firstNode()!;
          const anchor = document.createTextNode("");
          anchors[i] = anchor;
          nodeInsertBefore.call(parentEl, anchor, afterNode);
          if (withBeforeRemove) {
            vn1.beforeRemove();
          }
          vn1.remove();
          children1[i] = undefined;
        }
      } else if (vn2) {
        children1[i] = vn2;
        const anchor = anchors[i];
        vn2.mount(parentEl, anchor);
        nodeRemoveChild.call(parentEl, anchor);
      }
    }
  }

  beforeRemove() {
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      if (child) {
        child.beforeRemove();
      }
    }
  }

  remove() {
    const parentEl = this.parentEl;
    if (this.isOnlyChild) {
      nodeSetTextContent.call(parentEl, "");
    } else {
      const children = this.children;
      const anchors = this.anchors;
      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];
        if (child) {
          child.remove();
        } else {
          nodeRemoveChild.call(parentEl, anchors![i]);
        }
      }
    }
  }

  firstNode(): Node | undefined {
    const child = this.children[0];
    return child ? child.firstNode() : this.anchors![0];
  }

  toString(): string {
    return this.children.map((c) => (c ? c!.toString() : "")).join("");
  }
}

export function multi(children: (VNode | undefined)[]): VNode<VMulti> {
  return new VMulti(children);
}
