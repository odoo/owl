import type { VNode } from "./index";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;

const nodeInsertBefore = nodeProto.insertBefore;
const nodeAppendChild = nodeProto.appendChild;
const nodeRemoveChild = nodeProto.removeChild;
const nodeSetTextContent = getDescriptor(nodeProto, "textContent").set!;

// -----------------------------------------------------------------------------
// List Node
// -----------------------------------------------------------------------------

class VList {
  children: VNode[];
  anchor: Node | undefined;
  parentEl?: HTMLElement | undefined;
  isOnlyChild?: boolean | undefined;

  constructor(children: VNode[]) {
    this.children = children;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    const children = this.children;
    const _anchor = document.createTextNode("");
    this.anchor = _anchor;
    nodeInsertBefore.call(parent, _anchor, afterNode);
    const l = children.length;
    if (l) {
      const mount = children[0].mount;
      for (let i = 0; i < l; i++) {
        mount.call(children[i], parent, _anchor);
      }
    }

    this.parentEl = parent;
  }

  moveBeforeDOMNode(node: Node | null) {
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].moveBeforeDOMNode(node);
    }
    this.parentEl!.insertBefore(this.anchor!, node);
  }

  moveBeforeVNode(other: VList | null, afterNode: Node | null) {
    if (other) {
      const next = other!.children[0];
      afterNode = (next ? next.firstNode() : other!.anchor) || null;
    }
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].moveBeforeVNode(null, afterNode);
    }
    this.parentEl!.insertBefore(this.anchor!, afterNode);
  }

  patch(other: VList, withBeforeRemove: boolean) {
    if (this === other) {
      return;
    }
    const ch1 = this.children;
    const ch2: VNode[] = other.children;
    if (ch2.length === 0 && ch1.length === 0) {
      return;
    }
    this.children = ch2;
    const proto = ch2[0] || ch1[0];
    const {
      mount: cMount,
      patch: cPatch,
      remove: cRemove,
      beforeRemove,
      moveBeforeVNode: cMoveBefore,
      firstNode: cFirstNode,
    } = proto;

    const _anchor = this.anchor!;
    const isOnlyChild = this.isOnlyChild;
    const parent = this.parentEl!;

    // fast path: no new child => only remove
    if (ch2.length === 0 && isOnlyChild) {
      if (withBeforeRemove) {
        for (let i = 0, l = ch1.length; i < l; i++) {
          beforeRemove.call(ch1[i]);
        }
      }

      nodeSetTextContent.call(parent, "");
      nodeAppendChild.call(parent, _anchor);
      return;
    }

    let startIdx1 = 0;
    let startIdx2 = 0;
    let startVn1 = ch1[0];
    let startVn2 = ch2[0];

    let endIdx1 = ch1.length - 1;
    let endIdx2 = ch2.length - 1;
    let endVn1 = ch1[endIdx1];
    let endVn2 = ch2[endIdx2];

    let mapping: any = undefined;

    while (startIdx1 <= endIdx1 && startIdx2 <= endIdx2) {
      // -------------------------------------------------------------------
      if (startVn1 === null) {
        startVn1 = ch1[++startIdx1];
        continue;
      }
      // -------------------------------------------------------------------
      if (endVn1 === null) {
        endVn1 = ch1[--endIdx1];
        continue;
      }
      // -------------------------------------------------------------------
      let startKey1 = startVn1.key;
      let startKey2 = startVn2.key;
      if (startKey1 === startKey2) {
        cPatch.call(startVn1, startVn2, withBeforeRemove);
        ch2[startIdx2] = startVn1;
        startVn1 = ch1[++startIdx1];
        startVn2 = ch2[++startIdx2];
        continue;
      }
      // -------------------------------------------------------------------
      let endKey1 = endVn1.key;
      let endKey2 = endVn2.key;
      if (endKey1 === endKey2) {
        cPatch.call(endVn1, endVn2, withBeforeRemove);
        ch2[endIdx2] = endVn1;
        endVn1 = ch1[--endIdx1];
        endVn2 = ch2[--endIdx2];
        continue;
      }
      // -------------------------------------------------------------------
      if (startKey1 === endKey2) {
        // bnode moved right
        cPatch.call(startVn1, endVn2, withBeforeRemove);
        ch2[endIdx2] = startVn1;
        const nextChild = ch2[endIdx2 + 1];
        cMoveBefore.call(startVn1, nextChild, _anchor);
        startVn1 = ch1[++startIdx1];
        endVn2 = ch2[--endIdx2];
        continue;
      }
      // -------------------------------------------------------------------
      if (endKey1 === startKey2) {
        // bnode moved left
        cPatch.call(endVn1, startVn2, withBeforeRemove);
        ch2[startIdx2] = endVn1;
        const nextChild = ch1[startIdx1];
        cMoveBefore.call(endVn1, nextChild, _anchor);
        endVn1 = ch1[--endIdx1];
        startVn2 = ch2[++startIdx2];
        continue;
      }
      // -------------------------------------------------------------------
      mapping = mapping || createMapping(ch1, startIdx1, endIdx1);
      let idxInOld = mapping[startKey2];
      if (idxInOld === undefined) {
        cMount.call(startVn2, parent, cFirstNode.call(startVn1) || null);
      } else {
        const elmToMove = ch1[idxInOld];
        cMoveBefore.call(elmToMove, startVn1, null);
        cPatch.call(elmToMove, startVn2, withBeforeRemove);
        ch2[startIdx2] = elmToMove;
        ch1[idxInOld] = null as any;
      }
      startVn2 = ch2[++startIdx2];
    }
    // ---------------------------------------------------------------------
    if (startIdx1 <= endIdx1 || startIdx2 <= endIdx2) {
      if (startIdx1 > endIdx1) {
        const nextChild = ch2[endIdx2 + 1];
        const anchor = nextChild ? cFirstNode.call(nextChild) || null : _anchor;
        for (let i = startIdx2; i <= endIdx2; i++) {
          cMount.call(ch2[i], parent, anchor);
        }
      } else {
        for (let i = startIdx1; i <= endIdx1; i++) {
          let ch = ch1[i];
          if (ch) {
            if (withBeforeRemove) {
              beforeRemove.call(ch);
            }
            cRemove.call(ch);
          }
        }
      }
    }
  }

  beforeRemove() {
    const children = this.children;
    const l = children.length;
    if (l) {
      const beforeRemove = children[0].beforeRemove;
      for (let i = 0; i < l; i++) {
        beforeRemove.call(children[i]);
      }
    }
  }

  remove() {
    const { parentEl, anchor } = this;
    if (this.isOnlyChild) {
      nodeSetTextContent.call(parentEl, "");
    } else {
      const children = this.children;
      const l = children.length;
      if (l) {
        const remove = children[0].remove;
        for (let i = 0; i < l; i++) {
          remove.call(children[i]);
        }
      }
      nodeRemoveChild.call(parentEl, anchor!);
    }
  }

  firstNode(): Node | undefined {
    const child = this.children[0];
    return child ? child.firstNode() : undefined;
  }

  toString(): string {
    return this.children.map((c) => c!.toString()).join("");
  }
}

export function list(children: VNode[]): VNode<VList> {
  return new VList(children);
}

function createMapping(ch1: any[], startIdx1: number, endIdx2: number): { [key: string]: any } {
  let mapping: any = {};
  for (let i = startIdx1; i <= endIdx2; i++) {
    mapping[ch1[i].key] = i;
  }
  return mapping;
}
