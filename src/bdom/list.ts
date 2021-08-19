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
  singleNode?: boolean | undefined;
  withBeforeRemove: boolean;

  constructor(children: VNode[], withBeforeRemove: boolean) {
    this.children = children;
    this.withBeforeRemove = withBeforeRemove;
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

  moveBefore(other: VList | null, afterNode: Node | null) {
    // todo
  }

  patch(other: VList) {
    if (this === other) {
      return;
    }
    const ch1 = this.children;
    const ch2: VNode[] = other.children;
    if (ch2.length === 0 && ch1.length === 0) {
      return;
    }
    const proto = ch2[0] || ch1[0];
    const { mount: childMount, patch: childPatch, remove: childRemove, beforeRemove } = proto;

    const _anchor = this.anchor!;
    const isOnlyChild = this.singleNode;
    const withBeforeRemove = this.withBeforeRemove;
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
      this.children = ch2;
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
    // let noFullRemove = this.hasNoComponent;

    while (startIdx1 <= endIdx1 && startIdx2 <= endIdx2) {
      // -------------------------------------------------------------------
      if (startVn1 === null) {
        startVn1 = ch1[++startIdx1];
      }
      // -------------------------------------------------------------------
      else if (endVn1 === null) {
        endVn1 = ch1[--endIdx1];
      }
      // -------------------------------------------------------------------
      else if (startVn1.key === startVn2.key) {
        if (startVn1 !== startVn2) childPatch.call(startVn1, startVn2);
        ch2[startIdx2] = startVn1;
        startVn1 = ch1[++startIdx1];
        startVn2 = ch2[++startIdx2];
      }
      // -------------------------------------------------------------------
      else if (endVn1.key === endVn2.key) {
        if (endVn1 !== endVn2) childPatch.call(endVn1, endVn2);
        ch2[endIdx2] = endVn1;
        endVn1 = ch1[--endIdx1];
        endVn2 = ch2[--endIdx2];
      }
      // -------------------------------------------------------------------
      else if (startVn1.key === endVn2.key) {
        // bnode moved right
        if (startVn1 !== endVn2) childPatch.call(startVn1, endVn2);
        const nextChild = ch2[endIdx2 + 1];
        startVn1.moveBefore(nextChild, _anchor);
        ch2[endIdx2] = startVn1;
        startVn1 = ch1[++startIdx1];
        endVn2 = ch2[--endIdx2];
      }
      // -------------------------------------------------------------------
      else if (endVn1.key === startVn2.key) {
        // bnode moved left
        if (endVn1 !== startVn2) childPatch.call(endVn1, startVn2);
        const nextChild = ch1[startIdx1];
        endVn1.moveBefore(nextChild, _anchor);
        ch2[startIdx2] = endVn1;
        endVn1 = ch1[--endIdx1];
        startVn2 = ch2[++startIdx2];
      }
      // -------------------------------------------------------------------
      else {
        mapping = mapping || createMapping(ch1, startIdx1, endIdx1);
        let idxInOld = mapping[startVn2.key];
        if (idxInOld === undefined) {
          childMount.call(startVn2, parent, startVn1.firstNode() || null);
        } else {
          const elmToMove = ch1[idxInOld];
          elmToMove.moveBefore(startVn1, null);
          childPatch.call(elmToMove, startVn2);
          ch2[startIdx2] = elmToMove;
          ch1[idxInOld] = null as any;
        }
        startVn2 = ch2[++startIdx2];
      }
    }
    // ---------------------------------------------------------------------
    if (startIdx1 <= endIdx1 || startIdx2 <= endIdx2) {
      if (startIdx1 > endIdx1) {
        const nextChild = ch2[endIdx2 + 1];
        const anchor = nextChild ? nextChild.firstNode() || null : _anchor;
        const mount = proto.mount;
        for (let i = startIdx2; i <= endIdx2; i++) {
          mount.call(ch2[i], parent, anchor);
        }
      } else {
        for (let i = startIdx1; i <= endIdx1; i++) {
          let ch = ch1[i];
          if (ch) {
            if (withBeforeRemove) {
              beforeRemove.call(ch);
            }
            childRemove.call(ch);
          }
        }
      }
    }
    this.children = ch2;
  }

  beforeRemove() {
    if (this.withBeforeRemove) {
      const children = this.children;
      const l = children.length;
      if (l) {
        const beforeRemove = children[0].beforeRemove;
        for (let i = 0; i < l; i++) {
          beforeRemove.call(children[i]);
        }
      }
    }
  }

  remove() {
    const { parentEl, anchor } = this;
    if (this.singleNode) {
      nodeSetTextContent.call(parentEl, "");
    } else {
      const children = this.children;
      const l = children.length;
      if (l) {
        for (let i = 0; i < l; i++) {
          children[i].remove();
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

export function list(children: VNode[], withBeforeRemove: boolean = false): VNode<VList> {
  return new VList(children, withBeforeRemove);
}

function createMapping(ch1: any[], startIdx1: number, endIdx2: number): { [key: string]: any } {
  let mapping: any = {};
  for (let i = startIdx1; i <= endIdx2; i++) {
    mapping[ch1[i].key] = i;
  }
  return mapping;
}
