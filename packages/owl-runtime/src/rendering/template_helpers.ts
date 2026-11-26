import {
  atomSymbol,
  computed,
  markRaw,
  OwlError,
  ReactiveValue,
  signal,
  untrack,
} from "@odoo/owl-core";
import type { App } from "../app";
import { Component } from "../component";
import { ComponentNode } from "../component_node";
import {
  catcher,
  Content,
  getCurrentOwner,
  keyed,
  LazyValue,
  list,
  multi,
  out,
  renderEffect,
  text,
  toggle,
} from "./content";
import { handleError } from "./error_handling";

/**
 * This file contains utility functions that will be injected in each template,
 * to perform various useful tasks in the compiled code.
 */

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

const zero = Symbol("zero");

/** t-out="0": the body of the t-call that called the current template */
function callZero(ctx: any): Content {
  const fn = ctx[zero];
  return fn ? fn() : text("");
}

function defineComputed(target: any, key: string, fn: () => any) {
  Object.defineProperty(target, key, {
    get: computed(fn),
    enumerable: true,
    configurable: true,
  });
}

/**
 * t-set: a new context layer. A value given as a function is a getter, computed
 * when read (and kept up to date), in the previous layer.
 */
function tset(ctx: any, name: string, isGetter: boolean, value: any): any {
  const result = Object.create(ctx);
  if (isGetter) {
    defineComputed(result, name, value);
  } else {
    // defined, not assigned: it may shadow an inherited getter
    Object.defineProperty(result, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return result;
}

/**
 * The slots given to a component, created once. The attributes of a slot
 * (`<t t-set-slot="x" title="..."/>`) are getters, computed when read.
 */
function makeSlots(slots: Record<string, any>): Record<string, any> {
  for (const name in slots) {
    const slot = slots[name];
    const attrs = slot.__attrs;
    if (attrs) {
      delete slot.__attrs;
      for (const key in attrs) {
        defineComputed(slot, key, attrs[key]);
      }
    }
  }
  return markRaw(slots);
}

function lazy(fn: () => Content): LazyValue {
  return new LazyValue(fn);
}

/** the context of a t-call: its attributes are getters on the caller context */
function callCtx(base: any, getters: Record<string, () => any>, zeroFn: (() => Content) | null) {
  const result = base ? Object.create(base) : {};
  for (const key in getters) {
    defineComputed(result, key, getters[key]);
  }
  if (zeroFn) {
    result[zero] = zeroFn;
  }
  return result;
}

function callTemplate(name: string, owner: any, app: App, ctx: any, node: ComponentNode): Content {
  return app.getTemplate(name).call(owner, ctx, node);
}

function callSlot(
  ctx: any,
  node: ComponentNode,
  name: string,
  scope: Record<string, () => any> | null,
  dynScope: (() => any) | null,
  defaultContent: (() => Content) | null
): Content {
  const slots = ctx.__owl__.props.slots || {};
  const slot = slots[name];
  if (slot && slot.__render) {
    const slotCtx = Object.create(slot.__ctx || {});
    if (slot.__scope) {
      const slotScope = dynScope ? Object.assign({}, dynScope()) : {};
      for (const key in scope) {
        defineComputed(slotScope, key, scope[key]);
      }
      slotCtx[slot.__scope] = slotScope;
    }
    return slot.__render(slotCtx, node);
  }
  if (defaultContent) {
    return defaultContent();
  }
  return text("");
}

function resolveComponent(parent: any, name: string): any {
  const components = parent.constructor.components;
  if (!components) {
    throw new OwlError(
      `Cannot find the definition of component "${name}", missing static components key in parent`
    );
  }
  const C = components[name];
  if (!C) {
    throw new OwlError(`Cannot find the definition of component "${name}"`);
  } else if (!(C.prototype instanceof Component)) {
    throw new OwlError(`"${name}" is not a Component. It must inherit from the Component class`);
  }
  return C;
}

/**
 * A child component. Its props are computed by a render effect in the parent:
 * the first run creates the component, the next ones update its props.
 */
function createComponent(C: any, node: ComponentNode, propsFn: () => any): Content {
  const owner = getCurrentOwner();
  let child: ComponentNode | null = null;
  let failed = false;
  renderEffect(() => {
    const props = propsFn();
    if (child) {
      const c = child;
      untrack(() => c.updateProps(props));
      return;
    }
    if (failed) {
      return;
    }
    untrack(() => {
      let c: ComponentNode;
      try {
        c = new ComponentNode(C, props, node.app, node.pluginManager, node, owner);
      } catch (e) {
        failed = true;
        throw e;
      }
      child = c;
      owner.components.push(c);
      try {
        c.start();
      } catch (error) {
        handleError({ node: c, error });
      }
    });
  });
  return child || text("");
}

function component(
  parent: any,
  ctx: any,
  node: ComponentNode,
  name: string,
  propsFn: () => any
): Content {
  return createComponent(resolveComponent(parent, name), node, propsFn);
}

function dynamicComponent(
  parent: any,
  ctx: any,
  node: ComponentNode,
  classFn: () => any,
  propsFn: () => any
): Content {
  return keyed(classFn, (C) => (C ? createComponent(C, node, propsFn) : text("")));
}

/** a .signal prop: one signal per component site, set by the props effect */
function propSignal(): (value: any) => ReactiveValue<any> {
  const s = signal<any>(undefined);
  const readonly = computed(s);
  return (value: any) => {
    s.set(value);
    return readonly;
  };
}

function createRef(ref: any) {
  if (!ref) {
    throw new OwlError(`Ref is undefined or null`);
  }
  if (ref.add && ref.delete) {
    return (el: HTMLElement | null, previousEl: HTMLElement | null) => {
      if (previousEl) {
        ref.delete(previousEl);
      }
      if (el) {
        ref.add(el);
      }
    };
  }
  if (ref.set) {
    // A sibling (e.g. t-if/t-else with a shared ref) may have taken the ref
    // over: only clear it if it still points to our element.
    const atom = ref[atomSymbol];
    return (el: HTMLElement | null, previousEl: HTMLElement | null) => {
      if (previousEl && (!atom || atom.value === previousEl)) {
        ref.set(null);
      }
      if (el) {
        ref.set(el);
      }
    };
  }
  throw new OwlError(
    `Ref should implement either a 'set' function or 'add' and 'delete' functions`
  );
}

function toNumber(val: string): number | string {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
}

function callHandler(fn: any, ctx: any, ev: Event) {
  if (typeof fn !== "function") {
    throw new OwlError(
      `Invalid handler expression: the \`t-on\` expression should evaluate to a function, but got '${typeof fn}'. ` +
        `Did you mean to use an arrow function? (e.g. \`t-on-click="() => expr"\`)`
    );
  }
  fn.call(ctx["this"], ev);
}

function modelExpr(value: any) {
  if (typeof value !== "function" || typeof value.set !== "function") {
    throw new OwlError(
      `Invalid t-model expression: expression should evaluate to a function with a 'set' method defined on it`
    );
  }
  return value;
}

export const helpers = {
  text,
  multi,
  toggle,
  keyed,
  list,
  out,
  catcher,
  renderEffect,
  callZero,
  callTemplate,
  callCtx,
  callSlot,
  component,
  dynamicComponent,
  tset,
  lazy,
  makeSlots,
  withDefault,
  zero,
  createRef,
  propSignal,
  modelExpr,
  toNumber,
  callHandler,
  markRaw,
  OwlError,
};
