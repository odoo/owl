import { Observer } from "../core/observer";
import { OwlEvent } from "../core/owl_event";
import { CompiledTemplate, QWeb } from "../qweb/index";
import { patch, VNode } from "../vdom/index";
import "./directive";
import { Fiber } from "./fiber";
import "./props_validation";
import { Scheduler, scheduler } from "./scheduler";
import { activateSheet } from "./styles";

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

export type MountPosition = "first-child" | "last-child" | "self";

interface MountOptions {
  position?: MountPosition;
}

/**
 * This is mostly an internal detail of implementation. The Meta interface is
 * useful to typecheck and describe the internal keys used by Owl to manage the
 * component tree.
 */
interface Internal<T extends Env> {
  // each component has a unique id, useful mostly to handle parent/child
  // relationships
  readonly id: number;
  depth: number;
  vnode: VNode | null;
  pvnode: VNode | null;
  isMounted: boolean;
  isDestroyed: boolean;

  // parent and children keys are obviously useful to setup the parent-children
  // relationship.
  parent: Component<any, T> | null;
  children: { [key: number]: Component<any, T> };
  // children mapping: from templateID to componentID. templateID identifies a
  // place in a template. The t-component directive needs it to be able to get
  // the component instance back whenever the template is rerendered.
  cmap: { [key: number]: number };

  currentFiber: Fiber | null;
  // parentLastFiberId is there to help the parent component to detect, among
  // its children, those that are not used anymore and thus can be destroyed
  parentLastFiberId: number;

  // when a rendering is initiated by a parent, it may set variables in 'scope'
  // (typically when the component is rendered in a slot). We need to
  // store that information in case the component would be re-rendered later on.
  scope: any;

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
  refs: { [key: string]: Component<any, T> | HTMLElement | undefined } | null;
}

export const portalSymbol = Symbol("portal"); // FIXME

//------------------------------------------------------------------------------
// Component
//------------------------------------------------------------------------------
let nextId = 1;

export class Component<Props extends {} = any, T extends Env = Env> {
  readonly __owl__: Internal<T>;
  static template?: string | null = null;
  static _template?: string | null = null;
  static current: Component | null = null;
  static components = {};
  static props?: any;
  static defaultProps?: any;
  static env: any = {};
  // expose scheduler s.t. it can be mocked for testing purposes
  static scheduler: Scheduler = scheduler;

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
   * Note that most of the time, only the root component needs to be created by
   * hand.  Other components should be created automatically by the framework (with
   * the t-component directive in a template)
   */
  constructor(parent?: Component<any, T> | null, props?: Props) {
    Component.current = this;

    let constr = this.constructor as any;
    const defaultProps = constr.defaultProps;
    if (defaultProps) {
      props = props || ({} as Props);
      this.__applyDefaultProps(props, defaultProps);
    }
    this.props = <Props>props;
    if (QWeb.dev) {
      QWeb.utils.validateProps(constr, this.props);
    }

    const id: number = nextId++;
    let depth;
    if (parent) {
      this.env = parent.env;
      const __powl__ = parent.__owl__;
      __powl__.children[id] = this;
      depth = __powl__.depth + 1;
    } else {
      // we are the root component
      this.env = (this.constructor as any).env;
      if (!this.env.qweb) {
        this.env.qweb = new QWeb();
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
      depth = 0;
    }

    const qweb = this.env.qweb;
    const template = constr.template || this.__getTemplate(qweb);
    this.__owl__ = {
      id: id,
      depth: depth,
      vnode: null,
      pvnode: null,
      isMounted: false,
      isDestroyed: false,
      parent: parent || null,
      children: {},
      cmap: {},
      currentFiber: null,
      parentLastFiberId: 0,
      boundHandlers: {},
      mountedCB: null,
      willUnmountCB: null,
      willPatchCB: null,
      patchedCB: null,
      willStartCB: null,
      willUpdatePropsCB: null,
      observer: null,
      renderFn: qweb.render.bind(qweb, template),
      classObj: null,
      refs: null,
      scope: null
    };
    if (constr.style) {
      this.__applyStyles(constr);
    }
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
  catchError?(error?: Error): void;

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
  async mount(target: HTMLElement | DocumentFragment, options: MountOptions = {}): Promise<void> {
    const position = options.position || "last-child";
    const __owl__ = this.__owl__;
    if (__owl__.isMounted) {
      if (position !== "self" && this.el!.parentNode !== target) {
        // in this situation, we are trying to mount a component on a different
        // target. In this case, we need to unmount first, otherwise it will
        // not work.
        this.unmount();
      } else {
        return Promise.resolve();
      }
    }
    if (__owl__.currentFiber) {
      const currentFiber = __owl__.currentFiber;
      if (currentFiber.target === target && currentFiber.position === position) {
        return scheduler.addFiber(currentFiber);
      } else {
        scheduler.rejectFiber(currentFiber, "Mounting operation cancelled");
      }
    }
    if (!(target instanceof HTMLElement || target instanceof DocumentFragment)) {
      let message = `Component '${this.constructor.name}' cannot be mounted: the target is not a valid DOM node.`;
      message += `\nMaybe the DOM is not ready yet? (in that case, you can use owl.utils.whenReady)`;
      throw new Error(message);
    }
    const fiber = new Fiber(null, this, false, target, position);
    fiber.shouldPatch = false;
    if (!__owl__.vnode) {
      this.__prepareAndRender(fiber, () => {});
    } else {
      this.__render(fiber);
    }
    return scheduler.addFiber(fiber);
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
    if (!__owl__.isMounted && !__owl__.currentFiber) {
      // if we get here, this means that the component was either never mounted,
      // or was unmounted and some state change  triggered a render. Either way,
      // we do not want to actually render anything in this case.
      return;
    }
    if (__owl__.currentFiber && !__owl__.currentFiber.isRendered) {
      return scheduler.addFiber(__owl__.currentFiber.root);
    }
    // if we aren't mounted at this point, it implies that there is a
    // currentFiber that is already rendered (isRendered is true), so we are
    // about to be mounted
    const isMounted = __owl__.isMounted;
    const fiber = new Fiber(null, this, force, null, null);
    Promise.resolve().then(() => {
      if (__owl__.isMounted || !isMounted) {
        if (fiber.isCompleted) {
          return;
        }
        // we are mounted (__owl__.isMounted), or if we are currently being
        // mounted (!isMounted), so we call __render
        this.__render(fiber);
      } else {
        // we were mounted when render was called, but we aren't anymore, so we
        // were actually about to be unmounted ; we can thus forget about this
        // fiber
        fiber.isCompleted = true;
        __owl__.currentFiber = null;
      }
    });
    return scheduler.addFiber(fiber);
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
    this.__trigger(this, eventType, payload);
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
  __destroy(parent: Component | null) {
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
    if (__owl__.currentFiber) {
      __owl__.currentFiber.isCompleted = true;
    }
  }

  __callMounted() {
    const __owl__ = this.__owl__;

    __owl__.isMounted = true;
    __owl__.currentFiber = null;
    this.mounted();
    if (__owl__.mountedCB) {
      __owl__.mountedCB();
    }
  }

  __callWillUnmount() {
    const __owl__ = this.__owl__;
    if (__owl__.willUnmountCB) {
      __owl__.willUnmountCB();
    }
    this.willUnmount();
    __owl__.isMounted = false;
    if (this.__owl__.currentFiber) {
      this.__owl__.currentFiber.isCompleted = true;
      this.__owl__.currentFiber.root.counter = 0;
    }
    const children = __owl__.children;
    for (let id in children) {
      const comp = children[id];
      if (comp.__owl__.isMounted) {
        comp.__callWillUnmount();
      }
    }
  }
  /**
   * Private trigger method, allows to choose the component which triggered
   * the event in the first place
   */
  __trigger(component: Component, eventType: string, payload?: any) {
    if (this.el) {
      const ev = new OwlEvent(component, eventType, {
        bubbles: true,
        cancelable: true,
        detail: payload
      });
      const triggerHook = this.env[portalSymbol as any];
      if (triggerHook) {
        triggerHook(ev);
      }
      this.el.dispatchEvent(ev);
    }
  }
  /**
   * The __updateProps method is called by the t-component directive whenever
   * it updates a component (so, when the parent template is rerendered).
   */
  async __updateProps(nextProps: Props, parentFiber: Fiber, scope: any): Promise<void> {
    this.__owl__.scope = scope;
    const shouldUpdate = parentFiber.force || this.shouldUpdate(nextProps);
    if (shouldUpdate) {
      const __owl__ = this.__owl__;
      const fiber = new Fiber(parentFiber, this, parentFiber.force, null, null);
      if (!parentFiber.child) {
        parentFiber.child = fiber;
      } else {
        parentFiber.lastChild!.sibling = fiber;
      }
      parentFiber.lastChild = fiber;

      const defaultProps = (<any>this.constructor).defaultProps;
      if (defaultProps) {
        this.__applyDefaultProps(nextProps, defaultProps);
      }
      if (QWeb.dev) {
        QWeb.utils.validateProps(this.constructor, nextProps);
      }
      await Promise.all([
        this.willUpdateProps(nextProps),
        __owl__.willUpdatePropsCB && __owl__.willUpdatePropsCB(nextProps)
      ]);
      if (fiber.isCompleted) {
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
  __patch(target: HTMLElement | VNode | DocumentFragment, vnode: VNode) {
    this.__owl__.vnode = patch(target as any, vnode);
  }

  /**
   * The __prepare method is only called by the t-component directive, when a
   * subcomponent is created. It gets its scope, if any, from the
   * parent template.
   */
  __prepare(parentFiber: Fiber, scope: any, cb: CallableFunction): Fiber {
    this.__owl__.scope = scope;
    const fiber = new Fiber(parentFiber, this, parentFiber.force, null, null);
    fiber.shouldPatch = false;
    if (!parentFiber.child) {
      parentFiber.child = fiber;
    } else {
      parentFiber.lastChild!.sibling = fiber;
    }
    parentFiber.lastChild = fiber;
    this.__prepareAndRender(fiber, cb);
    return fiber;
  }

  /**
   * Apply the stylesheets defined by the component. Note that we need to make
   * sure all inherited stylesheets are applied as well.  We then delete the
   * `style` key from the constructor to make sure we do not apply it again.
   */
  private __applyStyles(constr) {
    while (constr && constr.style) {
      if (constr.hasOwnProperty("style")) {
        activateSheet(constr.style, constr.name);
        delete constr.style;
      }
      constr = constr.__proto__;
    }
  }
  __getTemplate(qweb: QWeb): string {
    let p = (<any>this).constructor;
    if (!p.hasOwnProperty("_template")) {
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
    return p._template;
  }
  async __prepareAndRender(fiber: Fiber, cb: CallableFunction) {
    try {
      await Promise.all([this.willStart(), this.__owl__.willStartCB && this.__owl__.willStartCB()]);
    } catch (e) {
      fiber.handleError(e);
      return Promise.resolve();
    }
    if (this.__owl__.isDestroyed) {
      return Promise.resolve();
    }
    if (!fiber.isCompleted) {
      this.__render(fiber);
      cb();
    }
  }

  __render(fiber: Fiber) {
    const __owl__ = this.__owl__;
    if (__owl__.observer) {
      __owl__.observer.allowMutations = false;
    }
    let error;
    try {
      let vnode = __owl__.renderFn!(this, {
        handlers: __owl__.boundHandlers,
        fiber: fiber
      });
      // we iterate over the children to detect those that no longer belong to the
      // current rendering: those ones, if not mounted yet, can (and have to) be
      // destroyed right now, because they are not in the DOM, and thus we won't
      // be notified later on (when patching), that they are removed from the DOM
      for (let childKey in __owl__.children) {
        let child = __owl__.children[childKey];
        if (!child.__owl__.isMounted && child.__owl__.parentLastFiberId < fiber.id) {
          child.destroy();
        }
      }
      if (!vnode) {
        throw new Error(`Rendering '${this.constructor.name}' did not return anything`);
      }
      fiber.vnode = vnode;
      // we apply here the class information described on the component by the
      // template (so, something like <MyComponent class="..."/>) to the actual
      // root vnode
      if (__owl__.classObj) {
        const data = vnode.data!;
        data.class = Object.assign(data.class || {}, __owl__.classObj);
      }
    } catch (e) {
      error = e;
    }
    if (__owl__.observer) {
      __owl__.observer.allowMutations = true;
    }

    fiber.root.counter--;
    fiber.isRendered = true;
    if (error) {
      fiber.handleError(error);
    }
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
   * Note that this method does modify in place the props
   */
  __applyDefaultProps(props: Object, defaultProps: Object) {
    for (let propName in defaultProps) {
      if (props![propName] === undefined) {
        props![propName] = defaultProps[propName];
      }
    }
  }
}
