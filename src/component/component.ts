import { Observer } from "../core/observer";
import { CompiledTemplate, QWeb } from "../qweb/index";
import { h, patch, VNode } from "../vdom/index";
import "./directive";
import { Fiber } from "./fiber";
import "./props_validation";
import { Scheduler } from "./scheduler";

/**
 * Owl Component System
 *
 * This file introduces a declarative and composable component system. It
 * contains:
 *
 * - the Env interface (generic type for the environment)
 * - the Internal interface (the owl specific metadata attached to a component)
 * - the Component class
 */

//------------------------------------------------------------------------------
// Types/helpers
//------------------------------------------------------------------------------
const raf = window.requestAnimationFrame.bind(window);
export const scheduler = new Scheduler(raf);

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
  [key: string]: any;
}

/**
 * This is mostly an internal detail of implementation. The Meta interface is
 * useful to typecheck and describe the internal keys used by Owl to manage the
 * component tree.
 */
interface Internal<T extends Env, Props> {
  // each component has a unique id, useful mostly to handle parent/child
  // relationships
  readonly id: number;
  vnode: VNode | null;
  pvnode: VNode | null;
  isMounted: boolean;
  isDestroyed: boolean;

  // parent and children keys are obviously useful to setup the parent-children
  // relationship.
  parent: Component<T, any> | null;
  children: { [key: number]: Component<T, any> };
  // children mapping: from templateID to componentID. templateID identifies a
  // place in a template. The t-component directive needs it to be able to get
  // the component instance back whenever the template is rerendered.
  cmap: { [key: number]: number };

  currentFiber: Fiber | null;

  boundHandlers: { [key: number]: any };
  observer: Observer | null;
  renderFn: CompiledTemplate;
  mountedCB: Function | null;
  willUnmountCB: Function | null;
  willPatchCB: Function | null;
  patchedCB: Function | null;
  willStartCB: Function | null;
  willUpdatePropsCB: Function | null;
  classObj: { [key: string]: boolean } | null;
  refs: { [key: string]: Component<T, any> | HTMLElement | undefined } | null;
}

//------------------------------------------------------------------------------
// Component
//------------------------------------------------------------------------------
let nextId = 1;

export class Component<T extends Env, Props extends {}> {
  readonly __owl__: Internal<Env, Props>;
  static template?: string | null = null;
  static _template?: string | null = null;
  static current: Component<any, any> | null = null;
  static components = {};
  static props?: any;
  static defaultProps?: any;

  /**
   * The `el` is the root element of the component.  Note that it could be null:
   * this is the case if the component is not mounted yet, or is destroyed.
   */
  get el(): HTMLElement | null {
    return this.__owl__.vnode ? (<any>this).__owl__.vnode.elm : null;
  }

  env: T;
  props: Props;

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
  constructor(parent: Component<T, any> | T, props?: Props) {
    const defaultProps = (<any>this.constructor).defaultProps;
    Component.current = this;
    if (defaultProps) {
      props = this.__applyDefaultProps(props, defaultProps);
    }
    // is this a good idea?
    //   Pro: if props is empty, we can create easily a component
    //   Con: this is not really safe
    //   Pro: but creating component (by a template) is always unsafe anyway
    this.props = <Props>props || <Props>{};
    let id: number = nextId++;
    let p: Component<T, any> | null = null;
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
    const qweb = this.env.qweb;

    this.__owl__ = {
      id: id,
      vnode: null,
      pvnode: null,
      isMounted: false,
      isDestroyed: false,
      parent: p,
      children: {},
      cmap: {},
      currentFiber: null,
      boundHandlers: {},
      mountedCB: null,
      willUnmountCB: null,
      willPatchCB: null,
      patchedCB: null,
      willStartCB: null,
      willUpdatePropsCB: null,
      observer: null,
      renderFn: qweb.render.bind(qweb, this.__getTemplate(qweb)),
      classObj: null,
      refs: null
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

  /**
   * catchError is a method called whenever some error happens in the rendering or
   * lifecycle hooks of a child.
   *
   * It needs to be implemented by a component that is designed to handle the
   * error properly.
   */
  catchError?(error?: Error):void;

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
  async mount(target: HTMLElement, renderBeforeRemount: boolean = false): Promise<void> {
    const __owl__ = this.__owl__;
    if (__owl__.isMounted) {
      return Promise.resolve();
    }
    if (__owl__.vnode && !renderBeforeRemount) {
      target.appendChild(this.el!);
      if (document.body.contains(target)) {
        this.__callMounted();
      }
      return;
    }
    const fiber = new Fiber(null, this, this.props, undefined, undefined, false);
    if (!__owl__.vnode) {
      this.__prepareAndRender(fiber);
    } else {
      this.__render(fiber);
    }
    return new Promise(resolve => {
      scheduler.addFiber(fiber, () => {
        if (!__owl__.isDestroyed) {
          this.__patch(fiber.vnode);
          target.appendChild(this.el!);
          if (document.body.contains(target)) {
            this.__callMounted();
          }
        }
        resolve();
      });
    });
  }

  /**
   * The unmount method is the opposite of the mount method.  It is useful
   * to call willUnmount calls and remove the component from the DOM.
   */
  unmount() {
    if (this.__owl__.isMounted) {
      this.__callWillUnmount();
      this.el!.remove();
    }
  }

  /**
   * The render method is the main entry point to render a component (once it
   * is ready. This method is not initially called when the component is
   * rendered the first time).
   *
   * This method will cause all its sub components to potentially rerender
   * themselves.  Note that `render` is not called if a component is updated via
   * its props.
   */
  async render(force: boolean = false): Promise<void> {
    const __owl__ = this.__owl__;
    if (
      (!__owl__.isMounted && !__owl__.currentFiber) ||
      (__owl__.currentFiber && !__owl__.currentFiber.isRendered)
    ) {
      return;
    }
    const fiber = new Fiber(null, this, this.props, undefined, undefined, force);
    this.__render(fiber);
    return new Promise(resolve => {
      scheduler.addFiber(fiber.root, () => {
        if (__owl__.isMounted && fiber === fiber.root) {
          fiber.patchComponents();
        }
        resolve();
      });
    });
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

  /**
   * Private helper to perform a full destroy, from the point of view of an Owl
   * component. It does not remove the el (this is done only once on the top
   * level destroyed component, for performance reasons).
   *
   * The job of this method is mostly to call willUnmount hooks, and to perform
   * all necessary internal cleanup.
   *
   * Note that it does not call the __callWillUnmount method to avoid visiting
   * all children many times.
   */
  __destroy(parent: Component<any, any> | null) {
    const __owl__ = this.__owl__;
    const isMounted = __owl__.isMounted;
    if (isMounted) {
      if (__owl__.willUnmountCB) {
        __owl__.willUnmountCB();
      }
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
    try {
      this.mounted();
      if (__owl__.mountedCB) {
        __owl__.mountedCB();
      }
    } catch (e) {
      console.error(e); // TODO : add a test
    }
  }

  __callWillUnmount() {
    const __owl__ = this.__owl__;
    if (__owl__.willUnmountCB) {
      __owl__.willUnmountCB();
    }
    this.willUnmount();
    __owl__.isMounted = false;
    const children = __owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (comp.__owl__.isMounted) {
        comp.__callWillUnmount();
      }
    }
  }

  /**
   * The __updateProps method is called by the t-component directive whenever
   * it updates a component (so, when the parent template is rerendered).
   */
  async __updateProps(
    nextProps: Props,
    parentFiber: Fiber,
    scope: any,
    vars: any,
    previousSibling?: Fiber | null
  ): Promise<void> {
    const shouldUpdate = parentFiber.force || this.shouldUpdate(nextProps);
    if (shouldUpdate) {
      const __owl__ = this.__owl__;
      const fiber = new Fiber(parentFiber, this, this.props, scope, vars, parentFiber.force);
      if (!parentFiber.child) {
        parentFiber.child = fiber;
      } else {
        previousSibling!.sibling = fiber;
      }

      const defaultProps = (<any>this.constructor).defaultProps;
      if (defaultProps) {
        nextProps = this.__applyDefaultProps(nextProps, defaultProps);
      }
      await Promise.all([
        this.willUpdateProps(nextProps),
        __owl__.willUpdatePropsCB && __owl__.willUpdatePropsCB(nextProps)
      ]);
      if (fiber.isCancelled) {
        return;
      }
      this.props = nextProps;

      this.__render(fiber);
    }
  }

  /**
   * Main patching method. We call the virtual dom patch method here to convert
   * a virtual dom vnode into some actual dom.
   */
  __patch(vnode) {
    const __owl__ = this.__owl__;
    const target = __owl__.vnode || document.createElement(vnode.sel!);
    __owl__.vnode = patch(target, vnode);
    __owl__.currentFiber = null;
  }

  /**
   * The __prepare method is only called by the t-component directive, when a
   * subcomponent is created. It gets its scope and vars, if any, from the
   * parent template.
   */
  __prepare(parentFiber: Fiber, scope: any, vars: any, previousSibling?: Fiber | null) {
    const fiber = new Fiber(parentFiber, this, this.props, scope, vars, parentFiber.force);
    fiber.shouldPatch = false;
    if (!parentFiber.child) {
      parentFiber.child = fiber;
    } else {
      previousSibling!.sibling = fiber;
    }
    return this.__prepareAndRender(fiber);
  }

  __getTemplate(qweb: QWeb): string {
    let p = (<any>this).constructor;
    if (!p.hasOwnProperty("_template")) {
      if (p.template) {
        p._template = p.template;
      } else {
        // here, the component and none of its superclasses defines a static `template`
        // key. So we fall back on looking for a template matching its name (or
        // one of its subclass).

        let template: string;
        while ((template = p.name) && !(template in qweb.templates) && p !== Component) {
          p = p.__proto__;
        }
        if (p === Component) {
          throw new Error(`Could not find template for component "${this.constructor.name}"`);
        } else {
          p._template = template;
        }
      }
    }
    return p._template;
  }
  async __prepareAndRender(fiber: Fiber) {
    try {
      await Promise.all([this.willStart(), this.__owl__.willStartCB && this.__owl__.willStartCB()]);
    } catch (e) {
      fiber.handleError(e);
      fiber.vnode = h("div"); // -> we render this div at the end
      return Promise.resolve();
    }
    if (this.__owl__.isDestroyed) {
      return Promise.resolve();
    }
    if (!fiber.isCancelled) {
      this.__render(fiber);
    }
  }

  __render(fiber: Fiber) {
    const __owl__ = this.__owl__;
    if (__owl__.observer) {
      __owl__.observer.allowMutations = false;
    }
    let vnode;
    try {
      vnode = __owl__.renderFn!(this, {
        handlers: __owl__.boundHandlers,
        fiber: fiber
      });
    } catch (e) {
      vnode = __owl__.vnode || h("div");
      fiber.handleError(e);
    }
    fiber.vnode = vnode;
    if (__owl__.observer) {
      __owl__.observer.allowMutations = true;
    }

    // we apply here the class information described on the component by the
    // template (so, something like <MyComponent class="..."/>) to the actual
    // root vnode
    if (__owl__.classObj) {
      vnode.data.class = Object.assign(vnode.data.class || {}, __owl__.classObj);
    }
    fiber.root.counter--;
    fiber.isRendered = true;
  }

  /**
   * Only called by qweb t-component directive
   */
  __mount(fiber: Fiber, elm: HTMLElement): VNode {
    if (fiber !== this.__owl__.currentFiber) {
      fiber = this.__owl__.currentFiber!; // TODO: check if we can remove fiber arg
    }
    const vnode = fiber.vnode!;
    const __owl__ = this.__owl__;
    if (__owl__.classObj) {
      (<any>vnode).data.class = Object.assign((<any>vnode).data.class || {}, __owl__.classObj);
    }
    __owl__.vnode = patch(elm, vnode);
    __owl__.currentFiber = null;
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
}
