import {
  getCurrentComputation,
  isAbortError,
  OwlError,
  PluginManager,
  Scope,
  scopeStack,
  setComputation,
  STATUS,
  useScope,
} from "@odoo/owl-core";
import type { App } from "./app";
import { Component, ComponentConstructor } from "./component";
import { Content, create, mountTree, Owner } from "./rendering/content";
import { handleError } from "./rendering/error_handling";

// -----------------------------------------------------------------------------
//  ComponentNode
// -----------------------------------------------------------------------------
//
// A component is rendered once: its template is instantiated in its owner, and
// render effects keep the dom up to date. A component with onWillStart hooks
// shows an empty placeholder until they resolve. Props are updated in place
// (see updateProps): the component is not re-rendered, its render effects
// re-run if they read a prop that changed.
// -----------------------------------------------------------------------------

type LifecycleHook = Function;

export class ComponentNode extends Scope implements Content {
  component!: Component;
  componentName: string;
  props: Record<string, any>;
  defaultProps: Record<string, any> | null = null;
  parent: ComponentNode | null;
  root: ComponentNode;
  children: Set<ComponentNode> = new Set();
  owner!: Owner;
  template!: Function;
  content: Content | null = null;
  placeholder: Text | null = null;
  // waiting for its onWillStart hooks
  pending = false;
  // whether the initial mount of the root waits for this component
  countedAsPending = false;
  propsVersion = 0;

  // root only: components of the initial tree waiting for onWillStart, and
  // whether the root was inserted in its target
  pendingCount = 0;
  inserted = false;
  readyCallbacks: (() => void)[] | null = null;

  willUpdateProps: LifecycleHook[] = [];
  // Fired right after `props` is applied to `node.props`, so reactive prop
  // notifications happen once the new values are observable.
  propsUpdated: LifecycleHook[] = [];
  willUnmount: LifecycleHook[] = [];
  mounted: LifecycleHook[] = [];

  constructor(
    C: ComponentConstructor,
    props: Record<string, any>,
    app: App,
    pluginManager: PluginManager,
    parent: ComponentNode | null,
    parentOwner: Owner | null
  ) {
    super(app);
    this.parent = parent;
    this.root = parent ? parent.root : this;
    this.pluginManager = pluginManager;
    this.componentName = C.name;
    this.props = props;
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    scopeStack.push(this);
    try {
      this.component = new C(this);
      this.template = app.getTemplate(C.template);
      this.component.setup();
    } finally {
      scopeStack.pop();
      setComputation(previousComputation);
    }
    this.owner = new Owner(this, parentOwner, false);
    parent?.children.add(this);
  }

  decorate(f: Function, hookName: string): Function {
    const component = this.component;
    const scope = this;
    if (this.app.dev) {
      const name = `${this.componentName}.${hookName}`;
      // Create a named wrapper so the name appears in stack traces.
      // V8 uses computed property keys as inferred function names.
      const wrapper = {
        [name](...args: any[]) {
          return f.call(component, scope, ...args);
        },
      };
      return wrapper[name];
    }
    return f.bind(component, scope);
  }

  /**
   * Renders the component: right away, or once its onWillStart hooks resolve
   * (with a placeholder until then).
   */
  start() {
    if (!this.willStart.length) {
      this.renderContent();
      return;
    }
    const component = this.component;
    let promises: Promise<any>[] | null = null;
    let error: any = null;
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    try {
      for (const f of this.willStart) {
        const result = f.call(component);
        if (result && typeof result.then === "function") {
          (promises ||= []).push(result);
        }
      }
    } catch (e) {
      error = e;
    } finally {
      setComputation(previousComputation);
    }
    if (!promises && !error) {
      // nothing to wait for
      this.renderContent();
      return;
    }
    this.pending = true;
    this.placeholder = document.createTextNode("");
    // the initial mount of the root waits for the components of its tree
    if (!this.root.inserted) {
      this.countedAsPending = true;
      this.root.pendingCount++;
    }
    const promise = error ? Promise.reject(error) : Promise.all(promises!);
    promise
      .then(() => {
        if (this.status >= STATUS.DESTROYED) {
          return;
        }
        this.pending = false;
        const placeholder = this.placeholder!;
        this.renderContent();
        this.placeholder = null;
        const parentEl = placeholder.parentNode;
        if (parentEl) {
          this.content!.mount(parentEl, placeholder);
          placeholder.remove();
        }
        if (this.parent ? this.parent.status === STATUS.MOUNTED : this.inserted) {
          mountTree(this);
        }
      })
      .catch((error) => {
        if (isAbortError(error) && this.status > STATUS.MOUNTED) {
          return;
        }
        if (this.status < STATUS.DESTROYED) {
          handleError({ node: this, error });
        }
      })
      .finally(() => this.releasePending());
  }

  releasePending() {
    if (this.countedAsPending) {
      this.countedAsPending = false;
      this.root.decrementPending();
    }
  }

  renderContent() {
    const ctx = { this: this.component, __owl__: this };
    this.content = create(this.owner, () => this.template.call(this.component, ctx, this));
  }

  decrementPending() {
    if (--this.pendingCount === 0 && this.readyCallbacks) {
      const callbacks = this.readyCallbacks;
      this.readyCallbacks = null;
      for (const cb of callbacks) {
        cb();
      }
    }
  }

  /** Resolves when no component of the initial tree waits for onWillStart. */
  whenReady(): Promise<void> {
    if (!this.pendingCount) {
      return Promise.resolve();
    }
    return new Promise((resolve) => (this.readyCallbacks ||= []).push(resolve));
  }

  /**
   * Called by the props effect of the parent. The component is not
   * re-rendered: the props signals (see useProps) notify what read them.
   */
  updateProps(props: Record<string, any>) {
    if (!propsChanged(this.props, props)) {
      return;
    }
    const version = ++this.propsVersion;
    const hooks = this.willUpdateProps;
    let promises: Promise<any>[] | undefined;
    if (hooks.length) {
      // Defaults must reach the hooks but must NOT be stored on node.props
      let nextProps = props;
      const defaultProps = this.defaultProps;
      if (defaultProps) {
        nextProps = Object.assign({}, props);
        for (const k in defaultProps) {
          if (nextProps[k] === undefined) {
            nextProps[k] = defaultProps[k];
          }
        }
      }
      const component = this.component;
      const previousComputation = getCurrentComputation();
      setComputation(undefined);
      try {
        for (const f of hooks) {
          const r = f.call(component, nextProps);
          if (r && typeof r.then === "function") {
            (promises ||= []).push(r);
          }
        }
      } finally {
        setComputation(previousComputation);
      }
    }
    if (promises) {
      Promise.all(promises).then(
        () => {
          if (version === this.propsVersion && this.status < STATUS.DESTROYED) {
            this.applyProps(props);
          }
        },
        (error) => handleError({ node: this, error })
      );
    } else {
      this.applyProps(props);
    }
  }

  applyProps(props: Record<string, any>) {
    this.props = props;
    const previousComputation = getCurrentComputation();
    setComputation(undefined);
    try {
      for (const f of this.propsUpdated) {
        f();
      }
    } finally {
      setComputation(previousComputation);
    }
  }

  // ---------------------------------------------------------------------------
  // lifecycle
  // ---------------------------------------------------------------------------

  /** Calls the willUnmount hooks of this subtree, parents first. */
  unmount() {
    if (this.status === STATUS.MOUNTED) {
      for (const cb of this.willUnmount) {
        try {
          cb();
        } catch (error) {
          handleError({ node: this, error });
        }
      }
    }
    this.owner?.unmount();
  }

  /** Disposes the render effects and destroys this subtree, children first. */
  dispose() {
    if (this.status >= STATUS.DESTROYED) {
      return;
    }
    this.owner?.dispose();
    this.finalize((e) => handleError({ error: e, node: this }));
    this.parent?.children.delete(this);
    // destroyed while waiting for onWillStart: the initial mount goes on
    this.releasePending();
  }

  /** Unmounts, removes and disposes this component. */
  destroy() {
    this.unmount();
    this.remove();
    this.dispose();
  }

  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------

  mount(parent: Node, ref: Node | null) {
    if (this.content) {
      this.content.mount(parent, ref);
    } else {
      parent.insertBefore((this.placeholder ||= document.createTextNode("")), ref);
    }
  }

  remove() {
    if (this.content) {
      this.content.remove();
    } else {
      this.placeholder?.remove();
    }
  }

  firstNode(): Node {
    return this.content
      ? this.content.firstNode()
      : (this.placeholder ||= document.createTextNode(""));
  }

  lastNode(): Node {
    return this.content
      ? this.content.lastNode()
      : (this.placeholder ||= document.createTextNode(""));
  }
}

function propsChanged(props1: Record<string, any>, props2: Record<string, any>): boolean {
  for (const k in props2) {
    if (props1[k] !== props2[k]) {
      return true;
    }
  }
  for (const k in props1) {
    if (!(k in props2)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the active scope narrowed to a ComponentNode, or throws.
 */
export function getComponentScope(): ComponentNode {
  const scope = useScope();
  if (!(scope instanceof ComponentNode)) {
    throw new OwlError("Expected to be in a component scope");
  }
  return scope;
}
