import {
  ComputationAtom,
  ComputationFlags,
  createComputation,
  getCurrentComputation,
  OwlError,
  removeSources,
  setComputation,
  signal,
  Signal,
  STATUS,
  updateComputation,
} from "@odoo/owl-core";
import type { ComponentNode } from "../component_node";
import { createEventHandler } from "../blockdom/events";
import { toText } from "../blockdom/text";
import { Markup } from "../utils";
import { handleError } from "./error_handling";

// -----------------------------------------------------------------------------
// Render-once rendering
// -----------------------------------------------------------------------------
//
// A template is instantiated once, and produces a Content: a range of sibling
// DOM nodes. What changes afterwards is handled by render effects:
//
// - a block (cloned static DOM) has one render effect, which keeps its
//   attributes and properties up to date;
// - a structural node (t-if, t-foreach, t-out, a component, ...) is a region:
//   its render effect decides which sub-contents exist, creates the missing
//   ones and disposes the others.
//
// Everything created while instantiating a content belongs to an Owner: render
// effects, components, cleanups (refs) and nested owners. Disposing an owner
// disposes all of it. Owners have a depth, which orders the flush of render
// effects: a region runs before what it contains, so a child never updates
// from a state its parent is about to discard.
// -----------------------------------------------------------------------------

export interface Content {
  /** Inserts (or moves) the nodes of the content before `ref`, in `parent`. */
  mount(parent: Node, ref: Node | null): void;
  /** Detaches the nodes of the content. */
  remove(): void;
  firstNode(): Node;
  lastNode(): Node;
}

// -----------------------------------------------------------------------------
// Owner
// -----------------------------------------------------------------------------

export class Owner {
  // the component hosting what this owner owns (null for some test helpers)
  node: ComponentNode;
  parent: Owner | null;
  depth: number;
  effects: ComputationAtom[] = [];
  // components created directly in this owner
  components: ComponentNode[] = [];
  children: Set<Owner> | null = null;
  cleanups: (() => void)[] | null = null;
  disposed = false;

  /**
   * `register` is false for the owner of a component's content: it gets its
   * depth from the owner where the component was created, but it is not one of
   * its children (the component, listed in `components`, manages it).
   */
  constructor(node: ComponentNode, parent: Owner | null, register = true) {
    this.node = node;
    this.parent = register ? parent : null;
    this.depth = parent ? parent.depth + 1 : 0;
    if (parent && register) {
      (parent.children ||= new Set()).add(this);
    }
  }

  /** Calls the willUnmount hooks of the mounted components (parents first). */
  unmount() {
    for (const component of this.components) {
      component.unmount();
    }
    if (this.children) {
      for (const child of this.children) {
        child.unmount();
      }
    }
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.children) {
      for (const child of this.children) {
        child.dispose();
      }
      this.children = null;
    }
    for (const component of this.components) {
      component.dispose();
    }
    for (const effect of this.effects) {
      // executed and disposed: a queued run is skipped
      effect.flags = (effect.flags & ~ComputationFlags.STATE_MASK) | ComputationFlags.DISPOSED;
      removeSources(effect);
    }
    if (this.cleanups) {
      for (const cleanup of this.cleanups) {
        cleanup();
      }
    }
    if (this.parent && !this.parent.disposed) {
      this.parent.children!.delete(this);
    }
  }
}

let currentOwner: Owner | null = null;
// used when a template is instantiated outside of any owner (never disposed)
let detachedOwner: Owner | null = null;

export function getCurrentOwner(): Owner {
  return currentOwner || (detachedOwner ||= new Owner(null as any, null));
}

/**
 * Runs `fn` with `owner` as the current owner, without tracking: what `fn`
 * reads does not subscribe the computation currently running (e.g. a region
 * creating a branch from its render effect).
 */
export function create<T>(owner: Owner, fn: () => T): T {
  const previousOwner = currentOwner;
  const previousComputation = getCurrentComputation();
  currentOwner = owner;
  setComputation(undefined);
  try {
    return fn();
  } finally {
    currentOwner = previousOwner;
    setComputation(previousComputation);
  }
}

function untracked<T>(fn: () => T): T {
  const previousComputation = getCurrentComputation();
  setComputation(undefined);
  try {
    return fn();
  } finally {
    setComputation(previousComputation);
  }
}

/** Registers a function to call when the current owner is disposed. */
export function addCleanup(fn: () => void) {
  (getCurrentOwner().cleanups ||= []).push(fn);
}

/**
 * Creates a render effect in the current owner, and runs it. It re-runs (in
 * the effect flush, parents first) when something it read changes. An error
 * is routed to the component hosting it.
 */
export function renderEffect(fn: () => void) {
  const owner = getCurrentOwner();
  const effect = createComputation(() => {
    try {
      fn();
    } catch (error) {
      handleError({ node: owner.node, error });
    }
  }, ComputationFlags.RENDER | ComputationFlags.STALE);
  effect.depth = owner.depth;
  owner.effects.push(effect);
  updateComputation(effect);
}

// -----------------------------------------------------------------------------
// Mounting
// -----------------------------------------------------------------------------

/**
 * Marks a rendered component tree as mounted, in reverse creation order (so
 * children before their parent, and the last sibling first).
 */
export function mountTree(node: ComponentNode) {
  if (node.status !== STATUS.NEW || node.pending) {
    return;
  }
  const children = [...node.children];
  for (let i = children.length - 1; i >= 0; i--) {
    mountTree(children[i]);
  }
  node.status = STATUS.MOUNTED;
  for (const cb of node.mounted) {
    try {
      cb();
    } catch (error) {
      handleError({ node, error });
    }
  }
}

function mountOwnerComponents(owner: Owner) {
  if (owner.children) {
    const children = [...owner.children];
    for (let i = children.length - 1; i >= 0; i--) {
      mountOwnerComponents(children[i]);
    }
  }
  const components = owner.components;
  for (let i = components.length - 1; i >= 0; i--) {
    mountTree(components[i]);
  }
}

/**
 * Called once the content of `owner` is inserted in the dom: its components
 * are mounted if their host is. Otherwise, the host mounts them when it is
 * mounted itself.
 */
export function mountOwner(owner: Owner) {
  if (owner.node && owner.node.status === STATUS.MOUNTED) {
    mountOwnerComponents(owner);
  }
}

// -----------------------------------------------------------------------------
// Static contents
// -----------------------------------------------------------------------------

export class TextContent implements Content {
  node: Text;

  constructor(value: string) {
    this.node = document.createTextNode(value);
  }

  mount(parent: Node, ref: Node | null) {
    parent.insertBefore(this.node, ref);
  }

  remove() {
    this.node.remove();
  }

  firstNode(): Node {
    return this.node;
  }

  lastNode(): Node {
    return this.node;
  }
}

export function text(value: string): Content {
  return new TextContent(value);
}

export class Multi implements Content {
  contents: Content[];

  constructor(contents: Content[]) {
    this.contents = contents;
  }

  mount(parent: Node, ref: Node | null) {
    for (const content of this.contents) {
      content.mount(parent, ref);
    }
  }

  remove() {
    for (const content of this.contents) {
      content.remove();
    }
  }

  firstNode(): Node {
    return this.contents[0].firstNode();
  }

  lastNode(): Node {
    return this.contents[this.contents.length - 1].lastNode();
  }
}

export function multi(contents: Content[]): Content {
  return new Multi(contents);
}

export class HtmlContent implements Content {
  nodes: ChildNode[];

  constructor(html: string) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const nodes = [...(template.content.childNodes as any)] as ChildNode[];
    if (!nodes.length) {
      nodes.push(document.createTextNode(""));
    }
    this.nodes = nodes;
  }

  mount(parent: Node, ref: Node | null) {
    for (const node of this.nodes) {
      parent.insertBefore(node, ref);
    }
  }

  remove() {
    for (const node of this.nodes) {
      node.remove();
    }
  }

  firstNode(): Node {
    return this.nodes[0];
  }

  lastNode(): Node {
    return this.nodes[this.nodes.length - 1];
  }
}

/** The body of a t-set, instantiated where it is output. */
export class LazyValue {
  fn: () => Content;

  constructor(fn: () => Content) {
    this.fn = fn;
  }

  evaluate(): Content {
    return this.fn();
  }

  toString() {
    const owner = new Owner(currentOwner?.node as ComponentNode, null);
    const content = create(owner, this.fn);
    const div = document.createElement("div");
    content.mount(div, null);
    owner.dispose();
    return div.innerHTML;
  }
}

// -----------------------------------------------------------------------------
// Regions
// -----------------------------------------------------------------------------

/**
 * A region holds one sub-content (an empty text when there is nothing to
 * show), owned by a dedicated owner so that it can be disposed independently.
 * It has no anchor: a new sub-content is inserted before the current one.
 */
abstract class Region implements Content {
  owner: Owner;
  content: Content = null as any;
  contentOwner: Owner | null = null;

  constructor() {
    this.owner = getCurrentOwner();
  }

  /** Runs the render effect of the region (which sets its content). */
  init(fn: () => void) {
    renderEffect(fn);
    // the first run failed (and the error was handled): show nothing
    this.content ||= new TextContent("");
  }

  mount(parent: Node, ref: Node | null) {
    this.content.mount(parent, ref);
  }

  remove() {
    this.content.remove();
  }

  firstNode(): Node {
    return this.content.firstNode();
  }

  lastNode(): Node {
    return this.content.lastNode();
  }

  /**
   * Replaces the current sub-content by the one `build` creates (in a new
   * owner, unless `withOwner` is false: for a content that owns nothing).
   * The new content is created first, then the current one is removed.
   */
  replace(build: (() => Content) | null, withOwner = true) {
    untracked(() => {
      let owner: Owner | null = null;
      let content: Content;
      if (!build) {
        content = new TextContent("");
      } else if (withOwner) {
        owner = new Owner(this.owner.node, this.owner);
        content = create(owner, build);
      } else {
        content = build();
      }
      const previous = this.content;
      const previousOwner = this.contentOwner;
      this.content = content;
      this.contentOwner = owner;
      if (previous) {
        const first = previous.firstNode();
        const parent = first.parentNode;
        previousOwner?.unmount();
        if (parent) {
          content.mount(parent, first);
        }
        previous.remove();
        previousOwner?.dispose();
        if (parent && owner) {
          mountOwner(owner);
        }
      }
    });
  }
}

/** t-if/t-elif/t-else: `select` returns the index of the branch to show. */
class Toggle extends Region {
  // -1 means no branch: the first run always sets the content
  index = -2;

  constructor(select: () => number, branches: (() => Content)[]) {
    super();
    this.init(() => {
      const index = select();
      if (index !== this.index) {
        this.index = index;
        this.replace(index >= 0 ? branches[index] : null);
      }
    });
  }
}

export function toggle(select: () => number, branches: (() => Content)[]): Content {
  return new Toggle(select, branches);
}

const NO_KEY = {};

/** Re-creates its content when its key changes (t-key, dynamic tags, ...). */
class Keyed extends Region {
  key: any = NO_KEY;

  constructor(keyFn: () => any, build: (key: any) => Content) {
    super();
    this.init(() => {
      const key = keyFn();
      if (key !== this.key) {
        this.key = key;
        this.replace(() => build(key));
      }
    });
  }
}

export function keyed(keyFn: () => any, build: (key: any) => Content): Content {
  return new Keyed(keyFn, build);
}

const OUT_EMPTY = 0;
const OUT_TEXT = 1;
const OUT_MARKUP = 2;
const OUT_LAZY = 3;

/** t-out: a text, some markup, a t-set body, or the default content. */
class Out extends Region {
  kind = -1;
  value: any = undefined;

  constructor(valueFn: () => any, defaultContent?: () => Content) {
    super();
    this.init(() => {
      const value = valueFn();
      if (value === undefined || value === null) {
        if (this.kind !== OUT_EMPTY) {
          this.kind = OUT_EMPTY;
          this.value = undefined;
          this.replace(defaultContent || null);
        }
      } else if (value instanceof Markup) {
        const html = value.toString();
        if (this.kind !== OUT_MARKUP || this.value !== html) {
          this.kind = OUT_MARKUP;
          this.value = html;
          this.replace(() => new HtmlContent(html), false);
        }
      } else if (value instanceof LazyValue) {
        if (this.kind !== OUT_LAZY || this.value !== value) {
          this.kind = OUT_LAZY;
          this.value = value;
          this.replace(() => value.evaluate());
        }
      } else {
        const str = toText(value);
        if (this.kind === OUT_TEXT) {
          if (this.value !== str) {
            this.value = str;
            (this.content as TextContent).node.data = str;
          }
        } else {
          this.kind = OUT_TEXT;
          this.value = str;
          this.replace(() => new TextContent(str), false);
        }
      }
    });
  }
}

export function out(valueFn: () => any, defaultContent?: () => Content): Content {
  return new Out(valueFn, defaultContent);
}

// -----------------------------------------------------------------------------
// List (t-foreach)
// -----------------------------------------------------------------------------

export function prepareList(collection: unknown): [unknown[], unknown[], number] {
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
  return [keys, values, values.length];
}

interface Row {
  key: any;
  owner: Owner;
  content: Content;
  item: Signal<any>;
  // only for the loop variables that the body uses
  value: Signal<any> | null;
  index: Signal<number> | null;
  last: Signal<boolean> | null;
  isNew: boolean;
}

// same flags as ForEachNoFlag in the compiler
const NO_FIRST = 1;
const NO_LAST = 2;
const NO_INDEX = 4;
const NO_VALUE = 8;

/**
 * A keyed list. Its render effect reads the collection and the keys only:
 * rows are created once, and their loop variables are signals, so a kept row
 * only updates what depends on a changed variable.
 */
class List implements Content {
  anchor: Text = document.createTextNode("");
  owner: Owner;
  ctx: any;
  elem: string;
  noFlags: number;
  rowFn: (ctx: any) => Content;
  rows: Row[] = [];
  map: Map<any, Row> = new Map();

  constructor(
    collectionFn: () => any,
    ctx: any,
    elem: string,
    keyFn: ((ctx: any) => any) | null,
    noFlags: number,
    rowFn: (ctx: any) => Content,
    dev: boolean
  ) {
    this.owner = getCurrentOwner();
    this.ctx = ctx;
    this.elem = elem;
    this.noFlags = noFlags;
    this.rowFn = rowFn;
    // context used to evaluate the keys, before the rows exist. Its variables
    // are own writable properties: they may shadow getters of an outer row
    // with the same loop variable name.
    const indexName = `${elem}_index`;
    const valueName = `${elem}_value`;
    const firstName = `${elem}_first`;
    const lastName = `${elem}_last`;
    const keyCtx = keyFn ? Object.create(ctx) : null;
    if (keyCtx) {
      for (const name of [elem, indexName, valueName, firstName, lastName]) {
        Object.defineProperty(keyCtx, name, { value: undefined, writable: true });
      }
    }
    renderEffect(() => {
      const [collectionKeys, collectionValues, n] = prepareList(collectionFn());
      // read the collection once (subscribing to it), into plain arrays
      const keys = new Array(n);
      for (let i = 0; i < n; i++) {
        keys[i] = collectionKeys[i];
      }
      let values = keys;
      if (collectionValues !== collectionKeys) {
        values = new Array(n);
        for (let i = 0; i < n; i++) {
          values[i] = collectionValues[i];
        }
      }
      const rowKeys = new Array(n);
      if (keyFn) {
        for (let i = 0; i < n; i++) {
          keyCtx[elem] = keys[i];
          keyCtx[indexName] = i;
          keyCtx[valueName] = values[i];
          keyCtx[firstName] = i === 0;
          keyCtx[lastName] = i === n - 1;
          rowKeys[i] = keyFn(keyCtx);
        }
        if (dev) {
          const seen = new Set();
          for (const key of rowKeys) {
            if (seen.has(String(key))) {
              throw new OwlError(`Got duplicate key in t-foreach: ${key}`);
            }
            seen.add(String(key));
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          rowKeys[i] = i;
        }
      }
      untracked(() => this.update(keys, values, rowKeys, n));
    });
  }

  createRow(item: any, value: any, index: number, n: number, key: any): Row {
    const owner = new Owner(this.owner.node, this.owner);
    const noFlags = this.noFlags;
    const row: Row = {
      key,
      owner,
      content: null as any,
      item: signal(item),
      value: noFlags & NO_VALUE ? null : signal(value),
      index: noFlags & NO_INDEX && noFlags & NO_FIRST ? null : signal(index),
      last: noFlags & NO_LAST ? null : signal(index === n - 1),
      isNew: true,
    };
    const elem = this.elem;
    const ctx = Object.create(this.ctx);
    Object.defineProperty(ctx, elem, { get: row.item, enumerable: true });
    if (row.value) {
      Object.defineProperty(ctx, `${elem}_value`, { get: row.value, enumerable: true });
    }
    if (!(noFlags & NO_INDEX)) {
      Object.defineProperty(ctx, `${elem}_index`, { get: row.index!, enumerable: true });
    }
    if (!(noFlags & NO_FIRST)) {
      Object.defineProperty(ctx, `${elem}_first`, {
        get: () => row.index!() === 0,
        enumerable: true,
      });
    }
    if (row.last) {
      Object.defineProperty(ctx, `${elem}_last`, { get: row.last, enumerable: true });
    }
    row.content = create(owner, () => this.rowFn(ctx));
    return row;
  }

  update(keys: any[], values: any[], rowKeys: any[], n: number) {
    const oldMap = this.map;
    const map = new Map();
    const rows: Row[] = new Array(n);
    let created: Row[] | null = null;
    for (let i = 0; i < n; i++) {
      const key = rowKeys[i];
      let row = oldMap.get(key);
      if (row) {
        oldMap.delete(key);
        row.isNew = false;
        row.item.set(keys[i]);
        row.value?.set(values[i]);
        row.index?.set(i);
        row.last?.set(i === n - 1);
      } else {
        row = this.createRow(keys[i], values[i], i, n, key);
        (created ||= []).push(row);
      }
      map.set(key, row);
      rows[i] = row;
    }
    const parent = this.anchor.parentNode;
    if (oldMap.size) {
      for (const row of oldMap.values()) {
        row.owner.unmount();
      }
      if (n === 0 && parent && this.isAlone(parent)) {
        // the list is all its parent contains: clear it at once
        parent.textContent = "";
        parent.appendChild(this.anchor);
      } else {
        for (const row of oldMap.values()) {
          row.content.remove();
        }
      }
      for (const row of oldMap.values()) {
        row.owner.dispose();
      }
    }
    this.map = map;
    this.rows = rows;

    if (parent) {
      // place the rows from the end: a kept row only moves if it is not
      // already right before the next one
      let next: Node = this.anchor;
      for (let i = n - 1; i >= 0; i--) {
        const row = rows[i];
        if (row.isNew || row.content.lastNode().nextSibling !== next) {
          row.content.mount(parent, next);
        }
        next = row.content.firstNode();
      }
      if (created) {
        for (const row of created) {
          mountOwner(row.owner);
        }
      }
    }
  }

  /** whether the (current) rows and the anchor are all that `parent` contains */
  isAlone(parent: Node): boolean {
    return (
      parent.lastChild === this.anchor &&
      parent.firstChild === (this.rows.length ? this.rows[0].content.firstNode() : this.anchor)
    );
  }

  mount(parent: Node, ref: Node | null) {
    for (const row of this.rows) {
      row.content.mount(parent, ref);
    }
    parent.insertBefore(this.anchor, ref);
  }

  remove() {
    for (const row of this.rows) {
      row.content.remove();
    }
    this.anchor.remove();
  }

  firstNode(): Node {
    return this.rows.length ? this.rows[0].content.firstNode() : this.anchor;
  }

  lastNode(): Node {
    return this.anchor;
  }
}

export function list(
  collectionFn: () => any,
  ctx: any,
  elem: string,
  keyFn: ((ctx: any) => any) | null,
  noFlags: number,
  rowFn: (ctx: any) => Content,
  dev: boolean
): Content {
  return new List(collectionFn, ctx, elem, keyFn, noFlags, rowFn, dev);
}

// -----------------------------------------------------------------------------
// Event catcher (t-on on a component or a slot)
// -----------------------------------------------------------------------------

/**
 * Listens on the parent element, and calls the handlers for events whose
 * target is inside the nodes of its child content (checked when the event
 * happens, so the child content may change).
 */
class Catcher implements Content {
  child: Content;
  handlers: { [event: string]: any[] };
  parentEl: Node | null = null;

  constructor(child: Content, handlers: { [event: string]: any[] }) {
    this.child = child;
    this.handlers = handlers;
    for (const event in handlers) {
      const data = handlers[event];
      // data = [...modifiers, fn, ctx]
      const idx = data.length - 2;
      const fn = data[idx];
      data[idx] = (ctx: any, ev: Event) => {
        const target = ev.target as Node;
        let current: Node | null = child.firstNode();
        const last = child.lastNode();
        while (current) {
          if (current.contains(target)) {
            return fn(ctx, ev);
          }
          if (current === last) {
            break;
          }
          current = current.nextSibling;
        }
      };
    }
  }

  mount(parent: Node, ref: Node | null) {
    this.child.mount(parent, ref);
    if (parent !== this.parentEl) {
      this.parentEl = parent;
      for (const event in this.handlers) {
        createEventHandler(event).setup.call(parent as HTMLElement, this.handlers[event]);
      }
    }
  }

  remove() {
    this.child.remove();
  }

  firstNode(): Node {
    return this.child.firstNode();
  }

  lastNode(): Node {
    return this.child.lastNode();
  }
}

export function catcher(child: Content, handlers: { [event: string]: any[] }): Content {
  return new Catcher(child, handlers);
}
