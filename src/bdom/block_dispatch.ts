import { Block } from "./block";

/**
 * Block Dispatch
 *
 * Most of the time, we can assume that we deal with something having a given
 * structure, even if we do not know exactly what it is. For example, multiple
 * consecutive execution of t-call="sometemplate" lead to a unknown bdom, but
 * each of them with the same structure.
 *
 * However, in some dynamic cases, it is not even possible to guarantee that two
 * consecutive calls will have the same shape: for example, a dynamic t-call
 * such as t-call="{{someTemplate}}" or a t-slot="{{dynamicSlot}}" can lead to
 * two arbitrary different structure.  In those case, we can use the BDispatch
 * block to make the transition.
 */

export class BDispatch extends Block {
  child: Block;
  key: string;
  anchor: ChildNode = document.createTextNode("");

  constructor(key: string, child: Block) {
    super();
    this.key = key;
    this.child = child;
  }

  firstChildNode(): ChildNode | null {
    return this.child.firstChildNode();
  }

  mountBefore(anchor: ChildNode) {
    const _anchor = this.anchor;
    anchor.before(_anchor);
    this.child.mountBefore(_anchor);
  }

  moveBefore(anchor: ChildNode) {
    const _anchor = this.anchor;
    anchor.before(_anchor);
    this.child.moveBefore(_anchor);
  }

  patch(newTree: BDispatch) {
    if (newTree.key === this.key) {
      this.child.patch(newTree.child);
    } else {
      this.child.fullRemove();
      this.child = newTree.child;
      this.key = newTree.key;
      this.child.mountBefore(this.anchor!);
    }
  }

  beforeRemove() {
    this.child.beforeRemove();
  }

  remove() {
    this.child.remove();
  }

  toString(): string {
    return this.child.toString();
  }
}
