import type { VNode } from "./index";

// -----------------------------------------------------------------------------
// Toggler node
// -----------------------------------------------------------------------------

class VToggler {
  key: string;
  child: VNode;

  parentEl?: HTMLElement | undefined;
  //   singleNode?: boolean | undefined;

  constructor(key: string, child: VNode) {
    this.key = key;
    this.child = child;
  }

  mount(parent: HTMLElement, afterNode: Node | null) {
    this.parentEl = parent;
    this.child.mount(parent, afterNode);
  }

  moveBefore(other: VToggler | null, afterNode: Node | null) {
    this.child.moveBefore(other ? other.child : null, afterNode);
  }

  patch(other: VToggler) {
    if (this === other) {
      return;
    }
    if (this.key === other.key) {
      this.child.patch(other.child);
    } else {
      other.child.mount(this.parentEl!, this.child.firstNode()!);
      this.child.beforeRemove();
      this.child.remove();
      this.child = other.child;
      this.key = other.key;
    }
  }

  beforeRemove() {}

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
