import { Block } from "./block";

// -----------------------------------------------------------------------------
//  Collection Block
// -----------------------------------------------------------------------------

export class BCollection extends Block {
  children: Block[];
  anchor: ChildNode = document.createTextNode("");
  keys: (string | number)[];
  collection: any[];
  values: any[];

  constructor(collection: any[]) {
    super();
    let n: number;
    if (Array.isArray(collection)) {
      this.collection = collection;
      this.values = collection;
      n = collection.length;
    } else if (collection) {
      this.collection = Object.keys(collection);
      this.values = Object.values(collection);
      n = this.collection.length;
    } else {
      throw new Error("Invalid loop expression");
    }
    this.keys = new Array(n);
    this.children = new Array(n);
  }

  forEach(item: string, ctx: any, cb: Function) {
    const collection = this.collection;
    const values = this.values;
    ctx = Object.create(ctx);
    for (let i = 0; i < collection.length; i++) {
      ctx[item] = collection[i];
      ctx[item + "_first"] = i === 0;
      ctx[item + "_last"] = i === collection.length - 1;
      ctx[item + "_index"] = i;
      ctx[item + "_value"] = values[i];
      cb(i, ctx);
    }
  }

  firstChildNode(): ChildNode | null {
    return this.children.length ? this.children[0].firstChildNode() : null;
  }

  mountBefore(anchor: ChildNode) {
    const _anchor = this.anchor;
    anchor.before(_anchor);
    for (let child of this.children) {
      child.mountBefore(_anchor);
    }
  }

  moveBefore(anchor: ChildNode) {
    const _anchor = this.anchor;
    anchor.before(_anchor);
    for (let child of this.children) {
      child.moveBefore(_anchor);
    }
  }

  patch(other: BCollection) {
    const oldKeys = this.keys;
    const newKeys = other.keys;
    const oldCh = this.children;
    const newCh: Block[] = other.children;
    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let newEndIdx = newCh.length - 1;
    let mapping: any = undefined;
    const _anchor = this.anchor!;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (oldCh[oldStartIdx] === null) {
        oldStartIdx++;
      } else if (oldCh[oldEndIdx] === null) {
        oldEndIdx--;
      } else if (oldKeys[oldStartIdx] === newKeys[newStartIdx]) {
        oldCh[oldStartIdx].patch(newCh[newStartIdx]);
        newCh[newStartIdx] = oldCh[oldStartIdx];
        oldStartIdx++;
        newStartIdx++;
      } else if (oldKeys[oldEndIdx] === newKeys[newEndIdx]) {
        oldCh[oldEndIdx].patch(newCh[newEndIdx]);
        newCh[newEndIdx] = oldCh[oldEndIdx];
        oldEndIdx--;
        newEndIdx--;
      } else if (oldKeys[oldStartIdx] === newKeys[newEndIdx]) {
        // bnode moved right
        const elm = oldCh[oldStartIdx];
        elm.patch(newCh[newEndIdx]);
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.firstChildNode()! : _anchor;
        elm.moveBefore(anchor);
        newCh[newEndIdx] = elm;
        oldStartIdx++;
        newEndIdx--;
      } else if (oldKeys[oldEndIdx] === newKeys[newStartIdx]) {
        // bnode moved left
        const elm = oldCh[oldEndIdx];
        elm.patch(newCh[newStartIdx]);
        const nextChild = oldCh[oldStartIdx];
        const anchor = nextChild ? nextChild.firstChildNode()! : _anchor;
        elm.moveBefore(anchor);
        newCh[newStartIdx] = elm;
        oldEndIdx--;
        newStartIdx++;
      } else {
        mapping = mapping || createMapping(oldKeys, oldStartIdx, oldEndIdx);
        let idxInOld = mapping[newKeys[newStartIdx]];
        if (idxInOld === undefined) {
          // new element
          newCh[newStartIdx].mountBefore(oldCh[oldStartIdx].firstChildNode()!);
          newStartIdx++;
        } else {
          const elmToMove = oldCh[idxInOld];
          elmToMove.moveBefore(oldCh[oldStartIdx].firstChildNode()!);
          elmToMove.patch(newCh[newStartIdx]);
          newCh[newStartIdx] = elmToMove;
          oldCh[idxInOld] = null as any;
          newStartIdx++;
        }
      }
    }
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      if (oldStartIdx > oldEndIdx) {
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.firstChildNode()! : _anchor;
        for (let i = newStartIdx; i <= newEndIdx; i++) {
          newCh[i].mountBefore(anchor);
        }
      } else {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
          let ch = oldCh[i];
          if (ch) {
            ch.remove();
          }
        }
      }
    }
    this.children = newCh;
    this.keys = newKeys;
  }
}

function createMapping(
  oldKeys: any[],
  oldStartIdx: number,
  oldEndIdx: number
): { [key: string]: any } {
  let mapping: any = {};
  for (let i = oldStartIdx; i <= oldEndIdx; i++) {
    mapping[oldKeys[i]] = i;
  }
  return mapping;
}
