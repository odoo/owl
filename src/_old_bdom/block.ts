export interface Block<T = any> {
  el: ChildNode | null;

  firstChildNode(): ChildNode | null;

  mountBefore(anchor: ChildNode): void;

  patch(other: T): void;

  beforeRemove(): void;
  moveBefore(anchor: ChildNode): void;

  remove(): void;
}

export function mountBlock(block: Block, target: HTMLElement) {
  const anchor = document.createTextNode("");
  target.appendChild(anchor);
  block.mountBefore(anchor);
  anchor.remove();
}

export function removeBlock(block: Block) {
  block.beforeRemove();
  block.remove();
}
