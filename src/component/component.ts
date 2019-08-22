import { Observer } from "../core/observer";
import { CompiledTemplate, QWeb } from "../qweb/index";
import { h, patch, VNode } from "../vdom/index";
import "./directive";
import "./props_validation";

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

/**
 * An Env (environment) is an object that will be (mostly) shared between all
 * components of an Owl application.  It is the location which should contain
 * the qweb instance necessary to render all components.
 *
 * Note that it is totally fine to extend the environment with application
 * specific keys/objects/whatever.  For example, a key `isMobile` (to declare
 * if we are in "mobile" mode), or a shared bus could be useful.
 */
export interface Env {
  qweb: QWeb;
}

/**
 * This is mostly an internal detail of implementation. The Meta interface is
 * useful to typecheck and describe the internal keys used by Owl to manage the
 * component tree.
 */
export interface Meta<T extends Env, Props> {
  readonly id: number;
  vnode: VNode | null;
  isMounted: boolean;
  isDestroyed: boolean;
  parent: Component<T, any, any> | null;
  children: { [key: number]: Component<T, any, any> };
  // children mapping: from templateID to componentID
  // should it be a map number => Component?
  cmap: { [key: number]: number };

  renderId: number;

  // the renderProps and renderPromise keys are only useful for the "prepare"
  // step of the lifecycle of a component.  Once a component has been rendered
  // and patched, it is no longer useful.
  renderProps: Props | null;
  renderPromise: Promise<VNode> | null;

  boundHandlers: { [key: number]: any };
  observer?: Observer;
  render?: CompiledTemplate;
  mountedHandlers: { [key: number]: Function };
  classObj?: { [key: string]: boolean };
}

// If a component does not define explicitely a template
// key, it needs to find a template with its name (or a parent's).  This is
// qweb dependant, so we need a place to store this information indexed by
// qweb instances.
const TEMPLATE_MAP: { [key: number]: { [name: string]: string } } = {};

//------------------------------------------------------------------------------
// Component
//------------------------------------------------------------------------------
let nextId = 1;

export class Component<T extends Env, Props extends {}, State extends {}> {
  readonly __owl__: Meta<Env, Props>;
  template?: string;

  /**
   * The `el` is the root element of the component.  Note that it could be null:
   * this is the case if the component is not mounted yet, or is destroyed.
   */
  get el(): HTMLElement | null {
    return this.__owl__.vnode ? (<any>this).__owl__.vnode.elm : null;
  }

  env: T;
  state?: State;
  props: Props;

  // type of props is not easily representable in typescript...
  static props?: any;
  static defaultProps?: any;

  refs: {
    [key: string]: Component<T, any, any> | HTMLElement | undefined;
  } = {};

  //--------------------------------------------------------------------------
  // Lifecycle
  //--------------------------------------------------------------------------

  /**
   * Creates an instance of Component.
   *
   * The root component of a component tree needs an environment:
   *
   * ```javascript
   *   const root = new RootComponent(env, props);
   * ```
   *
   * Every other component simply needs a reference to its parent:
   *
   * ```javascript
   *   const child = new SomeComponent(parent, props);
   * ```
   *
   * Note that most of the time, only the root component needs to be created by
   * hand.  Other components should be created automatically by the framework (with
   * the t-component directive in a template)
   */
  constructor(parent: Component<T, any, any> | T, props?: Props) {
    const defaultProps = (<any>this.constructor).defaultProps;
    if (defaultProps) {
      props = this.__applyDefaultProps(props, defaultProps);
    }
    // is this a good idea?
    //   Pro: if props is empty, we can create easily a component
    //   Con: this is not really safe
    //   Pro: but creating component (by a template) is always unsafe anyway
    this.props = <Props>props || <Props>{};
    let id: number = nextId++;
    let p: Component<T, any, any> | null = null;
    if (parent instanceof Component) {
      p = parent;
      this.env = parent.env;
      parent.__owl__.children[id] = this;
    } else {
      this.env = parent;
      if (QWeb.dev) {
        // we only validate props for root widgets here.  "Regular" widget
        // props are validated by the t-component directive
        QWeb.utils.validateProps(this.constructor, this.props);
      }
      this.env.qweb.on("update", this, () => {
        if (this.__owl__.isMounted) {
          this.render(true);
        }
        if (this.__owl__.isDestroyed) {
          // this is unlikely to happen, but if a root widget is destroyed,
          // we want to remove our subscription.  The usual way to do that
          // would be to perform some check in the destroy method, but since
          // it is very performance sensitive, and since this is a rare event,
          // we simply do it lazily
          this.env.qweb.off("update", this);
        }
      });
    }
    this.__owl__ = {
      id: id,
      vnode: null,
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
   * before the component is rendered.
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
   * Updating the component state in this hook is possible, but not encouraged.
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

  /**
   * catchError is a method called whenever some error happens in the rendering or
   * lifecycle hooks of a child.
   */
  catchError(error: Error): void {}

  //--------------------------------------------------------------------------
  // Public
  //--------------------------------------------------------------------------

  /**
   * Mount the component to a target element.
   *
   * This should only be done if the component was created manually. Components
   * created declaratively in templates are managed by the Owl system.
   *
   * Note that a component can be mounted an unmounted several times
   */
  async mount(target: HTMLElement): Promise<void> {
    if (this.__owl__.isMounted) {
      return;
    }
    if (this.__owl__.renderId === 1) {
      // we use the fact that renderId === 1 as a way to determine that the
      // component is mounted for the first time
      const vnode = await this.__prepare();
      if (this.__owl__.isDestroyed) {
        // component was destroyed before we get here...
        return;
      }
      this.__patch(vnode);
    }
    target.appendChild(this.el!);

    if (document.body.contains(target)) {
      this.__callMounted();
    }
  }

  unmount() {
    if (this.__owl__.isMounted) {
      this.__callWillUnmount();
      this.el!.remove();
    }
  }

  async render(force: boolean = false, patchQueue?: any[], scope?: any, vars?: any): Promise<void> {
    const __owl__ = this.__owl__;
    if (!__owl__.isMounted) {
      return;
    }
    const shouldPatch: boolean = !patchQueue;
    if (shouldPatch) {
      patchQueue = [];
    }
    const renderVDom = this.__render(force, patchQueue, scope, vars);
    const renderId = __owl__.renderId;
    await renderVDom;

    if (shouldPatch && __owl__.isMounted && renderId === __owl__.renderId) {
      // we only update the vnode and the actual DOM if no other rendering
      // occurred between now and when the render method was initially called.
      this.__applyPatchQueue(<any[]>patchQueue);
    }
  }

  /**
   * Destroy the component.  This operation is quite complex:
   *  - it recursively destroy all children
   *  - call the willUnmount hooks if necessary
   *  - remove the dom node from the dom
   *
   * This should only be called manually if you created the component.  Most
   * components will be automatically destroyed.
   */
  destroy() {
    const __owl__ = this.__owl__;
    if (!__owl__.isDestroyed) {
      const el = this.el;
      this.__destroy(__owl__.parent);
      if (el) {
        el.remove();
      }
    }
  }

  /**
   * This method is called by the component system whenever its props are
   * updated. If it returns true, then the component will be rendered.
   * Otherwise, it will skip the rendering (also, its props will not be updated)
   */
  shouldUpdate(nextProps: Props): boolean {
    return true;
  }

  /**
   * This method is the correct way to update the environment of a component. Doing
   * this will cause a full rerender of the component and its children, so this is
   * an operation that should not be done frequently.
   *
   * A good usecase for updating the environment would be to update some mostly
   * static config keys, such as a boolean to determine if we are in mobile
   * mode or not.
   */
  async updateEnv(nextEnv: Partial<T>): Promise<void> {
    const __owl__ = this.__owl__;
    if (__owl__.parent && __owl__.parent.env === this.env) {
      this.env = Object.create(this.env);
    }
    Object.assign(this.env, nextEnv);
    if (__owl__.isMounted) {
      await this.render(true);
    }
  }

  /**
   * Emit a custom event of type 'eventType' with the given 'payload' on the
   * component's el, if it exists. However, note that the event will only bubble
   * up to the parent DOM nodes. Thus, it must be called between mounted() and
   * willUnmount().
   */
  trigger(eventType: string, payload?: any) {
    if (this.el) {
      const ev = new CustomEvent(eventType, {
        bubbles: true,
        cancelable: true,
        detail: payload
      });
      this.el.dispatchEvent(ev);
    }
  }

  //--------------------------------------------------------------------------
  // Private
  //--------------------------------------------------------------------------

  __destroy(parent: Component<any, any, any> | null) {
    const __owl__ = this.__owl__;
    const isMounted = __owl__.isMounted;
    if (isMounted) {
      this.willUnmount();
      __owl__.isMounted = false;
    }
    const children = __owl__.children;
    for (let key in children) {
      children[key].__destroy(this);
    }
    if (parent) {
      let id = __owl__.id;
      delete parent.__owl__.children[id];
      __owl__.parent = null;
    }
    __owl__.isDestroyed = true;
    delete __owl__.vnode;
  }

  __callMounted() {
    const __owl__ = this.__owl__;
    const children = __owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (!comp.__owl__.isMounted && this.el!.contains(comp.el)) {
        comp.__callMounted();
      }
    }
    __owl__.isMounted = true;
    const handlers = __owl__.mountedHandlers;
    for (let key in handlers) {
      handlers[key]();
    }
    try {
      this.mounted();
    } catch (e) {
      errorHandler(e, this);
    }
  }

  __callWillUnmount() {
    this.willUnmount();
    const __owl__ = this.__owl__;
    __owl__.isMounted = false;
    const children = __owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (comp.__owl__.isMounted) {
        comp.__callWillUnmount();
      }
    }
  }

  async __updateProps(
    nextProps: Props,
    forceUpdate: boolean = false,
    patchQueue?: any[],
    scope?: any,
    vars?: any
  ): Promise<void> {
    const shouldUpdate = forceUpdate || this.shouldUpdate(nextProps);
    if (shouldUpdate) {
      const defaultProps = (<any>this.constructor).defaultProps;
      if (defaultProps) {
        nextProps = this.__applyDefaultProps(nextProps, defaultProps);
      }
      await this.willUpdateProps(nextProps);
      this.props = nextProps;
      await this.render(forceUpdate, patchQueue, scope, vars);
    }
  }

  __patch(vnode) {
    const __owl__ = this.__owl__;
    const target = __owl__.vnode || document.createElement(vnode.sel!);
    if (this.__owl__.classObj) {
      (<any>vnode).data.class = Object.assign((<any>vnode).data.class || {}, this.__owl__.classObj);
    }
    __owl__.vnode = patch(target, vnode);
  }

  __prepare(scope?: Object, vars?: any): Promise<VNode> {
    const __owl__ = this.__owl__;
    __owl__.renderProps = this.props;
    __owl__.renderPromise = this.__prepareAndRender(scope, vars);
    return __owl__.renderPromise;
  }

  async __prepareAndRender(scope?: Object, vars?: any): Promise<VNode> {
    try {
      await this.willStart();
    } catch (e) {
      errorHandler(e, this);
      return Promise.resolve(h("div"));
    }
    const __owl__ = this.__owl__;
    if (__owl__.isDestroyed) {
      return Promise.resolve(h("div"));
    }
    const qweb = this.env.qweb;
    if (!this.template) {
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
        while ((template = p.name) && !(template in qweb.templates) && p !== Component) {
          p = p.__proto__;
        }
        if (p === Component) {
          throw new Error(`Could not find template for component "${this.constructor.name}"`);
        } else {
          tmap[name] = template;
          this.template = template;
        }
      }
    }
    __owl__.render = qweb.render.bind(qweb, this.template);
    this.__observeState();
    return this.__render(false, [], scope, vars);
  }

  async __render(
    force: boolean = false,
    patchQueue: any[] = [],
    scope?: Object,
    vars?: any
  ): Promise<VNode> {
    const __owl__ = this.__owl__;
    __owl__.renderId++;
    const promises: Promise<void>[] = [];
    const patch: any[] = [this];
    if (__owl__.isMounted) {
      patchQueue.push(patch);
    }
    if (__owl__.observer) {
      __owl__.observer.allowMutations = false;
    }
    let vnode;
    try {
      vnode = __owl__.render!(this, {
        promises,
        handlers: __owl__.boundHandlers,
        mountedHandlers: __owl__.mountedHandlers,
        forceUpdate: force,
        patchQueue,
        scope,
        vars
      });
    } catch (e) {
      vnode = __owl__.vnode || h("div");
      errorHandler(e, this);
    }
    patch.push(vnode);
    if (__owl__.observer) {
      __owl__.observer.allowMutations = true;
    }

    // this part is critical for the patching process to be done correctly. The
    // tricky part is that a child component can be rerendered on its own, which
    // will update its own vnode representation without the knowledge of the
    // parent component.  With this, we make sure that the parent component will be
    // able to patch itself properly after
    vnode.key = __owl__.id;
    return Promise.all(promises).then(() => vnode);
  }

  /**
   * Only called by qweb t-component directive
   */
  __mount(vnode: VNode, elm: HTMLElement): VNode {
    const __owl__ = this.__owl__;
    if (__owl__.classObj) {
      (<any>vnode).data.class = Object.assign((<any>vnode).data.class || {}, __owl__.classObj);
    }
    __owl__.vnode = patch(elm, vnode);
    if (__owl__.parent!.__owl__.isMounted && !__owl__.isMounted) {
      this.__callMounted();
    }
    return __owl__.vnode;
  }

  /**
   * Only called by qweb t-component directive (when t-keepalive is set)
   */
  __remount() {
    const __owl__ = this.__owl__;
    if (!__owl__.isMounted) {
      __owl__.isMounted = true;
      this.mounted();
    }
  }

  __observeState() {
    if (this.state) {
      const __owl__ = this.__owl__;
      __owl__.observer = new Observer();
      __owl__.observer.observe(this.state);
      __owl__.observer.notifyCB = this.render.bind(this);
    }
  }

  /**
   * Apply default props (only top level).
   *
   * Note that this method does not modify in place the props, it returns a new
   * prop object
   */
  __applyDefaultProps(props: Object | undefined, defaultProps: Object): Props {
    props = props ? Object.assign({}, props) : {};
    for (let propName in defaultProps) {
      if (props![propName] === undefined) {
        props![propName] = defaultProps[propName];
      }
    }
    return <Props>props;
  }

  /**
   * Apply the given patch queue. A patch is a pair [c, vn], where c is a
   * Component instance and vn a VNode.
   *   1) Call 'willPatch' on the component of each patch
   *   2) Call '__patch' on the component of each patch
   *   3) Call 'patched' on the component of each patch, in inverse order
   */
  __applyPatchQueue(patchQueue: any[]) {
    let component = this;
    try {
      const patchLen = patchQueue.length;
      for (let i = 0; i < patchLen; i++) {
        const patch = patchQueue[i];
        component = patch[0];
        patch.push(patch[0].willPatch());
      }
      for (let i = 0; i < patchLen; i++) {
        const patch = patchQueue[i];
        patch[0].__patch(patch[1]);
      }
      for (let i = patchLen - 1; i >= 0; i--) {
        const patch = patchQueue[i];
        component = patch[0];
        patch[0].patched(patch[2]);
      }
    } catch (e) {
      errorHandler(e, component);
    }
  }
}

//------------------------------------------------------------------------------
// Error handling
//------------------------------------------------------------------------------

function errorHandler(error, component) {
  let canCatch = false;
  let qweb = component.env.qweb;
  let root = component;
  while (component && !(canCatch = component.catchError !== Component.prototype.catchError)) {
    root = component;
    component = component.__owl__.parent;
  }
  console.error(error);
  // we trigger error on QWeb so it can be logged/handled
  qweb.trigger("error", error);

  if (canCatch) {
    setTimeout(() => {
      component.catchError(error);
    });
  } else {
    root.destroy();
  }
}
