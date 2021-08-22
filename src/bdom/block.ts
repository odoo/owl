import type { VNode } from "./index";
import { toText } from "./text";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;
const elementProto = Element.prototype;
const characterDataProto = CharacterData.prototype;

const characterDataSetData = getDescriptor(characterDataProto, "data").set!;
const nodeGetFirstChild = getDescriptor(nodeProto, "firstChild").get!;
const nodeGetNextSibling = getDescriptor(nodeProto, "nextSibling").get!;

const NO_OP = () => {};

export const config = {
  shouldNormalizeDom: true,
  mainEventHandler: (data: any, ev: Event) => data(ev),
};

// -----------------------------------------------------------------------------
// Block
// -----------------------------------------------------------------------------

type BlockType = (data?: any[], children?: VNode[]) => VNode;

const cache: { [key: string]: BlockType } = {};

export function createBlock(str: string): BlockType {
  if (str in cache) {
    return cache[str];
  }
  const info: BuilderContext["info"] = [];
  const ctx: BuilderContext = {
    path: ["el"],
    info,
  };

  const doc = new DOMParser().parseFromString(str, "text/xml");
  const node = doc.firstChild!;
  if (config.shouldNormalizeDom) {
    normalizeNode(node as any);
  }
  const template = processDescription(node, ctx) as any;

  const result = compileBlock(info, template);
  cache[str] = result;
  return result;
}

function normalizeNode(node: HTMLElement | Text) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!/\S/.test((node as Text).textContent!)) {
      (node as Text).remove();
      return;
    }
    // node.textContent = node.textContent!.trim();
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if ((node as HTMLElement).tagName === "pre") {
      return;
    }
  }
  for (let i = node.childNodes.length - 1; i >= 0; --i) {
    normalizeNode(node.childNodes.item(i) as any);
  }
}

// -----------------------------------------------------------------------------
// Process description
// -----------------------------------------------------------------------------

interface BlockInfo {
  index: number;
  refIndex?: number;
  type: "text" | "child" | "handler" | "attribute" | "attributes" | "ref";
  path: string[];
  event?: string;
  name?: string;
  tag?: string;
  isOnlyChild?: boolean;
  parentPath?: string[];
}

interface BuilderContext {
  path: string[];
  info: BlockInfo[];
}

function processDescription(node: ChildNode, ctx: BuilderContext, parentPath: string[] = []): Node {
  switch (node.nodeType) {
    case 1: {
      // HTMLElement
      const tagName = (node as Element).tagName;
      if (tagName.startsWith("owl-text-")) {
        const index = parseInt(tagName.slice(9), 10);
        ctx.info.push({ index, path: ctx.path.slice(), type: "text" });
        return document.createTextNode("");
      }
      if (tagName.startsWith("owl-child-")) {
        const index = parseInt(tagName.slice(10), 10);
        ctx.info.push({ index, type: "child", path: ctx.path.slice(), parentPath });
        return document.createTextNode("");
      }
      const result = document.createElement((node as Element).tagName);
      const attrs = (node as Element).attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attrName = attrs[i].name;
        const attrValue = attrs[i].value;
        if (attrName.startsWith("owl-handler-")) {
          const index = parseInt(attrName.slice(12), 10);
          ctx.info.push({
            index,
            path: ctx.path.slice(),
            type: "handler",
            event: attrValue,
          });
        } else if (attrName.startsWith("owl-attribute-")) {
          const index = parseInt(attrName.slice(14), 10);
          ctx.info.push({
            index,
            path: ctx.path.slice(),
            type: "attribute",
            name: attrValue,
            tag: tagName,
          });
        } else if (attrName === "owl-attributes") {
          ctx.info.push({
            index: parseInt(attrValue, 10),
            path: ctx.path.slice(),
            type: "attributes",
          });
        } else if (attrName === "owl-ref") {
          ctx.info.push({
            index: parseInt(attrValue, 10),
            path: ctx.path.slice(),
            type: "ref",
          });
        } else {
          result.setAttribute(attrs[i].name, attrValue);
        }
      }
      let children = (node as Element).childNodes;
      if (children.length === 1) {
        const childNode = children[0];
        if (childNode.nodeType === 1 && (childNode as Element).tagName.startsWith("owl-child-")) {
          const tagName = (childNode as Element).tagName;
          const index = parseInt(tagName.slice(10), 10);
          ctx.info.push({ index, type: "child", path: ctx.path.slice(), isOnlyChild: true });
          return result;
        }
      }
      const initialPath = ctx.path.slice();
      let currentPath = initialPath.slice();
      for (let i = 0; i < children.length; i++) {
        currentPath = currentPath.concat(i === 0 ? "firstChild" : "nextSibling");
        ctx.path = currentPath;
        result.appendChild(processDescription(children[i], ctx, initialPath));
      }
      ctx.path = initialPath;
      return result;
    }
    case 3: {
      // text node
      return document.createTextNode(node.textContent!);
    }
    case 8: {
      // comment node
      return document.createComment(node.textContent!);
    }
  }
  throw new Error("boom");
}

// -----------------------------------------------------------------------------
// Compiler
// -----------------------------------------------------------------------------
interface Collector {
  // refIdx: number;
  prevIdx: number;
  getVal: Function;
}

interface Location {
  idx: number;
  refIdx: number;
  setData: Function;
  updateData: Function;
}

interface ChildInsertionPoint {
  parentRefIdx: number;
  afterRefIdx?: number;
  singleNode?: boolean;
}

function createAttrUpdater(attr: string) {
  return function (this: HTMLElement, value: any) {
    if (value !== false) {
      if (value === true) {
        this.setAttribute(attr, "");
      } else {
        this.setAttribute(attr, value);
      }
    }
  };
}

function attrsSetter(this: HTMLElement, attrs: any) {
  if (Array.isArray(attrs)) {
    this.setAttribute(attrs[0], attrs[1]);
  } else {
    for (let k in attrs) {
      this.setAttribute(k, attrs[k]);
    }
  }
}

function attrsUpdater(this: HTMLElement, attrs: any, oldAttrs: any) {
  if (Array.isArray(attrs)) {
    if (attrs[0] === oldAttrs[0]) {
      if (attrs[1] === oldAttrs[1]) {
        return;
      }
      this.setAttribute(attrs[0], attrs[1]);
    } else {
      this.removeAttribute(oldAttrs[0]);
      this.setAttribute(attrs[0], attrs[1]);
    }
  } else {
    for (let k in oldAttrs) {
      if (!(k in attrs)) {
        this.removeAttribute(k);
      }
    }
    for (let k in attrs) {
      if (attrs[k] !== oldAttrs[k]) {
        this.setAttribute(k, attrs[k]);
      }
    }
  }
}

function isProp(tag: string, key: string): boolean {
  switch (tag) {
    case "input":
      return (
        key === "checked" ||
        key === "indeterminate" ||
        key === "value" ||
        key === "readonly" ||
        key === "disabled"
      );
    case "option":
      return key === "selected" || key === "disabled";
    case "textarea":
      return key === "readonly" || key === "disabled";
      break;
    case "button":
    case "select":
    case "optgroup":
      return key === "disabled";
  }
  return false;
}

function toClassObj(expr: string | number | { [c: string]: any }, expr2?: any) {
  const result: { [c: string]: any } = expr2 ? toClassObj(expr2) : {};

  if (typeof expr === "object") {
    // this is already an object but we may need to split keys:
    // {'a': true, 'b c': true} should become {a: true, b: true, c: true}
    for (let key in expr) {
      const value = expr[key];
      if (value) {
        const words = key.split(/\s+/);
        for (let word of words) {
          result[word] = value;
        }
      }
    }
    return result;
  }
  if (typeof expr !== "string") {
    expr = String(expr);
  }
  // we transform here a list of classes into an object:
  //  'hey you' becomes {hey: true, you: true}
  const str = expr.trim();
  if (!str) {
    return {};
  }
  let words = str.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    result[words[i]] = true;
  }
  return result;
}

function setClass(this: HTMLElement, val: any) {
  val = val === undefined ? {} : toClassObj(val);
  // add classes
  for (let c in val) {
    this.classList.add(c);
  }
}

function updateClass(this: HTMLElement, val: any, oldVal: any) {
  oldVal = oldVal === undefined ? {} : toClassObj(oldVal);
  val = val === undefined ? {} : toClassObj(val);
  // remove classes
  for (let c in oldVal) {
    if (!(c in val)) {
      this.classList.remove(c);
    }
  }
  // add classes
  for (let c in val) {
    if (!(c in oldVal)) {
      this.classList.add(c);
    }
  }
}

function makePropSetter(name: string) {
  return function setProp(this: HTMLElement, value: any) {
    (this as any)[name] = value;
  };
}

function createEventHandler(event: string) {
  // let wm = new WeakMap();
  return {
    setup(this: HTMLElement, data: any) {
      let handlers = (this as any).__handlers;
      if (!handlers) {
        handlers = {};
        (this as any).__handlers = handlers;
        // wm.set(this, handlers);
      }
      handlers[event] = data;
      this.addEventListener(event, (ev) => {
        config.mainEventHandler(handlers[event], ev);
      });
    },
    update(this: HTMLElement, data: any) {
      (this as any).__handlers[event] = data;
    },
  };
}

function setText(this: Text, value: any) {
  characterDataSetData.call(this, toText(value));
}

function compileBlock(info: BlockInfo[], template: HTMLElement): BlockType {
  let collectors: Collector[] = [];
  let locations: Location[] = [];
  let children: ChildInsertionPoint[] = [];
  let isDynamic = Boolean(info.length);
  let refs: number[] = [];

  if (info.length) {
    let current = 0;
    let refMap: { [k: string]: number } = {};

    for (let line of info) {
      let currentIdx = 0;
      for (let i = 0; i < line.path.length; i++) {
        const key = line.path.slice(0, i + 1).join();
        currentIdx = key in refMap ? refMap[key] : (refMap[key] = current++);
      }
      line.refIndex = currentIdx;
    }
    for (let path in refMap) {
      if (path === "el") {
        continue;
      }
      const pathL = path.split(",");
      const prevIdx = refMap[pathL.slice(0, -1).join()];
      switch (pathL[pathL.length - 1]) {
        case "firstChild":
          collectors.push({
            prevIdx,
            getVal: nodeGetFirstChild,
          });
          break;
        case "nextSibling":
          collectors.push({
            prevIdx,
            getVal: nodeGetNextSibling,
          });
          break;
      }
    }

    // building locations and child insertion points
    for (let line of info) {
      switch (line.type) {
        case "text": {
          const refIdx = line.refIndex!;
          locations.push({
            idx: line.index,
            refIdx,
            setData: setText,
            updateData: setText,
          });
          break;
        }
        case "attribute": {
          const refIdx = line.refIndex!;
          let updater: any;
          let setter: any;
          if (isProp(line.tag!, line.name!)) {
            const setProp = makePropSetter(line.name!);
            setter = setProp;
            updater = setProp;
          } else if (line.name === "class") {
            setter = setClass;
            updater = updateClass;
          } else {
            setter = createAttrUpdater(line.name!);
            updater = setter;
          }
          locations.push({
            idx: line.index,
            refIdx,
            setData: setter,
            updateData: updater,
          });
          break;
        }
        case "attributes": {
          const refIdx = line.refIndex!;
          locations.push({
            idx: line.index,
            refIdx,
            setData: attrsSetter,
            updateData: attrsUpdater,
          });
          break;
        }
        case "handler": {
          const refIdx = line.refIndex!;
          const { setup, update } = createEventHandler(line.event!);
          locations.push({
            idx: line.index,
            refIdx,
            setData: setup,
            updateData: update,
          });
          break;
        }
        case "child":
          if (line.isOnlyChild) {
            children.push({
              parentRefIdx: line.refIndex!, // current ref is parentEl
              singleNode: true,
            });
          } else {
            const prevIdx = refMap[line.parentPath!.join()];
            children.push({
              parentRefIdx: prevIdx,
              afterRefIdx: line.refIndex!, // current ref is textnode anchor
            });
          }
          break;
        case "ref": {
          const refIdx = line.refIndex!;
          refs.push(line.index);
          locations.push({
            idx: line.index,
            refIdx,
            setData: setRef,
            updateData: NO_OP,
          });
        }
      }
    }
  }

  let B = createBlockClass(template, collectors, locations, children, isDynamic);
  if (refs.length) {
    B = class extends B {
      remove() {
        super.remove();
        for (let ref of refs) {
          let fn = (this as any).data[ref];
          fn(null);
        }
      }
    };
  }
  if (children.length) {
    B = class extends B {
      beforeRemove() {
        // todo: share that code with multi?
        const children = (this as any).children!!;
        for (let i = 0, l = children.length; i < l; i++) {
          const child = children[i];
          if (child) {
            child.beforeRemove();
          }
        }
      }
    };
    return (data?: any[], children?: (VNode | undefined)[]) => new B(data, children);
  }
  return (data?: any[]) => new B(data);
}

function setRef(this: HTMLElement, fn: any) {
  fn(this);
}

// -----------------------------------------------------------------------------
// block implementation
// -----------------------------------------------------------------------------

type Constructor<T> = new (...args: any[]) => T;

function createBlockClass(
  template: HTMLElement,
  collectors: Collector[],
  locations: Location[],
  childrenLocs: ChildInsertionPoint[],
  isDynamic: boolean
): Constructor<VNode<any>> {
  let colLen = collectors.length;
  let locLen = locations.length;
  let childN = childrenLocs.length;
  const refN = colLen + 1;

const nodeCloneNode = nodeProto.cloneNode;
const nodeInsertBefore = nodeProto.insertBefore;
const elementRemove = elementProto.remove;

  return class Block {
    el: HTMLElement | undefined;
    refs: Node[] | undefined;
    data: any[] | undefined;
    children: (VNode | undefined)[] | undefined;
    parentEl?: HTMLElement | undefined;
    singleNode?: boolean | undefined;

    constructor(data?: any[], children?: VNode[]) {
      this.data = data;
      this.children = children;
    }

    beforeRemove() {}
    remove() {
      elementRemove.call(this.el);
    }

    firstNode(): Node {
      return this.el!;
    }

    moveBefore(other: Block | null, afterNode: Node | null) {
      const target = other ? other.el! : afterNode;
      nodeInsertBefore.call(this.parentEl, this.el!, target);
    }

    mount(parent: HTMLElement, afterNode: Node | null) {
      const el = nodeCloneNode.call(template, true);
      // console.warn(colLen)
      nodeInsertBefore.call(parent, el, afterNode);
      if (isDynamic) {
        // collecting references
        const refs: Node[] = new Array(refN);
        this.refs = refs;
        refs[0] = el;
        for (let i = 0; i < colLen; i++) {
          const w = collectors[i];
          refs[i + 1] = w.getVal.call(refs[w.prevIdx]);
        }
        this.refs = refs;
        // console.warn(refs)

        // applying data to all update points
        if (locLen) {
          const data = this.data!;
          for (let i = 0; i < locLen; i++) {
            const loc = locations[i];
            loc.setData.call(refs[loc.refIdx], data[loc.idx]);
          }
        }

        // preparing all children
        // console.warn(childN)
        if (childN) {
          const children = this.children;
          if (children) {
            for (let i = 0; i < childN; i++) {
              const child = children![i];
              if (child) {
                const loc = childrenLocs[i];
                const afterNode = loc.afterRefIdx ? refs[loc.afterRefIdx] : null;
                child.singleNode = loc.singleNode;
                child.mount(refs[loc.parentRefIdx] as any, afterNode);
              }
            }
          }
        }
      }
      this.el = el as HTMLElement;
      this.parentEl = parent;
    }
    patch(other: Block) {
      if (this === other) {
        return;
      }
      const refs = this.refs!;
      // update texts/attributes/
      if (locLen) {
        const data1 = this.data!;
        const data2 = other.data!;
        for (let i = 0; i < locLen; i++) {
          const loc = locations[i];
          const idx = loc.idx;
          const val1 = data1[idx];
          const val2 = data2[idx];
          if (val1 !== val2) {
            loc.updateData.call(refs[loc.refIdx], val2, val1);
          }
        }
        this.data = other.data;
      }

      // update children
      if (childN) {
        let children1 = this.children;
        if (!children1) {
          this.children = children1 = [];
        }
        const children2 = other.children || [];
        // console.warn(children1, children2)
        for (let i = 0; i < childN; i++) {
          const child1 = children1![i];
          const child2 = children2![i];
          if (child1) {
            if (child2) {
              child1.patch(child2);
            } else {
              child1.beforeRemove();
              child1.remove();
              children1[i] = undefined;
            }
          } else if (child2) {
            const loc = childrenLocs[i];
            const afterNode = loc.afterRefIdx ? refs[loc.afterRefIdx] : null;
            child2.mount(refs[loc.parentRefIdx] as any, afterNode);
            children1[i] = child2;
          }
        }
      }
    }
    toString() {
      const div = document.createElement("div");
      this.mount(div, null);
      return div.innerHTML;
    }
  };
}
