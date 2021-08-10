import type { VNode } from "./index";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;
const elementProto = Element.prototype;
const characterDataProto = CharacterData.prototype;

const nodeCloneNode = nodeProto.cloneNode;
const nodeInsertBefore = nodeProto.insertBefore;
const characterDataSetData = getDescriptor(characterDataProto, "data").set!;
const elementRemove = elementProto.remove;
const nodeGetFirstChild = getDescriptor(nodeProto, "firstChild").get!;
const nodeGetNextSibling = getDescriptor(nodeProto, "nextSibling").get!;

// -----------------------------------------------------------------------------
// Block
// -----------------------------------------------------------------------------

type BlockType = (data?: any[], children?: VNode[]) => VNode;

export function createBlock(str: string): BlockType {
  const info: BuilderContext["info"] = [];
  const ctx: BuilderContext = {
    path: ["el"],
    info,
  };

  const doc = new DOMParser().parseFromString(str, "text/xml");
  const node = doc.firstChild!;
  normalizeNode(node as any);
  const template = processDescription(node, ctx) as any;

  return compileBlock(info, template);
}

function normalizeNode(node: HTMLElement | Text) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!/\S/.test((node as Text).textContent!)) {
      (node as Text).remove();
      return;
    }
    node.textContent = node.textContent!.trim();
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
  type: "text" | "child" | "handler" | "attribute";
  path: string[];
  event?: string;
  name?: string;
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
  return function (this: HTMLElement, a: any, b: any) {
    this.setAttribute(attr, a);
  };
}

function createEventHandler(event: string) {
  return function handler(this: HTMLElement, data: any) {
    (this as any).__eventdata = data;
    this.addEventListener(event, () => {
      const handler = (this as any).__eventdata;
      if (typeof handler === "function") {
        handler();
      } else {
        const [owner, method] = handler;
        owner[method]();
      }
    });
  };
}

function updateEventData(this: HTMLElement, data: any) {
  (this as any).__eventdata = data;
}

function compileBlock(info: BlockInfo[], template: HTMLElement): BlockType {
  let collectors: Collector[] = [];
  let locations: Location[] = [];
  let children: ChildInsertionPoint[] = [];
  let isDynamic = Boolean(info.length);

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
            setData: characterDataSetData,
            updateData: characterDataSetData,
          });
          break;
        }
        case "attribute": {
          const refIdx = line.refIndex!;
          const updater = createAttrUpdater(line.name!);
          locations.push({
            idx: line.index,
            refIdx,
            setData: updater,
            updateData: updater,
          });
          break;
        }
        case "handler": {
          const refIdx = line.refIndex!;
          const createHandler = createEventHandler(line.event!);
          locations.push({
            idx: line.index,
            refIdx,
            setData: createHandler,
            updateData: updateEventData,
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
      }
    }
  }

  const B = createBlockClass(template, collectors, locations, children, isDynamic);

  return (data?: any[], children?: (VNode | undefined)[]) => new B(data, children);
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
          const val2 = data2[idx];
          if (data1[idx] !== val2) {
            loc.updateData.call(refs[loc.refIdx], val2);
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
  };
}
