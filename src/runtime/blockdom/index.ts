export { config } from "./config";

export { toggler } from "./toggler";
export { createBlock } from "./block_compiler";
export { list } from "./list";
export { multi } from "./multi";
export { text, comment } from "./text";
export { html } from "./html";
export { createCatcher } from "./event_catcher";

export interface VNode<T = any> {
  mount(parent: HTMLElement, afterNode: Node | null): void;
  moveBeforeDOMNode(node: Node | null, parent?: HTMLElement): void;
  moveBeforeVNode(other: T | null, afterNode: Node | null): void;
  patch(other: T, withBeforeRemove: boolean): void;
  beforeRemove(): void;
  remove(): void;
  firstNode(): Node | undefined;

  el?: undefined | HTMLElement | Text;
  parentEl?: undefined | HTMLElement;
  isOnlyChild?: boolean | undefined;
  key?: any;
}

export type BDom = VNode<any>;

export function mount(vnode: VNode, fixture: HTMLElement, afterNode: Node | null = null) {
  vnode.mount(fixture, afterNode);
}

export function patch(vnode1: VNode, vnode2: VNode, withBeforeRemove: boolean = false) {
  vnode1.patch(vnode2, withBeforeRemove);
}

export function remove(vnode: VNode, withBeforeRemove: boolean = false) {
  if (withBeforeRemove) {
    vnode.beforeRemove();
  }
  vnode.remove();
}

export function withKey(vnode: VNode, key: any) {
  vnode.key = key;
  return vnode;
}
