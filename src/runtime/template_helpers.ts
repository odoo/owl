import { BDom, multi, text, toggler, createCatcher } from "./blockdom";
import { Markup } from "./utils";
import { html } from "./blockdom/index";
import { isOptional, validateSchema } from "./validation";
import type { ComponentConstructor } from "./component";
import { markRaw } from "./reactivity";
import { OwlError } from "../common/owl_error";
import type { ComponentNode } from "./component_node";

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
  const slots = ctx.props.slots || {};
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

function capture(ctx: any): any {
  const result = ObjectCreate(ctx);
  for (let k in ctx) {
    result[k] = ctx[k];
  }
  return result;
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

class LazyValue {
  fn: any;
  ctx: any;
  component: any;
  node: any;
  key: any;

  constructor(fn: any, ctx: any, component: any, node: any, key: any) {
    this.fn = fn;
    this.ctx = capture(ctx);
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
  switch (typeof value) {
    case "object":
      if (value instanceof Markup) {
        safeKey = `string_safe`;
        block = html(value as string);
      } else if (value instanceof LazyValue) {
        safeKey = `lazy_value`;
        block = value.evaluate();
      } else if (value instanceof String) {
        safeKey = "string_unsafe";
        block = text(value);
      } else {
        // Assuming it is a block
        safeKey = "block_safe";
        block = value;
      }
      break;
    case "string":
      safeKey = "string_unsafe";
      block = text(value);
      break;
    default:
      safeKey = "string_unsafe";
      block = text(String(value));
  }
  return toggler(safeKey, block);
}

/**
 * Validate the component props (or next props) against the (static) props
 * description.  This is potentially an expensive operation: it may needs to
 * visit recursively the props and all the children to check if they are valid.
 * This is why it is only done in 'dev' mode.
 */
export function validateProps<P>(name: string | ComponentConstructor<P>, props: P, comp?: any) {
  const ComponentClass =
    typeof name !== "string"
      ? name
      : (comp.constructor.components[name] as ComponentConstructor<P> | undefined);

  if (!ComponentClass) {
    // this is an error, wrong component. We silently return here instead so the
    // error is triggered by the usual path ('component' function)
    return;
  }

  const schema = ComponentClass.props;
  if (!schema) {
    if (comp.__owl__.app.warnIfNoStaticProps) {
      console.warn(`Component '${ComponentClass.name}' does not have a static props description`);
    }
    return;
  }
  const defaultProps = ComponentClass.defaultProps;
  if (defaultProps) {
    let isMandatory = (name: string) =>
      Array.isArray(schema)
        ? schema.includes(name)
        : name in schema && !("*" in schema) && !isOptional(schema[name]);
    for (let p in defaultProps) {
      if (isMandatory(p)) {
        throw new OwlError(
          `A default value cannot be defined for a mandatory prop (name: '${p}', component: ${ComponentClass.name})`
        );
      }
    }
  }

  const errors = validateSchema(props, schema);
  if (errors.length) {
    throw new OwlError(
      `Invalid props for component '${ComponentClass.name}': ` + errors.join(", ")
    );
  }
}

function makeRefWrapper(node: ComponentNode) {
  let refNames: Set<String> = new Set();
  return (name: string, fn: Function) => {
    if (refNames.has(name)) {
      throw new OwlError(
        `Cannot set the same ref more than once in the same component, ref "${name}" was set multiple times in ${node.name}`
      );
    }
    refNames.add(name);
    return fn;
  };
}

export const helpers = {
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
  LazyValue,
  safeOutput,
  createCatcher,
  markRaw,
  OwlError,
  makeRefWrapper,
};
