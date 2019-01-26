import sdAttrs from "../../../libs/snabbdom/src/modules/attributes";
import sdListeners from "../../../libs/snabbdom/src/modules/eventlisteners";
import { init } from "../../../libs/snabbdom/src/snabbdom";
import { VNode } from "../../../libs/snabbdom/src/vnode";
import { QWeb } from "./qweb_vdom";

const patch = init([sdListeners, sdAttrs]);

export interface WEnv {
  qweb: QWeb;
  getID(): number;
}

let wl: any[] = [];
(<any>window).wl = wl;

interface Meta<T extends WEnv> {
  id: number;
  // name: string;
  // template: string;
  vnode: VNode | null;
  isStarted: boolean;
  isMounted: boolean;
  isDestroyed: boolean;
  parent: Widget<T> | null;
  children: Widget<T>[];
}

export class Widget<T extends WEnv> {
  _: Meta<WEnv>;
  name: string = "widget";
  template: string = "<div></div>";

  get el(): HTMLElement | null {
    return this._.vnode ? (<any>this)._.vnode.elm : null;
  }

  env: T;
  state: Object = {};
  refs: { [key: string]: Widget<T> | HTMLElement | undefined } = {}; // either HTMLElement or Widget

  //--------------------------------------------------------------------------
  // Lifecycle
  //--------------------------------------------------------------------------

  constructor(parent: Widget<T> | T, props?: any) {
    wl.push(this);
    let p: Widget<T> | null = null;
    if (parent instanceof Widget) {
      p = parent;
      parent._.children.push(this);
      this.env = Object.create(parent.env);
    } else {
      this.env = parent;
    }
    this._ = {
      id: this.env.getID(),
      vnode: null,
      isStarted: false,
      isMounted: false,
      isDestroyed: false,
      parent: p,
      children: []
    };
  }

  async willStart() {}

  mounted() {}

  willUnmount() {}

  destroyed() {}
  //--------------------------------------------------------------------------
  // Public
  //--------------------------------------------------------------------------

  async mount(target: HTMLElement): Promise<VNode> {
    await this._start();
    const vnode = await this.render();
    target.appendChild(this.el!);

    if (document.body.contains(target)) {
      this.visitSubTree(w => {
        if (!w._.isMounted && this.el!.contains(w.el)) {
          w._.isMounted = true;
          w.mounted();
        }
      });
    }
    // }
    return vnode;
  }

  destroy() {
    if (!this._.isDestroyed) {
      if (this.el) {
        this.el.remove();
        delete this._.vnode;
      }
      this._.isDestroyed = true;
      this.destroyed();
    }
  }

  /**
   * Note: it is ok to call updateState before the widget is started. In that
   * case, it will simply update the state and will not rerender
   */
  async updateState(newState: Object) {
    Object.assign(this.state, newState);
    if (this._.isStarted) {
      await this.render();
    }
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  async render(): Promise<VNode> {
    const vnode = await this._render();
    this._.vnode = patch(
      this._.vnode || document.createElement(vnode.sel!),
      vnode
    );
    return this._.vnode;
  }

  private async _start(): Promise<void> {
    await this.willStart();
    this._.isStarted = true;
  }

  private async _render(): Promise<VNode> {
    if (this.template) {
      this.env.qweb.addTemplate(this.name, this.template);
      delete this.template;
    }
    const promises: Promise<void>[] = [];
    let vnode = this.env.qweb.render(this.name, this, { promises });

    // this part is critical for the patching process to be done correctly. The
    // tricky part is that a child widget can be rerendered on its own, which
    // will update its own vnode representation without the knowledge of the
    // parent widget.  With this, we make sure that the parent widget will be
    // able to patch itself properly after
    vnode.key = this._.id;
    return Promise.all(promises).then(() => vnode);
  }

  /**
   * Only called by qweb t-widget directive
   */
  _mount(vnode: VNode) {
    this._.vnode = vnode;
    if (this._.parent) {
      if (this._.parent._.isMounted) {
        this._.isMounted = true;
        this.mounted();
      }
    }
  }

  private visitSubTree(callback: (w: Widget<T>) => void) {
    callback(this);
    for (let child of this._.children) {
      child.visitSubTree(callback);
    }
  }
}
