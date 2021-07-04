// -----------------------------------------------------------------------------
//  Block
// -----------------------------------------------------------------------------

export abstract class Block {
  el: ChildNode | null | null = null;
  refs?: { [name: string]: HTMLElement };

  mount(parent: HTMLElement | DocumentFragment) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.mountBefore(anchor);
    anchor.remove();
  }

  abstract mountBefore(anchor: ChildNode): void;

  abstract patch(other: Block): void;

  abstract firstChildNode(): ChildNode | null;

  remove() {}

  move(parent: HTMLElement | DocumentFragment) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.moveBefore(anchor);
    anchor.remove();
  }

  moveBefore(anchor: ChildNode): void {
    this.mountBefore(anchor);
  }
}
