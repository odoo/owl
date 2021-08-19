import { Component } from "./component/component";
import { ComponentNode } from "./component/component_node";
import { Scheduler } from "./component/scheduler";
import { TemplateSet } from "./qweb/template_helpers";

export class App<T extends typeof Component = any> extends TemplateSet {
  Root: T;
  props: any;
  env: any = {};
  scheduler = new Scheduler(window.requestAnimationFrame.bind(window));
  root: ComponentNode | null = null;
  dev: boolean = true;

  constructor(Root: T, props?: any) {
    super();
    this.Root = Root;
    this.props = props;
  }

  configure(params: any) {
    if (params.env) {
      this.env = params.env;
    }
  }

  mount(target: HTMLElement): Promise<InstanceType<T>> {
    if (!(target instanceof HTMLElement)) {
      throw new Error("Cannot mount component: the target is not a valid DOM element");
    }
    if (!document.body.contains(target)) {
      throw new Error("Cannot mount a component on a detached dom node");
    }
    const node = new ComponentNode(this.Root, this.props, this);
    this.root = node;
    return node.mountComponent(target);
  }

  destroy() {
    if (this.root) {
      this.root.destroy();
    }
  }
}
