import { createEventHandler } from "./events";
import type { VNode } from "./index";

type EventsSpec = { [name: string]: number };

type Catcher = (child: VNode, handlers: any[]) => VNode;

export function createCatcher(eventsSpec: EventsSpec): Catcher {
  let setupFns: any[] = [];
  let removeFns: any[] = [];
  for (let name in eventsSpec) {
    let index = eventsSpec[name];
    let { setup, remove } = createEventHandler(name);
    setupFns[index] = setup;
    removeFns[index] = remove;
  }
  let n = setupFns.length;

  class VCatcher {
    child: VNode;
    handlers: any[];

    parentEl?: HTMLElement | undefined;
    afterNode: Node | null = null;

    constructor(child: VNode, handlers: any[]) {
      this.child = child;
      this.handlers = handlers;
    }

    mount(parent: HTMLElement, afterNode: Node | null) {
      this.parentEl = parent;
      this.afterNode = afterNode;
      this.child.mount(parent, afterNode);
      for (let i = 0; i < n; i++) {
        let origFn = this.handlers[i][0];
        const self = this;
        this.handlers[i][0] = function (ev: any) {
          const target = ev.target;
          let currentNode: any = self.child.firstNode();
          const afterNode = self.afterNode;
          while (currentNode !== afterNode) {
            if (currentNode.contains(target)) {
              return origFn.call(this, ev);
            }
            currentNode = currentNode.nextSibling;
          }
        };
        setupFns[i].call(parent, this.handlers[i]);
      }
    }

    moveBefore(other: VCatcher | null, afterNode: Node | null) {
      this.afterNode = null;
      this.child.moveBefore(other ? other.child : null, afterNode);
    }

    patch(other: VCatcher, withBeforeRemove: boolean) {
      if (this === other) {
        return;
      }
      this.handlers = other.handlers;
      this.child.patch(other.child, withBeforeRemove);
    }

    beforeRemove() {
      this.child.beforeRemove();
    }

    remove() {
      for (let i = 0; i < n; i++) {
        removeFns[i].call(this.parentEl!);
      }
      this.child.remove();
    }

    firstNode(): Node | undefined {
      return this.child.firstNode();
    }

    toString(): string {
      return this.child.toString();
    }

    *childNodes() {
      yield this.child;
      yield* this.child.childNodes();
    }
  }

  return function (child: VNode, handlers: any[]): VNode<VCatcher> {
    return new VCatcher(child, handlers);
  };
}
