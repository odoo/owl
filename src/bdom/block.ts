// -----------------------------------------------------------------------------
//  Block
// -----------------------------------------------------------------------------

export abstract class Block {
  el: ChildNode | null | null = null;

  abstract firstChildNode(): ChildNode | null;

  // mount operations
  // ----------------------------
  mount(parent: HTMLElement) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.mountBefore(anchor);
    anchor.remove();
  }

  abstract mountBefore(anchor: ChildNode): void;

  // update operations
  // ----------------------------

  /**
   * A key point is that a block of a given type is always patched with a block
   * of the same type
   */
  abstract patch(other: Block): void;

  abstract moveBefore(anchor: ChildNode): void;

  // remove operations
  // ----------------------------
  beforeRemove() {}

  abstract remove(): void;

  fullRemove() {
    this.beforeRemove();
    this.remove();
  }
}
