/**
 * Owl VDOM
 *
 * This file contains an implementation of a virtual DOM, which is a system that
 * can generate in-memory representations of a DOM tree, compare them, and
 * eventually change a concrete DOM tree to match its representation, in an
 * hopefully efficient way.
 *
 * Note that this code is a fork of Snabbdom, slightly tweaked/optimized for our
 * needs (see https://github.com/snabbdom/snabbdom).
 *
 * The main exported values are:
 * - interface VNode
 * - h function (a helper function to generate a vnode)
 * - patch function (to apply a vnode to an actual DOM node)
 */

// because those in TypeScript are too restrictive: https://github.com/Microsoft/TSJS-lib-generator/pull/237
declare global {
  interface Element {
    setAttribute(name: string, value: string | number | boolean): void;
    setAttributeNS(
      namespaceURI: string,
      qualifiedName: string,
      value: string | number | boolean
    ): void;
  }
}

type Props = Record<string, any>;
type Attrs = Record<string, string | number | boolean>;
type On = { [N in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[N]) => void } & {
  [event: string]: EventListener;
};

export interface Module {
  pre: PreHook;
  create: CreateHook;
  update: UpdateHook;
  destroy: DestroyHook;
  remove: RemoveHook;
  post: PostHook;
}

//------------------------------------------------------------------------------
// vnode.ts
//------------------------------------------------------------------------------
type Key = string | number;

export interface VNode {
  sel: string | undefined;
  data: VNodeData | undefined;
  children: Array<VNode | string> | undefined;
  elm: Node | undefined;
  text: string | undefined;
  key: Key | undefined;
}

export interface VNodeData {
  props?: Props;
  attrs?: Attrs;
  on?: On;
  hook?: Hooks;
  key?: Key;
  ns?: string; // for SVGs
  [key: string]: any; // for any other 3rd party module
}

function vnode(
  sel: string | undefined,
  data: any | undefined,
  children: Array<VNode | string> | undefined,
  text: string | undefined,
  elm: Element | Text | undefined
): VNode {
  let key = data === undefined ? undefined : data.key;
  return { sel, data, children, text, elm, key };
}

//------------------------------------------------------------------------------
// snabbdom.ts
//------------------------------------------------------------------------------
function isUndef(s: any): boolean {
  return s === undefined;
}
function isDef(s: any): boolean {
  return s !== undefined;
}

type VNodeQueue = Array<VNode>;

const emptyNode = vnode("", {}, [], undefined, undefined);

function sameVnode(vnode1: VNode, vnode2: VNode): boolean {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}

function isVnode(vnode: any): vnode is VNode {
  return vnode.sel !== undefined;
}

type KeyToIndexMap = { [key: string]: number };

type ArraysOf<T> = { [K in keyof T]: T[K][] };

type ModuleHooks = ArraysOf<Module>;

function createKeyToOldIdx(
  children: Array<VNode>,
  beginIdx: number,
  endIdx: number
): KeyToIndexMap {
  let i: number,
    map: KeyToIndexMap = {},
    key: Key | undefined,
    ch;
  for (i = beginIdx; i <= endIdx; ++i) {
    ch = children[i];
    if (ch != null) {
      key = ch.key;
      if (key !== undefined) map[key] = i;
    }
  }
  return map;
}

const hooks: (keyof Module)[] = ["create", "update", "remove", "destroy", "pre", "post"];

export function init(modules: Array<Partial<Module>>, domApi?: DOMAPI) {
  let i: number,
    j: number,
    cbs = {} as ModuleHooks;

  const api: DOMAPI = domApi !== undefined ? domApi : htmlDomApi;

  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      const hook = modules[j][hooks[i]];
      if (hook !== undefined) {
        (cbs[hooks[i]] as Array<any>).push(hook);
      }
    }
  }

  function emptyNodeAt(elm: Element) {
    const id = elm.id ? "#" + elm.id : "";
    const c = elm.className ? "." + elm.className.split(" ").join(".") : "";
    return vnode(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
  }

  function createRmCb(childElm: Node, listeners: number) {
    return function rmCb() {
      if (--listeners === 0) {
        const parent = api.parentNode(childElm);
        api.removeChild(parent, childElm);
      }
    };
  }

  function createElm(vnode: VNode, insertedVnodeQueue: VNodeQueue): Node {
    let i: any,
      iLen: number,
      data = vnode.data;
    if (data !== undefined) {
      if (isDef((i = data.hook)) && isDef((i = i.init))) {
        i(vnode);
        data = vnode.data;
      }
    }
    let children = vnode.children,
      sel = vnode.sel;
    if (sel === "!") {
      if (isUndef(vnode.text)) {
        vnode.text = "";
      }
      vnode.elm = api.createComment(vnode.text as string);
    } else if (sel !== undefined) {
      const elm =
        vnode.elm ||
        (vnode.elm =
          isDef(data) && isDef((i = (data as VNodeData).ns))
            ? api.createElementNS(i, sel)
            : api.createElement(sel));
      for (i = 0, iLen = cbs.create.length; i < iLen; ++i) cbs.create[i](emptyNode, vnode);
      if (array(children)) {
        for (i = 0, iLen = children.length; i < iLen; ++i) {
          const ch = children[i];
          if (ch != null) {
            api.appendChild(elm, createElm(ch as VNode, insertedVnodeQueue));
          }
        }
      } else if (primitive(vnode.text)) {
        api.appendChild(elm, api.createTextNode(vnode.text));
      }
      i = (vnode.data as VNodeData).hook; // Reuse variable
      if (isDef(i)) {
        if (i.create) i.create(emptyNode, vnode);
        if (i.insert) insertedVnodeQueue.push(vnode);
      }
    } else {
      vnode.elm = api.createTextNode(vnode.text as string);
    }
    return vnode.elm;
  }

  function addVnodes(
    parentElm: Node,
    before: Node | null,
    vnodes: Array<VNode>,
    startIdx: number,
    endIdx: number,
    insertedVnodeQueue: VNodeQueue
  ) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx];
      if (ch != null) {
        api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
      }
    }
  }

  function invokeDestroyHook(vnode: VNode) {
    let i: any,
      iLen: number,
      j: number,
      jLen: number,
      data = vnode.data;
    if (data !== undefined) {
      if (isDef((i = data.hook)) && isDef((i = i.destroy))) i(vnode);
      for (i = 0, iLen = cbs.destroy.length; i < iLen; ++i) cbs.destroy[i](vnode);
      if (vnode.children !== undefined) {
        for (j = 0, jLen = vnode.children.length; j < jLen; ++j) {
          i = vnode.children[j];
          if (i != null && typeof i !== "string") {
            invokeDestroyHook(i);
          }
        }
      }
    }
  }

  function removeVnodes(
    parentElm: Node,
    vnodes: Array<VNode>,
    startIdx: number,
    endIdx: number
  ): void {
    for (; startIdx <= endIdx; ++startIdx) {
      let i: any,
        iLen: number,
        listeners: number,
        rm: () => void,
        ch = vnodes[startIdx];
      if (ch != null) {
        if (isDef(ch.sel)) {
          invokeDestroyHook(ch);
          listeners = cbs.remove.length + 1;
          rm = createRmCb(ch.elm as Node, listeners);
          for (i = 0, iLen = cbs.remove.length; i < iLen; ++i) cbs.remove[i](ch, rm);
          if (isDef((i = ch.data)) && isDef((i = i.hook)) && isDef((i = i.remove))) {
            i(ch, rm);
          } else {
            rm();
          }
        } else {
          // Text node
          api.removeChild(parentElm, ch.elm as Node);
        }
      }
    }
  }

  function updateChildren(
    parentElm: Node,
    oldCh: Array<VNode>,
    newCh: Array<VNode>,
    insertedVnodeQueue: VNodeQueue
  ) {
    let oldStartIdx = 0,
      newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let oldStartVnode = oldCh[0];
    let oldEndVnode = oldCh[oldEndIdx];
    let newEndIdx = newCh.length - 1;
    let newStartVnode = newCh[0];
    let newEndVnode = newCh[newEndIdx];
    let oldKeyToIdx: any;
    let idxInOld: number;
    let elmToMove: VNode;
    let before: any;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (oldStartVnode == null) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
      } else if (oldEndVnode == null) {
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (newStartVnode == null) {
        newStartVnode = newCh[++newStartIdx];
      } else if (newEndVnode == null) {
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) {
        // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(
          parentElm,
          oldStartVnode.elm as Node,
          api.nextSibling(oldEndVnode.elm as Node)
        );
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) {
        // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm as Node, oldStartVnode.elm as Node);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        if (oldKeyToIdx === undefined) {
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        }
        idxInOld = oldKeyToIdx[newStartVnode.key as string];
        if (isUndef(idxInOld)) {
          // New element
          api.insertBefore(
            parentElm,
            createElm(newStartVnode, insertedVnodeQueue),
            oldStartVnode.elm as Node
          );
          newStartVnode = newCh[++newStartIdx];
        } else {
          elmToMove = oldCh[idxInOld];
          if (elmToMove.sel !== newStartVnode.sel) {
            api.insertBefore(
              parentElm,
              createElm(newStartVnode, insertedVnodeQueue),
              oldStartVnode.elm as Node
            );
          } else {
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
            oldCh[idxInOld] = undefined as any;
            api.insertBefore(parentElm, elmToMove.elm as Node, oldStartVnode.elm as Node);
          }
          newStartVnode = newCh[++newStartIdx];
        }
      }
    }
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      if (oldStartIdx > oldEndIdx) {
        before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
        addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
      } else {
        removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
      }
    }
  }

  function patchVnode(oldVnode: VNode, vnode: VNode, insertedVnodeQueue: VNodeQueue) {
    let i: any, iLen: number, hook: any;
    if (isDef((i = vnode.data)) && isDef((hook = i.hook)) && isDef((i = hook.prepatch))) {
      i(oldVnode, vnode);
    }
    const elm = (vnode.elm = oldVnode.elm as Node);
    let oldCh = oldVnode.children;
    let ch = vnode.children;
    if (oldVnode === vnode) return;
    if (vnode.data !== undefined) {
      for (i = 0, iLen = cbs.update.length; i < iLen; ++i) cbs.update[i](oldVnode, vnode);
      i = vnode.data.hook;
      if (isDef(i) && isDef((i = i.update))) i(oldVnode, vnode);
    }
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch)
          updateChildren(elm, oldCh as Array<VNode>, ch as Array<VNode>, insertedVnodeQueue);
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) api.setTextContent(elm, "");
        addVnodes(
          elm,
          null,
          ch as Array<VNode>,
          0,
          (ch as Array<VNode>).length - 1,
          insertedVnodeQueue
        );
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh as Array<VNode>, 0, (oldCh as Array<VNode>).length - 1);
      } else if (isDef(oldVnode.text)) {
        api.setTextContent(elm, "");
      }
    } else if (oldVnode.text !== vnode.text) {
      if (isDef(oldCh)) {
        removeVnodes(elm, oldCh as Array<VNode>, 0, (oldCh as Array<VNode>).length - 1);
      }
      api.setTextContent(elm, vnode.text as string);
    }
    if (isDef(hook) && isDef((i = hook.postpatch))) {
      i(oldVnode, vnode);
    }
  }

  return function patch(oldVnode: VNode | Element, vnode: VNode): VNode {
    let i: number, iLen: number, elm: Node, parent: Node;
    const insertedVnodeQueue: VNodeQueue = [];
    for (i = 0, iLen = cbs.pre.length; i < iLen; ++i) cbs.pre[i]();

    if (!isVnode(oldVnode)) {
      oldVnode = emptyNodeAt(oldVnode);
    }

    if (sameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue);
    } else {
      elm = oldVnode.elm as Node;
      parent = api.parentNode(elm);

      createElm(vnode, insertedVnodeQueue);

      if (parent !== null) {
        api.insertBefore(parent, vnode.elm as Node, api.nextSibling(elm));
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }

    for (i = 0, iLen = insertedVnodeQueue.length; i < iLen; ++i) {
      (((insertedVnodeQueue[i].data as VNodeData).hook as Hooks).insert as any)(
        insertedVnodeQueue[i]
      );
    }
    for (i = 0, iLen = cbs.post.length; i < iLen; ++i) cbs.post[i]();
    return vnode;
  };
}

//------------------------------------------------------------------------------
// is.ts
//------------------------------------------------------------------------------
const array = Array.isArray;
function primitive(s: any): s is string | number {
  return typeof s === "string" || typeof s === "number";
}

//------------------------------------------------------------------------------
// htmldomapi.ts
//------------------------------------------------------------------------------
interface DOMAPI {
  createElement: (tagName: any) => HTMLElement;
  createElementNS: (namespaceURI: string, qualifiedName: string) => Element;
  createTextNode: (text: string) => Text;
  createComment: (text: string) => Comment;
  insertBefore: (parentNode: Node, newNode: Node, referenceNode: Node | null) => void;
  removeChild: (node: Node, child: Node) => void;
  appendChild: (node: Node, child: Node) => void;
  parentNode: (node: Node) => Node;
  nextSibling: (node: Node) => Node;
  tagName: (elm: Element) => string;
  setTextContent: (node: Node, text: string | null) => void;
}

function createElement(tagName: any): HTMLElement {
  return document.createElement(tagName);
}

function createElementNS(namespaceURI: string, qualifiedName: string): Element {
  return document.createElementNS(namespaceURI, qualifiedName);
}

function createTextNode(text: string): Text {
  return document.createTextNode(text);
}

function createComment(text: string): Comment {
  return document.createComment(text);
}

function insertBefore(parentNode: Node, newNode: Node, referenceNode: Node | null): void {
  parentNode.insertBefore(newNode, referenceNode);
}

function removeChild(node: Node, child: Node): void {
  node.removeChild(child);
}

function appendChild(node: Node, child: Node): void {
  node.appendChild(child);
}

function parentNode(node: Node): Node | null {
  return node.parentNode;
}

function nextSibling(node: Node): Node | null {
  return node.nextSibling;
}

function tagName(elm: Element): string {
  return elm.tagName;
}

function setTextContent(node: Node, text: string | null): void {
  node.textContent = text;
}

const htmlDomApi = {
  createElement,
  createElementNS,
  createTextNode,
  createComment,
  insertBefore,
  removeChild,
  appendChild,
  parentNode,
  nextSibling,
  tagName,
  setTextContent,
} as DOMAPI;

//------------------------------------------------------------------------------
// hooks.ts
//------------------------------------------------------------------------------
type PreHook = () => any;
type InitHook = (vNode: VNode) => any;
type CreateHook = (emptyVNode: VNode, vNode: VNode) => any;
type InsertHook = (vNode: VNode) => any;
type PrePatchHook = (oldVNode: VNode, vNode: VNode) => any;
type UpdateHook = (oldVNode: VNode, vNode: VNode) => any;
type PostPatchHook = (oldVNode: VNode, vNode: VNode) => any;
type DestroyHook = (vNode: VNode) => any;
type RemoveHook = (vNode: VNode, removeCallback: () => void) => any;
type PostHook = () => any;

interface Hooks {
  pre?: PreHook;
  init?: InitHook;
  create?: CreateHook;
  insert?: InsertHook;
  prepatch?: PrePatchHook;
  update?: UpdateHook;
  postpatch?: PostPatchHook;
  destroy?: DestroyHook;
  remove?: RemoveHook;
  post?: PostHook;
}

//------------------------------------------------------------------------------
// h.ts
//------------------------------------------------------------------------------
type VNodes = Array<VNode>;
type VNodeChildElement = VNode | string | number | undefined | null;
type ArrayOrElement<T> = T | T[];
type VNodeChildren = ArrayOrElement<VNodeChildElement>;

export function addNS(data: any, children: VNodes | undefined, sel: string | undefined): void {
  if (sel === "dummy") {
    // we do not need to add the namespace on dummy elements, they come from a
    // subcomponent, which will handle the namespace itself
    return;
  }
  data.ns = "http://www.w3.org/2000/svg";
  if (sel !== "foreignObject" && children !== undefined) {
    for (let i = 0, iLen = children.length; i < iLen; ++i) {
      const child = children[i];
      let childData = child.data;
      if (childData !== undefined) {
        addNS(childData, (child as VNode).children as VNodes, child.sel);
      }
    }
  }
}

export function h(sel: string): VNode;
export function h(sel: string, data: VNodeData): VNode;
export function h(sel: string, children: VNodeChildren): VNode;
export function h(sel: string, data: VNodeData, children: VNodeChildren): VNode;
export function h(sel: any, b?: any, c?: any): VNode {
  var data: VNodeData = {},
    children: any,
    text: any,
    i: number,
    iLen: number;
  if (c !== undefined) {
    data = b;
    if (array(c)) {
      children = c;
    } else if (primitive(c)) {
      text = c;
    } else if (c && c.sel) {
      children = [c];
    }
  } else if (b !== undefined) {
    if (array(b)) {
      children = b;
    } else if (primitive(b)) {
      text = b;
    } else if (b && b.sel) {
      children = [b];
    } else {
      data = b;
    }
  }
  if (children !== undefined) {
    for (i = 0, iLen = children.length; i < iLen; ++i) {
      if (primitive(children[i]))
        children[i] = vnode(undefined, undefined, undefined, children[i], undefined);
    }
  }
  return vnode(sel, data, children, text, undefined);
}
