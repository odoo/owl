import QWeb from "./qweb_vdom";

import { init } from "../libs/snabbdom/src/snabbdom";
import sdProps from "../libs/snabbdom/src/modules/props";
import sdListeners from "../libs/snabbdom/src/modules/eventlisteners";
import { VNode } from "../libs/snabbdom/src/vnode";

const patch = init([sdProps, sdListeners]);

export interface Env {
  qweb: QWeb;
  services: { [key: string]: any };
  [key: string]: any;
}

export default class Widget {
  name: string = "widget";
  template: string = "<div></div>";
  vnode: VNode | null = null;
  _TEMP: Promise<any>[] | null = null;

  parent: Widget | null;
  children: Widget[] = [];
  env: Env | null = null;
  el: HTMLElement | null = null;
  state: Object = {};
  refs: { [key: string]: Widget } = {};

  //--------------------------------------------------------------------------
  // Lifecycle
  //--------------------------------------------------------------------------

  constructor(parent: Widget | null, props?: any) {
    this.parent = parent;
    if (parent) {
      parent.children.push(this);
      if (parent.env) {
        this.setEnvironment(parent.env);
      }
    }
  }

  async willStart() {}

  mounted() {}

  willUnmount() {}

  destroyed() {}
  //--------------------------------------------------------------------------
  // Public
  //--------------------------------------------------------------------------

  async mount(target?: HTMLElement): Promise<VNode> {
    await this.willStart();
    this.env!.qweb.addTemplate(this.name, this.template);
    delete this.template;
    const vnode = await this.render();

    if (target) {
      target.appendChild(this.el!);
    }
    return vnode;
  }

  destroy() {
    if (this.el) {
      this.el.remove();
    }
  }

  setEnvironment(env: Env) {
    this.env = Object.create(env);
  }

  /**
   * DOCSTRIGN
   *
   * @param {Object} newState
   * @memberof Widget
   */
  async updateState(newState: Object) {
    Object.assign(this.state, newState);
    await this.render();
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  async render(): Promise<VNode> {
    this._TEMP = [];
    let vnode = this.env!.qweb.render(this.name, this);
    await Promise.all(this._TEMP);
    if (!this.el) {
      this.el = document.createElement(vnode.sel!);
    }
    patch(this.vnode || this.el, vnode);
    this.vnode = vnode;
    return vnode;
  }
}
