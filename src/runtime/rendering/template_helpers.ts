import { OwlError } from "../../common/owl_error";
import { App } from "../app";
import { BDom, createCatcher, multi, text, toggler } from "../blockdom";
import { html } from "../blockdom/index";
import { Component } from "../component";
import { ComponentNode } from "../component_node";
import { Portal } from "../portal";
import { markRaw } from "../reactivity/proxy";
import { Markup } from "../utils";
import { Fiber } from "./fibers";

const ObjectCreate = Object.create;
/**
 * This file contains utility functions that will be injected in each template,
 * to perform various useful tasks in the compiled code.
 */

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

function callSlot(
  ctx: any,
  parent: any,
  key: string,
  name: string,
  dynamic: boolean,
  extra: any,
  defaultContent?: (ctx: any, node: any, key: string) => BDom
): BDom {
  key = key + "__slot_" + name;
  const slots = ctx.__owl__.props.slots || {};
  const { __render, __ctx, __scope } = slots[name] || {};
  const slotScope = ObjectCreate(__ctx || {});
  if (__scope) {
    slotScope[__scope] = extra;
  }
  const slotBDom = __render ? __render(slotScope, parent, key) : null;
  if (defaultContent) {
    let child1: BDom | undefined = undefined;
    let child2: BDom | undefined = undefined;
    if (slotBDom) {
      child1 = dynamic ? toggler(name, slotBDom) : slotBDom;
    } else {
      child2 = defaultContent(ctx, parent, key);
    }
    return multi([child1, child2]);
  }
  return slotBDom || text("");
}

function withKey(elem: any, k: string) {
  elem.key = k;
  return elem;
}

function prepareList(collection: unknown): [unknown[], unknown[], number, undefined[]] {
  let keys: unknown[];
  let values: unknown[];

  if (Array.isArray(collection)) {
    keys = collection;
    values = collection;
  } else if (collection instanceof Map) {
    keys = [...collection.keys()];
    values = [...collection.values()];
  } else if (Symbol.iterator in Object(collection)) {
    keys = [...(<Iterable<unknown>>collection)];
    values = keys;
  } else if (collection && typeof collection === "object") {
    values = Object.values(collection);
    keys = Object.keys(collection);
  } else {
    throw new OwlError(`Invalid loop expression: "${collection}" is not iterable`);
  }
  const n = values.length;
  return [keys, values, n, new Array(n)];
}

function toNumber(val: string): number | string {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
}

function shallowEqual(l1: any[], l2: any[]): boolean {
  for (let i = 0, l = l1.length; i < l; i++) {
    if (l1[i] !== l2[i]) {
      return false;
    }
  }
  return true;
}

class LazyValue {
  fn: any;
  ctx: any;
  component: any;
  node: any;
  key: any;

  constructor(fn: any, ctx: any, component: any, node: any, key: any) {
    this.fn = fn;
    this.ctx = ctx;
    this.component = component;
    this.node = node;
    this.key = key;
  }

  evaluate(): any {
    return this.fn.call(this.component, this.ctx, this.node, this.key);
  }

  toString() {
    return this.evaluate().toString();
  }
}

/*
 * Safely outputs `value` as a block depending on the nature of `value`
 */
export function safeOutput(value: any, defaultValue?: any): ReturnType<typeof toggler> {
  if (value === undefined || value === null) {
    return defaultValue ? toggler("default", defaultValue) : toggler("undefined", text(""));
  }
  let safeKey;
  let block;
  if (value instanceof Markup) {
    safeKey = `string_safe`;
    block = html(value as string);
  } else if (value instanceof LazyValue) {
    safeKey = `lazy_value`;
    block = value.evaluate();
  } else {
    safeKey = "string_unsafe";
    block = text(value);
  }
  return toggler(safeKey, block);
}

function createRef(ref: any) {
  if (!ref) {
    throw new OwlError(`Ref is undefined or null`);
  }

  let add: (el: HTMLElement) => void;
  let remove: (el: HTMLElement) => void;

  if (ref.add && ref.delete) {
    add = ref.add.bind(ref);
    remove = ref.delete.bind(ref);
  } else if (ref.set) {
    add = ref.set.bind(ref);
    remove = () => ref.set(null);
  } else {
    throw new OwlError(
      `Ref should implement either a 'set' function or 'add' and 'delete' functions`
    );
  }

  return (el: HTMLElement | null, previousEl: HTMLElement | null) => {
    if (previousEl) {
      remove(previousEl);
    }
    if (el) {
      add(el);
    }
  };
}

function modelExpr(value: any) {
  if (typeof value !== "function" || typeof value.set !== "function") {
    throw new OwlError(
      `Invalid t-model expression: expression should evaluate to a function with a 'set' method defined on it`
    );
  }
  return value;
}


function createComponent<P extends Record<string, any>>(
  app: App,
  name: string | null,
  isStatic: boolean,
  hasSlotsProp: boolean,
  hasDynamicPropList: boolean,
  propList: string[]
) {
  const isDynamic = !isStatic;
  let arePropsDifferent: (p1: P, p2: P) => boolean;
  const hasNoProp = propList.length === 0;
  if (hasSlotsProp) {
    arePropsDifferent = (_1, _2) => true;
  } else if (hasDynamicPropList) {
    arePropsDifferent = function (props1: P, props2: P) {
      for (let k in props1) {
        if (props1[k] !== props2[k]) {
          return true;
        }
      }
      return Object.keys(props1).length !== Object.keys(props2).length;
    };
  } else if (hasNoProp) {
    arePropsDifferent = (_1: any, _2: any) => false;
  } else {
    arePropsDifferent = function (props1: P, props2: P) {
      for (let p of propList) {
        if (props1[p] !== props2[p]) {
          return true;
        }
      }
      return false;
    };
  }

  const updateAndRender = ComponentNode.prototype.updateAndRender;
  const initiateRender = ComponentNode.prototype.initiateRender;

  return (props: P, key: string, ctx: ComponentNode, parent: any, C: any) => {
    let children = ctx.children;
    let node: any = children[key];
    if (isDynamic && node && node.component.constructor !== C) {
      node = undefined;
    }
    const parentFiber = ctx.fiber!;
    if (node) {
      if (arePropsDifferent(node.props, props) || parentFiber.deep || node.forceNextRender) {
        node.forceNextRender = false;
        updateAndRender.call(node, props, parentFiber);
      }
    } else {
      // new component
      if (isStatic) {
        const components = parent.constructor.components;
        if (!components) {
          throw new OwlError(
            `Cannot find the definition of component "${name}", missing static components key in parent`
          );
        }
        C = components[name as any];
        if (!C) {
          throw new OwlError(`Cannot find the definition of component "${name}"`);
        } else if (!(C.prototype instanceof Component)) {
          throw new OwlError(
            `"${name}" is not a Component. It must inherit from the Component class`
          );
        }
      }
      node = new ComponentNode(C, props, app, ctx, key);
      children[key] = node;
      initiateRender.call(node, new Fiber(node, parentFiber));
    }
    parentFiber.childrenMap[key] = node;
    return node;
  };
}

function callTemplate(subTemplate: string, owner: any, app: App, ctx: any, parent: any, key: any): any {
  const template = app.getTemplate(subTemplate);
  return toggler(subTemplate, template.call(owner, ctx, parent, key + subTemplate));
}

export const helpers = {
  withDefault,
  zero: Symbol("zero"),
  callSlot,
  withKey,
  prepareList,
  shallowEqual,
  toNumber,
  LazyValue,
  safeOutput,
  createCatcher,
  markRaw,
  OwlError,
  createRef,
  modelExpr,
  createComponent,
  Portal,
  callTemplate,
};
