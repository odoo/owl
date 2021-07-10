import { Block } from "../bdom";
import { OwlNode } from "./owl_node";
import { ChildFiber } from "./fibers";
// import type { Component } from "./component";

// -----------------------------------------------------------------------------
//  Component Block
// -----------------------------------------------------------------------------

export class BComponent extends Block {
  node: OwlNode;
  // component: Component;
  // handlers?: any[];
  // parentClass?: string;

  constructor(name: string, props: any, key: string, ctx: any) {
    super();
    const parentNode: OwlNode = ctx.__owl__;
    let node = parentNode.children[key];
    if (node) {
      // update
      const fiber = new ChildFiber(node, parentNode.fiber!);
      node.updateAndRender(props, fiber);
      //     const parentFiber = parentData.fiber!;
      //     parentFiber.child = fiber; // wrong!
      //     updateAndRender(component, fiber, props);
    } else {
      // new component
      const components = ctx.constructor.components;
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

  mountBefore(anchor: ChildNode) {
    const node = this.node;
    const bdom = node.fiber!.bdom!;
    node.bdom = bdom;
    bdom.mountBefore(anchor);
    //   if (this.parentClass) {
    //     const el = this.firstChildNode();
    //     if (el instanceof HTMLElement) {
    //       for (let cl of this.parentClass.trim().split(/\s+/)) {
    //         el.classList.add(cl);
    //       }
    //     }
    //   }
  }

  patch() {
    const node = this.node;
    node.bdom!.patch(node!.fiber!.bdom!);
  }

  remove() {
    const bdom = this.node.bdom!;
    bdom.remove();
  }
}

export class BComponentH extends BComponent {
  // handlers: any[];
  // constructor(handlers: number, name: string, props: any, key: string, ctx: any) {
  //   super(name, props, key, ctx);
  //   this.handlers = new Array(handlers);
  // }
  // mountBefore(anchor: ChildNode) {
  //   super.mountBefore(anchor);
  //   this.setupHandlers();
  // }
  // setupHandlers() {
  //   for (let i = 0; i < this.handlers.length; i++) {
  //     const handler = this.handlers[i];
  //     const eventType = handler[0];
  //     const el = this.component.el!;
  //     el.addEventListener(eventType, () => {
  //       const info = this.handlers![i];
  //       const [, callback, ctx] = info;
  //       if (ctx.__owl__ && !ctx.__owl__.isMounted) {
  //         return;
  //       }
  //       callback();
  //     });
  //   }
  // }
}
