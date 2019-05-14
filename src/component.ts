import { EventBus } from "./event_bus";
import { Observer } from "./observer";
import { QWeb, CompiledTemplate } from "./qweb_core";
import { h, patch, VNode } from "./vdom";

/**
 * Owl Component System
 *
 * This file introduces a declarative and composable component system. It
 * contains:
 *
 * - the Env interface (generic type for the environment)
 * - the Meta interface (the owl specific metadata attached to a component)
 * - the Component class
 */

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
  observer?: Observer;
  render?: CompiledTemplate;
  mountedHandlers: { [key: number]: Function };
}

// If a component does not define explicitely a template (or inlineTemplate)
// key, it needs to find a template with its name (or a parent's).  This is
// qweb dependant, so we need a place to store this information indexed by
// qweb instances.
const TEMPLATE_MAP: { [key: number]: { [name: string]: string } } = {};

//------------------------------------------------------------------------------
// Widget
//------------------------------------------------------------------------------
let nextId = 1;

export class Component<
  T extends Env,
  Props extends {},
  State extends {}
> extends EventBus {
  readonly __owl__: Meta<Env, Props>;
  template?: string;
  inlineTemplate?: string;

  get el(): HTMLElement | null {
    return this.__owl__.vnode ? (<any>this).__owl__.vnode.elm : null;
  }

  env: T;
  state?: State;
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
    let id: number = nextId++;
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
      boundHandlers: {},
      mountedHandlers: {}
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
   * The return value of willPatch will be given to the patched function.
   */
  willPatch(): any {}

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
   *
   * The snapshot parameter is the result of the call to willPatch.
   */
  patched(snapshot: any) {}

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

  async mount(target: HTMLElement): Promise<void> {
    const vnode = await this._prepare();
    if (this.__owl__.isDestroyed) {
      // widget was destroyed before we get here...
      return;
    }
    this._patch(vnode);
    target.appendChild(this.el!);

    if (document.body.contains(target)) {
      this._callMounted();
    }
  }

  _callMounted() {
    const children = this.__owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (!comp.__owl__.isMounted && this.el!.contains(comp.el)) {
        comp._callMounted();
      }
    }
    this.__owl__.isMounted = true;
    for (let key in this.__owl__.mountedHandlers) {
      this.__owl__.mountedHandlers[key]();
    }
    this.mounted();
  }

  _callWillUnmount() {
    this.willUnmount();
    this.__owl__.isMounted = false;
    const children = this.__owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (comp.__owl__.isMounted) {
        comp._callWillUnmount();
      }
    }
  }

  unmount() {
    if (this.__owl__.isMounted) {
      this._callWillUnmount();
      this.el!.remove();
    }
  }

  async render(force: boolean = false, patchQueue?: any[]): Promise<void> {
    if (!this.__owl__.isMounted) {
      return;
    }
    const shouldPatch: boolean = !patchQueue;
    if (shouldPatch) {
      patchQueue = [];
    }
    const renderVDom = this._render(force, patchQueue);
    const renderId = this.__owl__.renderId;
    await renderVDom;

    if (
      shouldPatch &&
      this.__owl__.isMounted &&
      renderId === this.__owl__.renderId
    ) {
      // we only update the vnode and the actual DOM if no other rendering
      // occurred between now and when the render method was initially called.
      for (let i = 0; i < patchQueue!.length; i++) {
        const patch = patchQueue![i];
        patch.push(patch[0].willPatch());
      }
      for (let i = 0; i < patchQueue!.length; i++) {
        const patch = patchQueue![i];
        patch[0]._patch(patch[1]);
      }

      for (let i = patchQueue!.length - 1; i >= 0; i--) {
        const patch = patchQueue![i];
        patch[0].patched(patch[2]);
      }
    }
  }

  destroy() {
    if (!this.__owl__.isDestroyed) {
      const el = this.el;
      this._destroy(this.__owl__.parent);
      if (el) {
        el.remove();
      }
    }
  }

  _destroy(parent) {
    const isMounted = this.__owl__.isMounted;
    if (isMounted) {
      this.willUnmount();
      this.__owl__.isMounted = false;
    }
    const children = Object.values(this.__owl__.children);
    for (let child of children) {
      child._destroy(this);
    }
    if (parent) {
      let id = this.__owl__.id;
      delete parent.__owl__.children[id];
      this.__owl__.parent = null;
    }
    this.clear();
    this.__owl__.isDestroyed = true;
    delete this.__owl__.vnode;
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
  }

  set(target: any, key: string | number, value: any) {
    this.__owl__.observer!.set(target, key, value);
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  async _updateProps(
    nextProps: Props,
    forceUpdate: boolean = false,
    patchQueue?: any[]
  ): Promise<void> {
    const shouldUpdate = forceUpdate || this.shouldUpdate(nextProps);
    if (shouldUpdate) {
      await this.willUpdateProps(nextProps);
      this.props = nextProps;
      await this.render(forceUpdate, patchQueue);
    }
  }

  _patch(vnode) {
    this.__owl__.renderPromise = null;
    const target = this.__owl__.vnode || document.createElement(vnode.sel!);
    this.__owl__.vnode = patch(target, vnode);
  }
  _prepare(): Promise<VNode> {
    this.__owl__.renderProps = this.props;
    this.__owl__.renderPromise = this._prepareAndRender();
    return this.__owl__.renderPromise;
  }

  async _prepareAndRender(): Promise<VNode> {
    await this.willStart();
    if (this.__owl__.isDestroyed) {
      return Promise.resolve(h("div"));
    }
    this.__owl__.isStarted = true;

    const qweb = this.env.qweb;
    if (!this.template) {
      if (this.inlineTemplate) {
        this.env.qweb.addTemplate(
          this.inlineTemplate,
          this.inlineTemplate,
          true
        );

        // we write on the proto, so any new component of this class will get
        // automatically the template key properly setup.
        (<any>this).__proto__.template = this.inlineTemplate;
      } else {
        let tmap = TEMPLATE_MAP[qweb.id];
        if (!tmap) {
          tmap = {};
          TEMPLATE_MAP[qweb.id] = tmap;
        }
        let p = (<any>this).constructor;
        let name: string = p.name;
        let template = tmap[name];
        if (template) {
          this.template = template;
        } else {
          while (
            (template = p.name) &&
            !(template in qweb.templates) &&
            p !== Component
          ) {
            p = p.__proto__;
          }
          if (p === Component) {
            this.template = "default";
          } else {
            tmap[name] = template;
            this.template = template;
          }
        }
      }
    }
    this.__owl__.render = qweb.render.bind(qweb, this.template);
    this._observeState();
    return this._render();
  }
  async _render(
    force: boolean = false,
    patchQueue: any[] = []
  ): Promise<VNode> {
    this.__owl__.renderId++;
    const promises: Promise<void>[] = [];
    const patch: any[] = [this];
    if (this.__owl__.isMounted) {
      patchQueue.push(patch);
    }
    if (this.__owl__.observer) {
      this.__owl__.observer.allowMutations = false;
    }
    let vnode = this.__owl__.render!(this, {
      promises,
      handlers: this.__owl__.boundHandlers,
      mountedHandlers: this.__owl__.mountedHandlers,
      forceUpdate: force,
      patchQueue
    });
    patch.push(vnode);
    if (this.__owl__.observer) {
      this.__owl__.observer.allowMutations = true;
    }

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
    if (
      this.__owl__.parent &&
      this.__owl__.parent.__owl__.isMounted &&
      !this.__owl__.isMounted
    ) {
      this._callMounted();
    }
    return this.__owl__.vnode;
  }

  __mount() {
    if (!this.__owl__.isMounted) {
      this.__owl__.isMounted = true;
      this.mounted();
    }
  }

  _observeState() {
    if (this.state) {
      this.__owl__.observer = new Observer();
      this.__owl__.observer.observe(this.state);
      this.__owl__.observer.notifyCB = this.render.bind(this);
    }
  }
}
