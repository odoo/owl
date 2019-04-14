import h from "../libs/snabbdom/src/h";
import sdAttrs from "../libs/snabbdom/src/modules/attributes";
import sdProps from "../libs/snabbdom/src/modules/props";
import sdListeners from "../libs/snabbdom/src/modules/eventlisteners";
import { init } from "../libs/snabbdom/src/snabbdom";
import { VNode } from "../libs/snabbdom/src/vnode";
import { EventBus } from "./event_bus";
import { QWeb } from "./qweb";
import { idGenerator } from "./utils";

let getId = idGenerator();

//------------------------------------------------------------------------------
// Types/helpers
//------------------------------------------------------------------------------

export interface Env {
  qweb: QWeb;
}

export interface Meta<T extends Env, Props> {
  readonly id: number;
  vnode: VNode | null;
  isStarted: boolean;
  isMounted: boolean;
  isDestroyed: boolean;
  parent: Component<T, any, any> | null;
  children: { [key: number]: Component<T, any, any> };
  // children mapping: from templateID to widgetID
  // should it be a map number => Widget?
  cmap: { [key: number]: number };

  renderId: number;
  renderProps: Props | null;
  renderPromise: Promise<VNode> | null;
  boundHandlers: { [key: number]: any };
}

const patch = init([sdListeners, sdAttrs, sdProps]);

export interface Type<T> extends Function {
  new (...args: any[]): T;
}

//------------------------------------------------------------------------------
// Widget
//------------------------------------------------------------------------------

export class Component<
  T extends Env,
  Props extends {},
  State extends {}
> extends EventBus {
  readonly __owl__: Meta<Env, Props>;
  template: string = "default";
  inlineTemplate: string | null = null;

  get el(): HTMLElement | null {
    return this.__owl__.vnode ? (<any>this).__owl__.vnode.elm : null;
  }

  env: T;
  state: State = <State>{};
  props: Props;
  refs: {
    [key: string]: Component<T, any, any> | HTMLElement | undefined;
  } = {};

  //--------------------------------------------------------------------------
  // Lifecycle
  //--------------------------------------------------------------------------

  /**
   * Creates an instance of Component.
   *
   * The root widget of a component tree needs an environment:
   *
   * ```javascript
   *   const root = new RootWidget(env, props);
   * ```
   *
   * Every other widget simply needs a reference to its parent:
   *
   * ```javascript
   *   const child = new SomeWidget(parent, props);
   * ```
   *
   * Note that most of the time, only the root widget needs to be created by
   * hand.  Other widgets should be created automatically by the framework (with
   * the t-widget directive in a template)
   */
  constructor(parent: Component<T, any, any> | T, props?: Props) {
    super();

    // is this a good idea?
    //   Pro: if props is empty, we can create easily a widget
    //   Con: this is not really safe
    //   Pro: but creating widget (by a template) is always unsafe anyway
    this.props = <Props>props || <Props>{};
    let id: number = getId();
    let p: Component<T, any, any> | null = null;
    if (parent instanceof Component) {
      p = parent;
      this.env = parent.env;
      parent.__owl__.children[id] = this;
    } else {
      this.env = parent;
    }
    this.__owl__ = {
      id: id,
      vnode: null,
      isStarted: false,
      isMounted: false,
      isDestroyed: false,
      parent: p,
      children: {},
      cmap: {},
      renderId: 1,
      renderPromise: null,
      renderProps: props || null,
      boundHandlers: {}
    };
  }

  /**
   * willStart is an asynchronous hook that can be implemented to perform some
   * action before the initial rendering of a component.
   *
   * It will be called exactly once before the initial rendering. It is useful
   * in some cases, for example, to load external assets (such as a JS library)
   * before the widget is rendered.
   *
   * Note that a slow willStart method will slow down the rendering of the user
   * interface.  Therefore, some effort should be made to make this method as
   * fast as possible.
   *
   * Note: this method should not be called manually.
   */
  async willStart() {}

  /**
   * mounted is a hook that is called each time a component is attached to the
   * DOM. This is a good place to add some listeners, or to interact with the
   * DOM, if the component needs to perform some measure for example.
   *
   * Note: this method should not be called manually.
   *
   * @see willUnmount
   */
  mounted() {}

  /**
   * The willUpdateProps is an asynchronous hook, called just before new props
   * are set. This is useful if the component needs some asynchronous task
   * performed, depending on the props (for example, assuming that the props are
   * some record Id, fetching the record data).
   *
   * This hook is not called during the first render (but willStart is called
   * and performs a similar job).
   */
  async willUpdateProps(nextProps: Props) {}

  /**
   * The willPatch hook is called just before the DOM patching process starts.
   * It is not called on the initial render.  This is useful to get some
   * information which are in the DOM.  For example, the current position of the
   * scrollbar
   *
   * Note that at this point, it is not safe to rerender the widget. In
   * particular, updateState calls should be avoided.
   */
  willPatch() {}

  /**
   * This hook is called whenever a component did actually update its props,
   * state or env.
   *
   * This method is not called on the initial render. It is useful to interact
   * with the DOM (for example, through an external library) whenever the
   * component was updated.
   *
   * Updating the widget state in this hook is possible, but not encouraged.
   * One need to be careful, because updates here will cause rerender, which in
   * turn will cause other calls to updated. So, we need to be particularly
   * careful at avoiding endless cycles.
   */
  patched() {}

  /**
   * willUnmount is a hook that is called each time just before a component is
   * unmounted from the DOM. This is a good place to remove some listeners, for
   * example.
   *
   * Note: this method should not be called manually.
   *
   * @see mounted
   */
  willUnmount() {}

  //--------------------------------------------------------------------------
  // Public
  //--------------------------------------------------------------------------

  /**
   * Attach a child widget to a given html element
   *
   * This is most of the time not necessary, since widgets should primarily be
   * created/managed with the t-widget directive in a qweb template.  However,
   * for the cases where we need more control, this method will do what is
   * necessary to make sure all the proper hooks are called (for example,
   * mounted/willUnmount)
   *
   * Note that this method makes a few assumptions:
   * - the child widget is indeed a child of the current widget
   * - the target is inside the dom of the current widget (typically a ref)
   */
  attachChild(child: Component<T, any, any>, target: HTMLElement) {
    target.appendChild(child.el!);
    child.__mount();
  }

  async mount(target: HTMLElement): Promise<void> {
    const vnode = await this._prepare();
    if (this.__owl__.isDestroyed) {
      // widget was destroyed before we get here...
      return;
    }
    this._patch(vnode);
    target.appendChild(this.el!);

    if (document.body.contains(target)) {
      this._visitSubTree(w => {
        if (!w.__owl__.isMounted && this.el!.contains(w.el)) {
          w.__owl__.isMounted = true;
          w.mounted();
          return true;
        }
        return false;
      });
    }
  }

  unmount() {
    if (this.el) {
      this._visitSubTree(w => {
        if (w.__owl__.isMounted) {
          w.willUnmount();
          w.__owl__.isMounted = false;
          return true;
        }
        return false;
      });
      this.el.remove();
    }
  }

  async render(force: boolean = false): Promise<void> {
    if (this.__owl__.isDestroyed) {
      return;
    }
    const renderVDom = this._render(force);
    const renderId = this.__owl__.renderId;
    const vnode = await renderVDom;
    if (renderId === this.__owl__.renderId) {
      // we only update the vnode and the actual DOM if no other rendering
      // occurred between now and when the render method was initially called.
      this._patch(vnode);
    }
  }

  destroy() {
    if (!this.__owl__.isDestroyed) {
      for (let id in this.__owl__.children) {
        this.__owl__.children[id].destroy();
      }
      if (this.__owl__.isMounted) {
        this.willUnmount();
      }
      if (this.el) {
        this.el.remove();
        this.__owl__.isMounted = false;
        delete this.__owl__.vnode;
      }
      if (this.__owl__.parent) {
        let id = this.__owl__.id;
        delete this.__owl__.parent.__owl__.children[id];
        this.__owl__.parent = null;
      }
      this.clear();
      this.__owl__.isDestroyed = true;
    }
  }

  shouldUpdate(nextProps: Props): boolean {
    return true;
  }

  /**
   * This method is the correct way to update the environment of a widget. Doing
   * this will cause a full rerender of the widget and its children, so this is
   * an operation that should not be done frequently.
   *
   * A good usecase for updating the environment would be to update some mostly
   * static config keys, such as a boolean to determine if we are in mobile
   * mode or not.
   */
  async updateEnv(nextEnv: Partial<T>): Promise<void> {
    if (this.__owl__.parent && this.__owl__.parent.env === this.env) {
      this.env = Object.create(this.env);
    }
    Object.assign(this.env, nextEnv);
    if (this.__owl__.isMounted) {
      await this.render(true);
    }
    this.patched();
  }

  async updateProps(
    nextProps: Props,
    forceUpdate: boolean = false
  ): Promise<void> {
    const shouldUpdate = forceUpdate || this.shouldUpdate(nextProps);
    return shouldUpdate ? this._updateProps(nextProps) : Promise.resolve();
  }

  /**
   * This is the safest update method for widget: its job is to update the state
   * and rerender (if widget is mounted).
   *
   * Notes:
   * - it checks if we do not add extra keys to the state.
   * - it is ok to call updateState before the widget is started. In that
   * case, it will simply update the state and will not rerender
   */
  async updateState(nextState: Partial<State>) {
    if (Object.keys(nextState).length === 0) {
      return;
    }
    Object.assign(this.state, nextState);
    if (this.__owl__.isStarted) {
      await this.render();
    }
    this.patched();
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  async _updateProps(nextProps: Props): Promise<void> {
    await this.willUpdateProps(nextProps);
    this.props = nextProps;
    await this.render();
    this.patched();
  }

  _patch(vnode) {
    this.__owl__.renderPromise = null;
    if (this.__owl__.vnode) {
      this.willPatch();
      this.__owl__.vnode = patch(this.__owl__.vnode, vnode);
    } else {
      this.__owl__.vnode = patch(document.createElement(vnode.sel!), vnode);
    }
  }
  async _prepare(): Promise<VNode> {
    this.__owl__.renderProps = this.props;
    this.__owl__.renderPromise = this.willStart().then(() => {
      if (this.__owl__.isDestroyed) {
        return Promise.resolve(h("div"));
      }
      this.__owl__.isStarted = true;
      if (this.inlineTemplate) {
        this.env.qweb.addTemplate(
          this.inlineTemplate,
          this.inlineTemplate,
          true
        );
      }
      return this._render();
    });
    return this.__owl__.renderPromise;
  }

  async _render(force: boolean = false): Promise<VNode> {
    this.__owl__.renderId++;
    const promises: Promise<void>[] = [];
    const template = this.inlineTemplate || this.template;
    let vnode = this.env.qweb.render(template, this, {
      promises,
      handlers: this.__owl__.boundHandlers,
      forceUpdate: force
    });

    // this part is critical for the patching process to be done correctly. The
    // tricky part is that a child widget can be rerendered on its own, which
    // will update its own vnode representation without the knowledge of the
    // parent widget.  With this, we make sure that the parent widget will be
    // able to patch itself properly after
    vnode.key = this.__owl__.id;
    this.__owl__.renderProps = this.props;
    this.__owl__.renderPromise = Promise.all(promises).then(() => vnode);
    return this.__owl__.renderPromise;
  }

  /**
   * Only called by qweb t-widget directive
   */
  _mount(vnode: VNode, elm: HTMLElement): VNode {
    this.__owl__.vnode = patch(elm, vnode);
    this.__mount();
    return this.__owl__.vnode;
  }

  __mount() {
    if (this.__owl__.isMounted) {
      return;
    }
    if (this.__owl__.parent) {
      if (this.__owl__.parent!.__owl__.isMounted) {
        this.__owl__.isMounted = true;
        this.mounted();
        const children = this.__owl__.children;
        for (let id in children) {
          children[id].__mount();
        }
      }
    }
  }

  _visitSubTree(callback: (w: Component<T, any, any>) => boolean) {
    const shouldVisitChildren = callback(this);
    if (shouldVisitChildren) {
      const children = this.__owl__.children;
      for (let id in children) {
        children[id]._visitSubTree(callback);
      }
    }
  }
}

export class PureComponent<E extends Env, P, S> extends Component<E, P, S> {
  shouldUpdate(nextProps: P): boolean {
    for (let k in nextProps) {
      if (nextProps[k] !== this.props[k]) {
        return true;
      }
    }
    return false;
  }
  async updateState(nextState: Partial<S>) {
    for (let k in nextState) {
      if (nextState[k] !== this.state[k]) {
        return super.updateState(nextState);
      }
    }
  }
}
