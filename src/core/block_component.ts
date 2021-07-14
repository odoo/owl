import { Block } from "../bdom";
import { OwlNode } from "./owl_node";
import { ChildFiber } from "./fibers";
import { STATUS } from "../status";
// import type { Component } from "./component";

// -----------------------------------------------------------------------------
//  Component Block
// -----------------------------------------------------------------------------

export class BComponent extends Block {
  node: OwlNode;
  // component: Component;
  // handlers?: any[];
  parentClass?: any;
  classTarget?: HTMLElement;

  /**
   *
   * @param name
   * @param props
   * @param key
   * @param owner the component in which the component was defined
   * @param parent the actual parent (may be different in case of slots)
   */
  constructor(name: string, props: any, key: string, owner: any, parent: any) {
    super();
    const parentNode: OwlNode = parent.__owl__;
    let node: OwlNode | undefined = parentNode.children[key];
    if (node && node.status < STATUS.MOUNTED) {
      node.destroy();
      delete parentNode.children[key];
      node = undefined;
    }
    if (node) {
      // update
      const parentFiber = parentNode.fiber!;
      if (node.beforePatch.length) {
        parentFiber.root.toPatch.push(node);
      }
      const fiber = new ChildFiber(node, parentFiber);
      node.updateAndRender(props, fiber);
      //     const parentFiber = parentData.fiber!;
      //     parentFiber.child = fiber; // wrong!
      //     updateAndRender(component, fiber, props);
    } else {
      // new component
      const components = owner.constructor.components;
      const C = components[name];
      node = new OwlNode(parentNode.app, C, props);
      parentNode.children[key] = node;
      const fiber = new ChildFiber(node, parentNode.fiber!);
      node.initiateRender(fiber);
    }
    this.node = node;
  }

  firstChildNode(): ChildNode | null {
    const bdom = this.node.bdom;
    return bdom ? bdom.firstChildNode() : null;
  }

  mountBefore(anchor: ChildNode, mounted: any[], patched: any[]) {
    const node = this.node;
    if (node.mount.length) {
      mounted.push(node);
    }
    const bdom = node.fiber!.bdom!;
    node.bdom = bdom;
    bdom.mountBefore(anchor, mounted, patched);
    if (this.parentClass) {
      this.parentClass = this.parentClass.trim().split(/\s+/);
      const el = this.firstChildNode();
      if (el instanceof HTMLElement) {
        this.addClass(el);
      }
    }
    node.status = STATUS.MOUNTED;
  }

  moveBefore(anchor: ChildNode) {
    this.node.bdom!.moveBefore(anchor);
  }

  addClass(el: HTMLElement) {
    this.classTarget = el;
    for (let cl of this.parentClass) {
      el.classList.add(cl);
    }
  }

  removeClass(el: HTMLElement) {
    for (let cl of this.parentClass) {
      el.classList.remove(cl);
    }
  }

  patch(other: BComponent, mountedNodes: any[], patchedNodes: any[]) {
    const node = this.node;
    if (node.patched.length) {
      patchedNodes.push(node);
    }

    node.bdom!.patch(node!.fiber!.bdom!, mountedNodes, patchedNodes);
    if (this.parentClass) {
      const el = this.firstChildNode();
      if (el !== this.classTarget) {
        if (el && this.classTarget) {
          this.removeClass(this.classTarget);
          this.addClass(el as any);
        } else if (el) {
          this.addClass(el as any);
        } else {
          this.removeClass(this.classTarget!);
          this.classTarget = undefined;
        }
      }
    }
  }

  beforeRemove() {
    this.node.callBeforeUnmount();
  }

  remove() {
    const bdom = this.node.bdom!;
    bdom.remove();
  }
}

export class BComponentH extends BComponent {
  handlers: any[];
  constructor(handlers: number, name: string, props: any, key: string, owner: any, parent: any) {
    super(name, props, key, owner, parent);
    this.handlers = new Array(handlers);
  }
  mountBefore(anchor: ChildNode, mounted: any[], patched: any[]) {
    super.mountBefore(anchor, mounted, patched);
    this.setupHandlers();
  }
  setupHandlers() {
    for (let i = 0; i < this.handlers.length; i++) {
      const handler = this.handlers[i];
      const eventType = handler[0];
      const el = this.node.component.el!;
      el.addEventListener(eventType, () => {
        const info = this.handlers![i];
        const [, callback] = info;
        // if (ctx.__owl__ && !ctx.__owl__.isMounted) {
        //   return;
        // }
        callback();
      });
    }
  }
}
