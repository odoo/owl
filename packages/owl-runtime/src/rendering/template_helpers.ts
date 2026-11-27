import { atomSymbol, markRaw, OwlError } from "@odoo/owl-core";
import type { TemplateHelpers } from "@odoo/owl-compiler";
import type { TemplateSet } from "../template_set";
import { createCatcher, html, text, toggler } from "@odoo/owl-blockdom";
import { Markup } from "../utils";

/**
 * This file contains utility functions that will be injected in each template,
 * to perform various useful tasks in the compiled code. The ones about
 * components are in component_helpers.ts.
 */

function withDefault(value: any, defaultValue: any): any {
  return value === undefined || value === null || value === false ? defaultValue : value;
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

// The node a template is rendered for, as seen by refs: a component node
// tracks the signal refs bound to its elements.
interface RefHost {
  trackRef(ref: { set(v: null): void }, atom: { value: HTMLElement | null }): void;
}

function createRef(ref: any, node: RefHost) {
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
    // A sibling slot in the same patch may have already taken ownership of the
    // signal (e.g. t-if/t-else swap with a shared ref). In that case the new
    // element is mounted before this branch's remove runs, so only clear the
    // ref if it still points to the element we're unbinding.
    const atom = (ref as any)[atomSymbol];
    remove = atom
      ? (prevEl: HTMLElement) => {
          if (atom.value === prevEl) ref.set(null);
        }
      : () => ref.set(null);
    // The block-ref callback above only fires when this block's own remove() is
    // called. When an enclosing block is removed in bulk (e.g. a slot host),
    // the callback is skipped and the signal would keep pointing at a detached
    // element. Track the ref on its host component, which clears it on unmount
    // and sweeps detached refs after each patch. `node` is the host even for
    // forwarded slot content (createRef sees the innermost host via callSlot).
    if (atom) {
      node.trackRef(ref, atom);
    }
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

function callTemplate(
  subTemplate: string,
  owner: any,
  templates: TemplateSet,
  ctx: any,
  parent: any,
  key: any
): any {
  const template = templates.getTemplate(subTemplate);
  return toggler(subTemplate, template.call(owner, ctx, parent, key + subTemplate));
}

// Implements the part of the contract that compiled templates rely on for
// everything but components. `__globals__` is added by each template set.
export const templateHelpers = {
  withDefault,
  zero: Symbol("zero"),
  withKey,
  prepareList,
  toNumber,
  LazyValue,
  safeOutput,
  createCatcher,
  markRaw,
  OwlError,
  createRef,
  modelExpr,
  callTemplate,
  callHandler,
} satisfies Omit<TemplateHelpers, "__globals__">;
