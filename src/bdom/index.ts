export { toggler } from "./toggler";
export { createBlock } from "./block";
export { list } from "./list";
export { multi } from "./multi";
export { text } from "./text";
export { html } from "./html";

export interface VNode<T = any> {
  mount(parent: HTMLElement, afterNode: Node | null): void;
  moveBefore(other: T | null, afterNode: Node | null): void;
  patch(other: T): void;
  remove(): void;
  firstNode(): Node | undefined;

  el?: undefined | HTMLElement | Text;
  parentEl?: undefined | HTMLElement;
  singleNode?: boolean | undefined;
  key?: any;
}

export type BDom = VNode<any>;

export function mount(vnode: VNode, fixture: HTMLElement) {
  vnode.mount(fixture, null);
}

export function patch(vnode1: VNode, vnode2: VNode) {
  vnode1.patch(vnode2);
}

export function remove(vnode: VNode) {
  vnode.remove();
}
