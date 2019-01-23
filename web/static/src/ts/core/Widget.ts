import { init } from "../../../libs/snabbdom/src/snabbdom";
import sdListeners from "../../../libs/snabbdom/src/modules/eventlisteners";
import sdAttrs from "../../../libs/snabbdom/src/modules/attributes";
import { VNode } from "../../../libs/snabbdom/src/vnode";
import QWeb from "./qweb_vdom";

const patch = init([sdListeners, sdAttrs]);

export interface WidgetEnv {
  qweb: QWeb;
}

export default class Widget<T extends WidgetEnv> {
  name: string = "widget";
  template: string = "<div></div>";
  vnode: VNode | null = null;

  parent: Widget<T> | null = null;
  children: Widget<T>[] = [];
  env: T;
  el: HTMLElement | null = null;
  state: Object = {};
  refs: { [key: string]: Widget<T> } = {};

  //--------------------------------------------------------------------------
  // Lifecycle
  //--------------------------------------------------------------------------

  constructor(parent: Widget<T> | T, props?: any) {
    if (parent instanceof Widget) {
      this.parent = parent;
      parent.children.push(this);
      this.env = Object.create(parent.env);
    } else {
      this.env = parent;
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
      if (document.body.contains(target)) {
        this.visitSubTree(w => w.mounted());
      }
    }
    return vnode;
  }

  destroy() {
    if (this.el) {
      this.el.remove();
    }
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
    // localized hack to keep track of deferred list
    (<any>this)._TEMP = [];
    let vnode = this.env!.qweb.render(this.name, this);
    await Promise.all((<any>this)._TEMP);
    if (!this.el) {
      this.el = document.createElement(vnode.sel!);
    }
    patch(this.vnode || this.el, vnode);
    this.vnode = vnode;
    return vnode;
  }

  private visitSubTree(callback: (w: Widget<T>) => void) {
    callback(this);
    for (let child of this.children) {
      child.visitSubTree(callback);
    }
  }
}
