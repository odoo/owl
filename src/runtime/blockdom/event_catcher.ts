import { createEventHandler } from "./events";
import type { VNode } from "./index";

type EventsSpec = { [name: string]: number };

type Catcher = (child: VNode, handlers: any[]) => VNode;

export function createCatcher(eventsSpec: EventsSpec): Catcher {
  const n = Object.keys(eventsSpec).length;

  class VCatcher {
    child: VNode;
    handlerData: any[];
    handlerFns: any[] = [];

    parentEl?: HTMLElement | undefined;
    afterNode: Text | null = null;

    constructor(child: VNode, handlers: any[]) {
      this.child = child;
      this.handlerData = handlers;
    }

    mount(parent: HTMLElement, afterNode: Node | null) {
      this.parentEl = parent;
      this.child.mount(parent, afterNode);
      this.afterNode = document.createTextNode("");
      parent.insertBefore(this.afterNode, afterNode);
      this.wrapHandlerData();
      for (let name in eventsSpec) {
        const index = eventsSpec[name];
        const handler = createEventHandler(name);
        this.handlerFns[index] = handler;
        handler.setup.call(parent, this.handlerData[index]);
      }
    }

    wrapHandlerData() {
      for (let i = 0; i < n; i++) {
        let handler = this.handlerData[i];
        // handler = [...mods, fn, comp], so we need to replace second to last elem
        let idx = handler.length - 2;
        let origFn = handler[idx];
        const self = this;
        handler[idx] = function (ev: any) {
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
      }
    }

    moveBeforeDOMNode(node: Node | null) {
      this.child.moveBeforeDOMNode(node);
      this.parentEl!.insertBefore(this.afterNode!, node);
    }

    moveBeforeVNode(other: VCatcher | null, afterNode: Node | null) {
      if (other) {
        // check this with @ged-odoo for use in foreach
        afterNode = other.firstNode() || afterNode;
      }
      this.child.moveBeforeVNode(other ? other.child : null, afterNode);
      this.parentEl!.insertBefore(this.afterNode!, afterNode);
    }

    patch(other: VCatcher, withBeforeRemove: boolean) {
      if (this === other) {
        return;
      }
      this.handlerData = other.handlerData;
      this.wrapHandlerData();
      for (let i = 0; i < n; i++) {
        this.handlerFns[i].update.call(this.parentEl!, this.handlerData[i]);
      }

      this.child.patch(other.child, withBeforeRemove);
    }

    beforeRemove() {
      this.child.beforeRemove();
    }

    remove() {
      for (let i = 0; i < n; i++) {
        this.handlerFns[i].remove.call(this.parentEl!);
      }
      this.child.remove();
      this.afterNode!.remove();
    }

    firstNode(): Node | undefined {
      return this.child.firstNode();
    }

    toString(): string {
      return this.child.toString();
    }
  }

  return function (child: VNode, handlers: any[]): VNode<VCatcher> {
    return new VCatcher(child, handlers);
  };
}
