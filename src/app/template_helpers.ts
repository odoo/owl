import { BDom, multi, text, toggler } from "../blockdom";
import { validateProps } from "../component/props_validation";
import { Markup } from "../utils";
import { html } from "../blockdom/index";

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
  const slots = (ctx.props && ctx.props.slots) || {};
  const { __render, __ctx, __scope } = slots[name] || {};
  const slotScope = Object.create(__ctx || {});
  if (__scope) {
    slotScope[__scope] = extra || {};
  }
  const slotBDom = __render ? __render.call(__ctx.__owl__.component, slotScope, parent, key) : null;
  if (defaultContent) {
    let child1: BDom | undefined = undefined;
    let child2: BDom | undefined = undefined;
    if (slotBDom) {
      child1 = dynamic ? toggler(name, slotBDom) : slotBDom;
    } else {
      child2 = defaultContent.call(ctx.__owl__.component, ctx, parent, key);
    }
    return multi([child1, child2]);
  }
  return slotBDom || text("");
}

function capture(ctx: any): any {
  const component = ctx.__owl__.component;
  const result = Object.create(component);
  for (let k in ctx) {
    result[k] = ctx[k];
  }
  return result;
}

function withKey(elem: any, k: string) {
  elem.key = k;
  return elem;
}

function prepareList(collection: any): [any[], any[], number, any[]] {
  let keys: any[];
  let values: any[];

  if (Array.isArray(collection)) {
    keys = collection;
    values = collection;
  } else if (collection) {
    values = Object.keys(collection);
    keys = Object.values(collection);
  } else {
    throw new Error("Invalid loop expression");
  }
  const n = values.length;
  return [keys, values, n, new Array(n)];
}

const isBoundary = Symbol("isBoundary");

function setContextValue(ctx: { [key: string]: any }, key: string, value: any): void {
  const ctx0 = ctx;
  while (!ctx.hasOwnProperty(key) && !ctx.hasOwnProperty(isBoundary)) {
    const newCtx = ctx.__proto__;
    if (!newCtx) {
      ctx = ctx0;
      break;
    }
    ctx = newCtx;
  }
  ctx[key] = value;
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

/*
 * Safely outputs `value` as a block depending on the nature of `value`
 */
export function safeOutput(value: any): ReturnType<typeof toggler> {
  if (!value) {
    return value;
  }
  let safeKey;
  let block;
  if (value instanceof Markup) {
    safeKey = `string_safe`;
    block = html(value as string);
  } else if (typeof value === "string") {
    safeKey = "string_unsafe";
    block = text(value);
  } else {
    // Assuming it is a block
    safeKey = "block_safe";
    block = value;
  }
  return toggler(safeKey, block);
}

let boundFunctions = new WeakMap();

function bind(ctx: any, fn: Function): Function {
  let component = ctx.__owl__.component;
  let boundFnMap = boundFunctions.get(component);
  if (!boundFnMap) {
    boundFnMap = new WeakMap();
    boundFunctions.set(component, boundFnMap);
  }
  let boundFn = boundFnMap.get(fn);
  if (!boundFn) {
    boundFn = fn.bind(component);
    boundFnMap.set(fn, boundFn);
  }
  return boundFn;
}

export const UTILS = {
  withDefault,
  zero: Symbol("zero"),
  isBoundary,
  callSlot,
  capture,
  withKey,
  prepareList,
  setContextValue,
  shallowEqual,
  toNumber,
  validateProps,
  safeOutput,
  bind,
};
