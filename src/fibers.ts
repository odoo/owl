import { BDom } from "./bdom";
import { ComponentData } from "./core";

// -----------------------------------------------------------------------------
//  Internal rendering stuff
// -----------------------------------------------------------------------------

class BaseFiber {
  bdom: BDom | null = null;
  error?: Error;
  __owl__: ComponentData;

  child: Fiber | null = null;
  sibling: Fiber | null = null;

  constructor(__owl__: ComponentData) {
    this.__owl__ = __owl__;
  }

  mountComponents() {
    if (this.child) {
      this.child.mountComponents();
    }
    if (this.sibling) {
      this.sibling.mountComponents();
    }
    this.__owl__.mountedCB();
    this.__owl__.isMounted = true;
  }
}

export type Fiber = ChildFiber | RootFiber;

export class ChildFiber extends BaseFiber {
  bdom: BDom | null = null;
  error?: Error;
  root: RootFiber;
  parent: BaseFiber;

  constructor(__owl__: ComponentData, parent: Fiber) {
    super(__owl__);
    this.parent = parent;
    const root = parent.root;
    root.counter++;
    root.childNumber++;
    this.root = root;
  }
}

export class RootFiber extends BaseFiber {
  counter: number = 1;
  childNumber: number = 1;
  root: RootFiber = this;

  resolve!: () => void;
  reject!: (error: Error) => void;
  promise = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  complete() {
    this.__owl__!.bdom!.patch(this.bdom);
  }
}

export class MountingFiber extends RootFiber {
  target: HTMLElement | DocumentFragment;

  constructor(__owl__: ComponentData, target: HTMLElement | DocumentFragment) {
    super(__owl__);
    this.target = target;
  }
  complete() {
    const __owl__ = this.__owl__!;
    __owl__.bdom! = __owl__.fiber!.bdom!;
    __owl__.bdom!.mount(this.target);
    if (document.body.contains(this.target)) {
      this.mountComponents();
    }
  }
}
