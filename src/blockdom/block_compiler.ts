import {
  attrsSetter,
  attrsUpdater,
  createAttrUpdater,
  isProp,
  makePropSetter,
  setClass,
  updateClass,
} from "./attributes";
import { config } from "./config";
import { createEventHandler } from "./events";
import type { VNode } from "./index";
import { VMulti } from "./multi";
import { toText } from "./text";

const getDescriptor = (o: any, p: any) => Object.getOwnPropertyDescriptor(o, p)!;
const nodeProto = Node.prototype;
const elementProto = Element.prototype;
const characterDataProto = CharacterData.prototype;

const characterDataSetData = getDescriptor(characterDataProto, "data").set!;
const nodeGetFirstChild = getDescriptor(nodeProto, "firstChild").get!;
const nodeGetNextSibling = getDescriptor(nodeProto, "nextSibling").get!;

const NO_OP = () => {};

// -----------------------------------------------------------------------------
// Main compiler code
// -----------------------------------------------------------------------------

type BlockType = (data?: any[], children?: VNode[]) => VNode;

const cache: { [key: string]: BlockType } = {};

/**
 * Compiling blocks is a multi-step process:
 *
 * 1. build an IntermediateTree from the HTML element. This intermediate tree
 *    is a binary tree structure that encode dynamic info sub nodes, and the
 *    path required to reach them
 * 2. process the tree to build a block context, which is an object that aggregate
 *    all dynamic info in a list, and also, all ref indexes.
 * 3. process the context to build appropriate builder/setter functions
 * 4. make a dynamic block class, which will efficiently collect references and
 *    create/update dynamic locations/children
 *
 * @param str
 * @returns a new block type, that can build concrete blocks
 */
export function createBlock(str: string): BlockType {
  if (str in cache) {
    return cache[str];
  }

  // step 0: prepare html base element
  const doc = new DOMParser().parseFromString(`<t>${str}</t>`, "text/xml");
  const node = doc.firstChild!.firstChild!;
  if (config.shouldNormalizeDom) {
    normalizeNode(node as any);
  }

  // step 1: prepare intermediate tree
  const tree = buildTree(node);

  // step 2: prepare block context
  const context = buildContext(tree);

  // step 3: build the final block class
  const template = tree.el as HTMLElement;
  const Block = buildBlock(template, context);
  cache[str] = Block;
  return Block;
}

// -----------------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------------

function normalizeNode(node: HTMLElement | Text) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!/\S/.test((node as Text).textContent!)) {
      (node as Text).remove();
      return;
    }
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
// building a intermediate tree
// -----------------------------------------------------------------------------

interface DynamicInfo {
  idx: number;
  refIdx?: number;
  type: "text" | "child" | "handler" | "attribute" | "attributes" | "ref";
  isOnlyChild?: boolean;
  name?: string;
  tag?: string;
  event?: string;
}

interface IntermediateTree {
  parent: IntermediateTree | null;
  firstChild: IntermediateTree | null;
  nextSibling: IntermediateTree | null;
  el: Node;
  info: DynamicInfo[];
  forceRef?: boolean;
  refIdx?: number;
  refN: number;
  currentNS: string | null;
}

function buildTree(
  node: Node,
  parent: IntermediateTree | null = null,
  domParentTree: IntermediateTree | null = null
): IntermediateTree {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      // HTMLElement
      let isActive = false;
      let currentNS = parent && parent.currentNS;
      const tagName = (node as Element).tagName;
      let el: Node | undefined = undefined;
      const info: DynamicInfo[] = [];
      if (tagName.startsWith("block-text-")) {
        const index = parseInt(tagName.slice(11), 10);
        info.push({ type: "text", idx: index });
        el = document.createTextNode("");
        isActive = true;
      }
      if (tagName.startsWith("block-child-")) {
        domParentTree!.forceRef = true;
        const index = parseInt(tagName.slice(12), 10);
        info.push({ type: "child", idx: index });
        el = document.createTextNode("");
        isActive = true;
      }
      const attrs = (node as Element).attributes;
      const ns = attrs.getNamedItem("block-ns");
      if (ns) {
        attrs.removeNamedItem("block-ns");
        currentNS = ns.value;
      }
      if (!el) {
        el = currentNS
          ? document.createElementNS(currentNS, tagName)
          : document.createElement(tagName);
      }
      if (el instanceof Element) {
        for (let i = 0; i < attrs.length; i++) {
          const attrName = attrs[i].name;
          const attrValue = attrs[i].value;
          if (attrName.startsWith("block-handler-")) {
            isActive = true;
            const idx = parseInt(attrName.slice(14), 10);
            info.push({
              type: "handler",
              idx,
              event: attrValue,
            });
          } else if (attrName.startsWith("block-attribute-")) {
            isActive = true;
            const idx = parseInt(attrName.slice(16), 10);
            info.push({
              type: "attribute",
              idx,
              name: attrValue,
              tag: tagName,
            });
          } else if (attrName === "block-attributes") {
            isActive = true;
            info.push({
              type: "attributes",
              idx: parseInt(attrValue, 10),
            });
          } else if (attrName === "block-ref") {
            isActive = true;
            info.push({
              type: "ref",
              idx: parseInt(attrValue, 10),
            });
          } else {
            el.setAttribute(attrs[i].name, attrValue);
          }
        }
      }

      const tree: IntermediateTree = {
        parent,
        firstChild: null,
        nextSibling: null,
        el,
        info,
        refN: isActive ? 1 : 0,
        currentNS,
      };

      if (node.firstChild) {
        const childNode = node.childNodes[0];
        if (
          node.childNodes.length === 1 &&
          childNode.nodeType === Node.ELEMENT_NODE &&
          (childNode as Element).tagName.startsWith("block-child-")
        ) {
          const tagName = (childNode as Element).tagName;
          const index = parseInt(tagName.slice(12), 10);
          info.push({ idx: index, type: "child", isOnlyChild: true });
          isActive = true;
          tree.refN = 1;
        } else {
          tree.firstChild = buildTree(node.firstChild, tree, tree);
          el.appendChild(tree.firstChild.el);
          let curNode: Node | null = node.firstChild;
          let curTree: IntermediateTree | null = tree.firstChild;
          while ((curNode = curNode.nextSibling)) {
            curTree.nextSibling = buildTree(curNode, curTree, tree);
            el.appendChild(curTree.nextSibling.el);
            curTree = curTree.nextSibling;
          }
        }
      }
      if (isActive) {
        let cur: IntermediateTree | null = tree;
        while ((cur = cur.parent)) {
          cur.refN++;
        }
      }
      return tree;
    }
    case Node.TEXT_NODE:
    case Node.COMMENT_NODE: {
      // text node or comment node
      const el =
        node.nodeType === Node.TEXT_NODE
          ? document.createTextNode(node.textContent!)
          : document.createComment(node.textContent!);
      return {
        parent: parent,
        firstChild: null,
        nextSibling: null,
        el,
        info: [],
        refN: 0,
        currentNS: null,
      };
    }
  }
  throw new Error("boom");
}

function parentTree(tree: IntermediateTree): IntermediateTree | null {
  let parent = tree.parent;
  while (parent && parent.nextSibling === tree) {
    tree = parent;
    parent = parent.parent;
  }
  return parent;
}

// -----------------------------------------------------------------------------
// Building a block context
// -----------------------------------------------------------------------------

interface RefCollector {
  idx: number;
  prevIdx: number;
  getVal: Function;
}

export type Setter<T = any> = (this: T, value: any) => void;
export type Updater<T = any> = (this: T, value: any, oldVal: any) => void;

interface Location {
  refIdx: number;
  setData: Setter;
  updateData: Updater;
}

interface IndexedLocation extends Location {
  idx: number;
}

interface Child {
  parentRefIdx: number;
  afterRefIdx?: number;
  isOnlyChild?: boolean;
}

interface BlockCtx {
  refN: number;
  collectors: RefCollector[];
  locations: IndexedLocation[];
  children: Child[];
  cbRefs: number[];
}

function buildContext(
  tree: IntermediateTree,
  ctx?: BlockCtx,
  fromIdx?: number,
  toIdx?: number
): BlockCtx {
  if (!ctx) {
    const children = new Array(tree.info.filter((v) => v.type === "child").length);
    ctx = { collectors: [], locations: [], children, cbRefs: [], refN: tree.refN };
    fromIdx = 0;
    toIdx = tree.refN - 1;
  }
  if (tree.refN) {
    const initialIdx = fromIdx!;
    const isRef = tree.forceRef || tree.info.length > 0;
    const firstChild = tree.firstChild ? tree.firstChild.refN : 0;
    const nextSibling = tree.nextSibling ? tree.nextSibling.refN : 0;

    //node
    if (isRef) {
      for (let info of tree.info) {
        info.refIdx = initialIdx!;
      }
      tree.refIdx = initialIdx!;
      updateCtx(ctx, tree);
      fromIdx!++;
    }

    // right
    if (nextSibling) {
      const idx = fromIdx! + firstChild;
      ctx.collectors.push({ idx, prevIdx: initialIdx, getVal: nodeGetNextSibling });
      buildContext(tree.nextSibling!, ctx, idx, toIdx);
    }

    // left
    if (firstChild) {
      ctx.collectors.push({ idx: fromIdx!, prevIdx: initialIdx, getVal: nodeGetFirstChild });
      buildContext(tree.firstChild!, ctx, fromIdx!, toIdx! - nextSibling);
    }
  }

  return ctx;
}

function updateCtx(ctx: BlockCtx, tree: IntermediateTree) {
  for (let info of tree.info) {
    switch (info.type) {
      case "text":
        ctx.locations.push({
          idx: info.idx,
          refIdx: info.refIdx!,
          setData: setText,
          updateData: setText,
        });
        break;
      case "child":
        if (info.isOnlyChild) {
          // tree is the parentnode here
          ctx.children[info.idx] = {
            parentRefIdx: info.refIdx!,
            isOnlyChild: true,
          };
        } else {
          // tree is the anchor text node
          ctx.children[info.idx] = {
            parentRefIdx: parentTree(tree)!.refIdx!,
            afterRefIdx: info.refIdx!,
          };
        }
        break;
      case "attribute": {
        const refIdx = info.refIdx!;
        let updater: any;
        let setter: any;
        if (isProp(info.tag!, info.name!)) {
          const setProp = makePropSetter(info.name!);
          setter = setProp;
          updater = setProp;
        } else if (info.name === "class") {
          setter = setClass;
          updater = updateClass;
        } else {
          setter = createAttrUpdater(info.name!);
          updater = setter;
        }
        ctx.locations.push({
          idx: info.idx,
          refIdx,
          setData: setter,
          updateData: updater,
        });
        break;
      }
      case "attributes":
        ctx.locations.push({
          idx: info.idx,
          refIdx: info.refIdx!,
          setData: attrsSetter,
          updateData: attrsUpdater,
        });
        break;
      case "handler": {
        const { setup, update } = createEventHandler(info.event!);
        ctx.locations.push({
          idx: info.idx,
          refIdx: info.refIdx!,
          setData: setup,
          updateData: update,
        });
        break;
      }
      case "ref":
        ctx.cbRefs.push(info.idx);
        ctx.locations.push({
          idx: info.idx,
          refIdx: info.refIdx!,
          setData: setRef,
          updateData: NO_OP,
        });
    }
  }
}
// -----------------------------------------------------------------------------
// building the concrete block class
// -----------------------------------------------------------------------------

function buildBlock(template: HTMLElement, ctx: BlockCtx): BlockType {
  let B = createBlockClass(template, ctx);

  if (ctx.cbRefs.length) {
    const refs = ctx.cbRefs;
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

  if (ctx.children.length) {
    B = class extends B {
      children: (VNode | undefined)[] | undefined;
      constructor(data?: any[], children?: VNode[]) {
        super(data);
        this.children = children;
      }
    };
    B.prototype.beforeRemove = VMulti.prototype.beforeRemove;
    return (data?: any[], children: (VNode | undefined)[] = []) => new B(data, children);
  }

  return (data?: any[]) => new B(data);
}

type Constructor<T> = new (...args: any[]) => T;
type BlockClass = Constructor<VNode<any>>;

function createBlockClass(template: HTMLElement, ctx: BlockCtx): BlockClass {
  const { refN, collectors, children } = ctx;
  const colN = collectors.length;
  ctx.locations.sort((a, b) => a.idx - b.idx);
  const locations: Location[] = ctx.locations.map((loc) => ({
    refIdx: loc.refIdx,
    setData: loc.setData,
    updateData: loc.updateData,
  }));
  const locN = locations.length;
  const childN = children.length;
  const childrenLocs = children;
  const isDynamic = refN > 0;

  // these values are defined here to make them faster to lookup in the class
  // block scope
  const nodeCloneNode = nodeProto.cloneNode;
  const nodeInsertBefore = nodeProto.insertBefore;
  const elementRemove = elementProto.remove;

  return class Block {
    el: HTMLElement | undefined;
    refs: Node[] | undefined;
    data: any[] | undefined;
    parentEl?: HTMLElement | undefined;
    children?: (VNode | undefined)[];

    constructor(data?: any[]) {
      this.data = data;
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
      nodeInsertBefore.call(parent, el, afterNode);
      if (isDynamic) {
        // collecting references
        const refs: Node[] = new Array(refN);
        this.refs = refs;
        refs[0] = el;
        for (let i = 0; i < colN; i++) {
          const w = collectors[i];
          refs[w.idx] = w.getVal.call(refs[w.prevIdx]);
        }

        // applying data to all update points
        if (locN) {
          const data = this.data!;
          for (let i = 0; i < locN; i++) {
            const loc = locations[i];
            loc.setData.call(refs[loc.refIdx], data[i]);
          }
        }

        // preparing all children
        if (childN) {
          const children = this.children;
          for (let i = 0; i < childN; i++) {
            const child = children![i];
            if (child) {
              const loc = childrenLocs[i];
              const afterNode = loc.afterRefIdx ? refs[loc.afterRefIdx] : null;
              child.isOnlyChild = loc.isOnlyChild;
              child.mount(refs[loc.parentRefIdx] as any, afterNode);
            }
          }
        }
      }
      this.el = el as HTMLElement;
      this.parentEl = parent;
    }
    patch(other: Block, withBeforeRemove: boolean) {
      if (this === other) {
        return;
      }
      const refs = this.refs!;
      // update texts/attributes/
      if (locN) {
        const data1 = this.data!;
        const data2 = other.data!;
        for (let i = 0; i < locN; i++) {
          const val1 = data1[i];
          const val2 = data2[i];
          if (val1 !== val2) {
            const loc = locations[i];
            loc.updateData.call(refs[loc.refIdx], val2, val1);
          }
        }
        this.data = data2;
      }

      // update children
      if (childN) {
        let children1 = this.children;
        const children2 = other.children;
        for (let i = 0; i < childN; i++) {
          const child1 = children1![i];
          const child2 = children2![i];
          if (child1) {
            if (child2) {
              child1.patch(child2, withBeforeRemove);
            } else {
              if (withBeforeRemove) {
                child1.beforeRemove();
              }
              child1.remove();
              children1![i] = undefined;
            }
          } else if (child2) {
            const loc = childrenLocs[i];
            const afterNode = loc.afterRefIdx ? refs[loc.afterRefIdx] : null;
            child2.mount(refs[loc.parentRefIdx] as any, afterNode);
            children1![i] = child2;
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

function setText(this: Text, value: any) {
  characterDataSetData.call(this, toText(value));
}

function setRef(this: HTMLElement, fn: any) {
  fn(this);
}
