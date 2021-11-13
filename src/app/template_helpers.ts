import { BDom, multi, text, toggler } from "../blockdom";
import { validateProps } from "../component/props_validation";

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
}

function callSlot(
  ctx: any,
  parent: any,
  key: string,
  name: string,
  defaultSlot?: (ctx: any, key: string) => BDom,
  dynamic?: boolean
): BDom {
  const slots = ctx.__owl__.slots;
  const slotFn = slots[name];
  const slotBDom = slotFn ? slotFn(parent, key) : null;
  if (defaultSlot) {
    let child1: BDom | undefined = undefined;
    let child2: BDom | undefined = undefined;
    // const result = new BMulti(2);
    if (slotBDom) {
      child1 = dynamic ? toggler(name, slotBDom) : slotBDom;
    } else {
      child2 = defaultSlot(parent, key);
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
};
