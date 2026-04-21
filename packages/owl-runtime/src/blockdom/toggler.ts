import type { VNode } from "./index";

// -----------------------------------------------------------------------------
// Toggler node
// -----------------------------------------------------------------------------

const txt = document.createTextNode("");

class VToggler {
  key: string;
  child: VNode;

  parentEl?: HTMLElement | undefined;

  constructor(key: string, child: VNode) {
    this.key = key;
    this.child = child;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
    this.child.mount(parent, afterNode);
  }

  moveBeforeDOMNode(node: Node | null, parent?: HTMLElement) {
    this.child.moveBeforeDOMNode(node, parent);
  }

  moveBeforeVNode(other: VToggler | null, afterNode: Node | null) {
    this.moveBeforeDOMNode((other && other.firstNode()) || afterNode);
  }

  patch(other: VToggler, withBeforeRemove: boolean) {
    if (this === other) {
      return;
    }
    let child1 = this.child;
    let child2 = other.child;
    if (this.key === other.key) {
      child1.patch(child2, withBeforeRemove);
    } else {
      const firstNode = child1.firstNode()!;
      firstNode.parentElement!.insertBefore(txt, firstNode);
      if (withBeforeRemove) {
        child1.beforeRemove();
      }
      child1.remove();
      child2.mount(this.parentEl!, txt);
      this.child = child2;
      this.key = other.key;
    }
  }

  beforeRemove() {
    this.child.beforeRemove();
  }

  remove() {
    this.child.remove();
  }

  firstNode(): Node | undefined {
    return this.child.firstNode();
  }

  toString(): string {
    return this.child.toString();
  }
}

export function toggler(key: string, child: VNode): VNode<VToggler> {
  return new VToggler(key, child);
}
