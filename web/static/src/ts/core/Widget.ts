import sdAttrs from "../../../libs/snabbdom/src/modules/attributes";
import sdListeners from "../../../libs/snabbdom/src/modules/eventlisteners";
import { init } from "../../../libs/snabbdom/src/snabbdom";
import { VNode } from "../../../libs/snabbdom/src/vnode";
import { QWeb } from "./qweb_vdom";

const patch = init([sdListeners, sdAttrs]);

export interface WEnv {
  qweb: QWeb;
}

export class Widget<T extends WEnv> {
  name: string = "widget";
  template: string = "<div></div>";
  vnode: VNode | null = null;

  isStarted: boolean = false;
  parent: Widget<T> | null = null;
  children: Widget<T>[] = [];
  env: T;
  el: HTMLElement | null = null;
  state: Object = {};
  refs: { [key: string]: Widget<T> | HTMLElement | undefined } = {}; // either HTMLElement or Widget

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
    this.isStarted = true;
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
   * Note: it is ok to call updateState before the widget is started. In that
   * case, it will simply update the state and will not rerender
   */
  async updateState(newState: Object) {
    Object.assign(this.state, newState);
    if (this.isStarted) {
      await this.render();
    }
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  async render(): Promise<VNode> {
    const vnode = await this._render();
    if (!this.el) {
      this.el = document.createElement(vnode.sel!);
    }
    patch(this.vnode || this.el, vnode);
    this.vnode = vnode;
    return vnode;
  }

  private async _render(): Promise<VNode> {
    if (this.template) {
      this.env.qweb.addTemplate(this.name, this.template);
      delete this.template;
    }
    const promises: Promise<void>[] = [];
    let vnode = this.env.qweb.render(this.name, this, { promises });
    return Promise.all(promises).then(() => vnode);
  }

  private visitSubTree(callback: (w: Widget<T>) => void) {
    callback(this);
    for (let child of this.children) {
      child.visitSubTree(callback);
    }
  }
}
