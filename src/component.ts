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

// If a component does not define explicitely a template
// key, it needs to find a template with its name (or a parent's).  This is
// qweb dependant, so we need a place to store this information indexed by
// qweb instances.
const TEMPLATE_MAP: { [key: number]: { [name: string]: string } } = {};

//------------------------------------------------------------------------------
// Widget
//------------------------------------------------------------------------------
let nextId = 1;

export class Component<T extends Env, Props extends {}, State extends {}> {
  readonly __owl__: Meta<Env, Props>;
  template?: string;

  /**
   * The `el` is the root element of the widget.  Note that it could be null:
   * this is the case if the widget is not mounted yet, or is destroyed.
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
    const defaultProps = (<any>this.constructor).defaultProps;
    if (defaultProps) {
      props = this._applyDefaultProps(props, defaultProps);
    }
    if (QWeb.dev) {
      this._validateProps(props || {});
    }
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

  /**
   * Mount the component to a target element.
   *
   * This should only be done if the component was created manually. Components
   * created declaratively in templates are managed by the Owl system.
   */
  async mount(target: HTMLElement): Promise<void> {
    const vnode = await this._prepare();
    if (this.__owl__.isDestroyed) {
      // component was destroyed before we get here...
      return;
    }
    this._patch(vnode);
    target.appendChild(this.el!);

    if (document.body.contains(target)) {
      this._callMounted();
    }
  }

  unmount() {
    if (this.__owl__.isMounted) {
      this._callWillUnmount();
      this.el!.remove();
    }
  }

  async render(force: boolean = false, patchQueue?: any[]): Promise<void> {
    const __owl__ = this.__owl__;
    if (!__owl__.isMounted) {
      return;
    }
    const shouldPatch: boolean = !patchQueue;
    if (shouldPatch) {
      patchQueue = [];
    }
    const renderVDom = this._render(force, patchQueue);
    const renderId = __owl__.renderId;
    await renderVDom;

    if (shouldPatch && __owl__.isMounted && renderId === __owl__.renderId) {
      // we only update the vnode and the actual DOM if no other rendering
      // occurred between now and when the render method was initially called.
      const patchLen = patchQueue!.length;
      for (let i = 0; i < patchLen; i++) {
        const patch = patchQueue![i];
        patch.push(patch[0].willPatch());
      }
      for (let i = 0; i < patchLen; i++) {
        const patch = patchQueue![i];
        patch[0]._patch(patch[1]);
      }

      for (let i = patchLen - 1; i >= 0; i--) {
        const patch = patchQueue![i];
        patch[0].patched(patch[2]);
      }
    }
  }

  /**
   * Destroy the component.  This operation is quite complex:
   *  - it recursively destroy all children
   *  - call the willUnmount hooks if necessary
   *  - remove the dom node from the dom
   *
   * This should only be called manually if you created the widget.  Most widgets
   * will be automatically destroyed.
   */
  destroy() {
    const __owl__ = this.__owl__;
    if (!__owl__.isDestroyed) {
      const el = this.el;
      this._destroy(__owl__.parent);
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
   * This method is the correct way to update the environment of a widget. Doing
   * this will cause a full rerender of the widget and its children, so this is
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

  _destroy(parent: Component<any, any, any> | null) {
    const __owl__ = this.__owl__;
    const isMounted = __owl__.isMounted;
    if (isMounted) {
      this.willUnmount();
      __owl__.isMounted = false;
    }
    const children = __owl__.children;
    for (let key in children) {
      children[key]._destroy(this);
    }
    if (parent) {
      let id = __owl__.id;
      delete parent.__owl__.children[id];
      __owl__.parent = null;
    }
    __owl__.isDestroyed = true;
    delete __owl__.vnode;
  }

  _callMounted() {
    const __owl__ = this.__owl__;
    const children = __owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (!comp.__owl__.isMounted && this.el!.contains(comp.el)) {
        comp._callMounted();
      }
    }
    __owl__.isMounted = true;
    const handlers = __owl__.mountedHandlers;
    for (let key in handlers) {
      handlers[key]();
    }
    this.mounted();
  }

  _callWillUnmount() {
    this.willUnmount();
    const __owl__ = this.__owl__;
    __owl__.isMounted = false;
    const children = __owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (comp.__owl__.isMounted) {
        comp._callWillUnmount();
      }
    }
  }

  async _updateProps(
    nextProps: Props,
    forceUpdate: boolean = false,
    patchQueue?: any[]
  ): Promise<void> {
    const shouldUpdate = forceUpdate || this.shouldUpdate(nextProps);
    if (shouldUpdate) {
      const defaultProps = (<any>this.constructor).defaultProps;
      if (defaultProps) {
        nextProps = this._applyDefaultProps(nextProps, defaultProps);
      }
      if (QWeb.dev) {
        this._validateProps(nextProps);
      }
      await this.willUpdateProps(nextProps);
      this.props = nextProps;
      await this.render(forceUpdate, patchQueue);
    }
  }

  _patch(vnode) {
    const __owl__ = this.__owl__;
    __owl__.renderPromise = null;
    const target = __owl__.vnode || document.createElement(vnode.sel!);
    __owl__.vnode = patch(target, vnode);
  }
  _prepare(): Promise<VNode> {
    const __owl__ = this.__owl__;
    __owl__.renderProps = this.props;
    __owl__.renderPromise = this._prepareAndRender();
    return __owl__.renderPromise;
  }

  async _prepareAndRender(): Promise<VNode> {
    await this.willStart();
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
    __owl__.render = qweb.render.bind(qweb, this.template);
    this._observeState();
    return this._render();
  }

  async _render(
    force: boolean = false,
    patchQueue: any[] = []
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
    let vnode = __owl__.render!(this, {
      promises,
      handlers: __owl__.boundHandlers,
      mountedHandlers: __owl__.mountedHandlers,
      forceUpdate: force,
      patchQueue
    });
    patch.push(vnode);
    if (__owl__.observer) {
      __owl__.observer.allowMutations = true;
    }

    // this part is critical for the patching process to be done correctly. The
    // tricky part is that a child widget can be rerendered on its own, which
    // will update its own vnode representation without the knowledge of the
    // parent widget.  With this, we make sure that the parent widget will be
    // able to patch itself properly after
    vnode.key = __owl__.id;
    __owl__.renderProps = this.props;
    __owl__.renderPromise = Promise.all(promises).then(() => vnode);
    return __owl__.renderPromise;
  }

  /**
   * Only called by qweb t-widget directive
   */
  _mount(vnode: VNode, elm: HTMLElement): VNode {
    const __owl__ = this.__owl__;
    __owl__.vnode = patch(elm, vnode);
    if (__owl__.parent!.__owl__.isMounted && !__owl__.isMounted) {
      this._callMounted();
    }
    return __owl__.vnode;
  }

  /**
   * Only called by qweb t-widget directive (when t-keepalive is set)
   */
  _remount() {
    const __owl__ = this.__owl__;
    if (!__owl__.isMounted) {
      __owl__.isMounted = true;
      this.mounted();
    }
  }

  _observeState() {
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
  _applyDefaultProps(props: Object | undefined, defaultProps: Object): Props {
    props = props ? Object.create(props) : {};
    for (let propName in defaultProps) {
      if (props![propName] === undefined) {
        props![propName] = defaultProps[propName];
      }
    }
    return <Props>props;
  }

  /**
   * Validate the component props (or next props) against the (static) props
   * description.  This is potentially an expensive operation: it may needs to
   * visit recursively the props and all the children to check if they are valid.
   * This is why it is only done in 'dev' mode.
   */
  _validateProps(props: Object) {
    const propsDef = (<any>this.constructor).props;
    if (propsDef instanceof Array) {
      // list of strings (prop names)
      for (let i = 0, l = propsDef.length; i < l; i++) {
        if (!(propsDef[i] in props)) {
          throw new Error(
            `Missing props '${propsDef[i]}' (widget '${this.constructor.name}')`
          );
        }
      }
    } else if (propsDef) {
      // propsDef is an object now
      for (let propName in propsDef) {
        if (!(propName in props)) {
          if (propsDef[propName] && !propsDef[propName].optional) {
            throw new Error(
              `Missing props '${propName}' (widget '${this.constructor.name}')`
            );
          } else {
            break;
          }
        }
        let isValid = isValidProp(props[propName], propsDef[propName]);
        if (!isValid) {
          throw new Error(
            `Props '${propName}' of invalid type in widget '${
              this.constructor.name
            }'`
          );
        }
      }
    }
  }
}

//------------------------------------------------------------------------------
// Prop validation helper
//------------------------------------------------------------------------------

/**
 * Check if an invidual prop value matches its (static) prop definition
 */
function isValidProp(prop, propDef): boolean {
  if (typeof propDef === "function") {
    // Check if a value is constructed by some Constructor.  Note that there is a
    // slight abuse of language: we want to consider primitive values as well.
    //
    // So, even though 1 is not an instance of Number, we want to consider that
    // it is valid.
    if (typeof prop === "object") {
      return prop instanceof propDef;
    }
    return typeof prop === propDef.name.toLowerCase();
  } else if (propDef instanceof Array) {
    // If this code is executed, this means that we want to check if a prop
    // matches at least one of its descriptor.
    let result = false;
    for (let i = 0, iLen = propDef.length; i < iLen; i++) {
      result = result || isValidProp(prop, propDef[i]);
    }
    return result;
  }
  // propsDef is an object
  let result = isValidProp(prop, propDef.type);
  if (propDef.type === Array) {
    for (let i = 0, iLen = prop.length; i < iLen; i++) {
      result = result && isValidProp(prop[i], propDef.element);
    }
  }
  if (propDef.type === Object) {
    const shape = propDef.shape;
    for (let key in shape) {
      result = result && isValidProp(prop[key], shape[key]);
    }
  }
  return result;
}
