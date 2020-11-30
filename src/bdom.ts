/**
 * Block DOM
 *
 * A virtual-dom inspired implementation, but where the basic primitive is a
 * "block" instead of just a html (v)node.
 */

export type BDom = BNode | BMulti | BHtml;

// -----------------------------------------------------------------------------
//  Block
// -----------------------------------------------------------------------------

export abstract class Block {
  el: ChildNode | null | null = null;
  refs?: { [name: string]: HTMLElement };

  mount(parent: HTMLElement | DocumentFragment) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.mountBefore(anchor);
    anchor.remove();
  }

  abstract mountBefore(anchor: ChildNode): void;

  abstract patch(other: Block): void;

  abstract firstChildNode(): ChildNode | null;

  remove() {}

  move(parent: HTMLElement | DocumentFragment) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.moveBefore(anchor);
    anchor.remove();
  }

  moveBefore(anchor: ChildNode): void {
    this.mountBefore(anchor);
  }
}

// -----------------------------------------------------------------------------
//  Html Block
// -----------------------------------------------------------------------------

export class BHtml extends Block {
  html: string;
  content: ChildNode[] = [];
  anchor: ChildNode;
  constructor(html: any) {
    super();
    this.html = String(html);
    this.anchor = document.createTextNode("");
  }

  firstChildNode(): ChildNode | null {
    return this.content[0];
  }

  mountBefore(anchor: ChildNode) {
    this.build();
    anchor.before(this.anchor);
    for (let elem of this.content) {
      this.anchor.before(elem);
    }
  }

  moveBefore(anchor: ChildNode): void {
    anchor.before(this.anchor);
    for (let elem of this.content) {
      this.anchor.before(elem);
    }
  }

  build() {
    const div = document.createElement("div");
    div.innerHTML = this.html;
    this.content = [...div.childNodes];
    this.el = this.content[0];
  }

  remove() {
    for (let elem of this.content) {
      elem.remove();
    }
    this.anchor.remove();
  }

  patch(other: any) {
    for (let elem of this.content) {
      elem.remove();
    }
    this.build();
    for (let elem of this.content) {
      this.anchor.before(elem);
    }
  }

  toString(): string {
    return this.html;
  }
}

// -----------------------------------------------------------------------------
//  Text Block
// -----------------------------------------------------------------------------

export class BText extends Block {
  el: Text;
  text: string;
  constructor(text: string) {
    super();
    this.el = document.createTextNode(text);
    this.text = text;
  }

  firstChildNode(): ChildNode | null {
    return this.el;
  }

  mountBefore(anchor: ChildNode) {
    anchor.before(this.el);
  }

  patch(other: any) {
    if (other.text !== this.text) {
      this.el.textContent = other.el.textContent;
      this.text = other.text;
    }
  }

  toString() {
    return this.el.textContent;
  }
}

// -----------------------------------------------------------------------------
//  Content Block
// -----------------------------------------------------------------------------

export class BNode extends Block {
  static el: ChildNode;
  // el?: HTMLElement | Text;
  children: (BNode | null)[] | null = null;
  anchors?: ChildNode[] | null = null;
  data?: any[] | null = null;
  handlers?: any[] | null = null;

  firstChildNode(): ChildNode | null {
    return this.el;
  }

  toString(): string {
    const div = document.createElement("div");
    this.mount(div);
    return div.innerHTML;
  }

  mountBefore(anchor: ChildNode) {
    this.build();
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (child) {
          const anchor = this.anchors![i];
          child.mountBefore(anchor);
        }
      }
    }
    anchor.before(this.el!);
  }

  moveBefore(anchor: ChildNode) {
    anchor.before(this.el!);
  }

  update() {}

  updateClass(elem: HTMLElement, _class: any) {
    switch (typeof _class) {
      case "object":
        for (let k in _class) {
          if (_class[k]) {
            elem.classList.add(k);
          }
        }
        break;
      case "string":
        if (_class) {
          elem.classList.add(_class);
        }
        break;
      default:
        elem.classList.add(_class);
    }
  }

  updateAttr(elem: HTMLElement, attr: string, value: any) {
    if (value !== false) {
      if (value === true) {
        elem.setAttribute(attr, "");
      } else {
        elem.setAttribute(attr, value);
      }
    }
  }

  updateAttrs(elem: HTMLElement, attrs: [string, string] | { [key: string]: string }) {
    if (Array.isArray(attrs)) {
      elem.setAttribute(attrs[0], attrs[1]);
    } else {
      for (let key in attrs) {
        elem.setAttribute(key, attrs[key]);
      }
    }
  }

  updateProp(elem: HTMLElement, prop: string, value: any) {
    (elem as any)[prop] = value;
  }

  setupHandler(el: HTMLElement, index: number) {
    const eventType = this.handlers![index][0];
    el.addEventListener(eventType, () => {
      const info = this.handlers![index];
      const [, callback, ctx] = info;
      if (ctx.__owl__ && !ctx.__owl__.isMounted) {
        return;
      }
      callback();
    });
  }

  protected build() {
    this.el = (this.constructor as any).el.cloneNode(true);
    if (this.children) {
      const anchorElems = (this.el as HTMLElement).getElementsByTagName("owl-anchor");
      const anchors = new Array(anchorElems.length);
      for (let i = 0; i < anchors.length; i++) {
        const text = document.createTextNode("");
        anchorElems[0].replaceWith(text); // the 0 is not a mistake: anchorElems is live collection
        anchors[i] = text;
      }
      this.anchors = anchors;
    }
    this.update();
  }

  patch(newTree: any) {
    this.data = newTree.data;
    this.refs = newTree.refs;
    const anchors = this.anchors;
    this.update();
    if (this.children) {
      const children = this.children;
      const newChildren = newTree.children!;
      for (let i = 0, l = newChildren.length; i < l; i++) {
        const newChild = newChildren[i];
        const child = children[i];
        if (child) {
          if (newChild) {
            child.patch(newChild);
          } else {
            children[i] = null;
            child.remove();
          }
        } else if (newChild) {
          children[i] = newChild;
          const anchor = anchors![i];
          newChild.mountBefore(anchor);
        }
      }
    }
  }

  remove() {
    this.el!.remove();
  }
}

// -----------------------------------------------------------------------------
//  Multi Block
// -----------------------------------------------------------------------------

export class BMulti extends Block {
  children: (BDom | undefined | null)[];
  anchors?: ChildNode[];

  constructor(n: number) {
    super();
    this.children = new Array(n);
    this.anchors = new Array(n);
  }

  firstChildNode(): ChildNode | null {
    for (let child of this.children) {
      if (child) {
        return child.firstChildNode();
      }
    }
    return null;
  }

  mountBefore(anchor: ChildNode) {
    const children = this.children;
    const anchors = this.anchors;
    for (let i = 0, l = children.length; i < l; i++) {
      let child: any = children[i];
      const childAnchor = document.createTextNode("");
      anchor.before(childAnchor);
      anchors![i] = childAnchor;
      if (child) {
        child.mountBefore(childAnchor);
      }
    }
  }

  moveBefore(anchor: ChildNode) {
    for (let i = 0; i < this.children.length; i++) {
      let child: any = this.children[i];
      const childAnchor = document.createTextNode("");
      anchor.before(childAnchor);
      this.anchors![i] = childAnchor;
      if (child) {
        child.moveBefore(childAnchor);
      }
    }
  }

  patch(newTree: any) {
    const children = this.children;
    const newChildren = newTree.children;
    const anchors = this.anchors!;
    for (let i = 0, l = children.length; i < l; i++) {
      const block = children[i];
      const newBlock = newChildren[i];
      if (block) {
        if (newBlock) {
          block.patch(newBlock);
        } else {
          children[0] = null;
          block.remove();
        }
      } else if (newBlock) {
        children[i] = newBlock;
        newBlock.mountBefore(anchors[i]);
      }
    }
  }

  remove() {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i]!.remove();
      this.anchors![i].remove();
    }
  }

  toString(): string {
    return this.children.map((c) => (c ? c.toString() : "")).join("");
  }
}

// -----------------------------------------------------------------------------
//  Collection Block
// -----------------------------------------------------------------------------

export class BCollection extends Block {
  children: Block[];
  anchor?: ChildNode;
  keys: (string | number)[];

  constructor(n: number) {
    super();
    this.keys = new Array(n);
    this.children = new Array(n);
  }

  firstChildNode(): ChildNode | null {
    return this.children.length ? this.children[0].firstChildNode() : null;
  }

  mountBefore(anchor: ChildNode) {
    const _anchor = document.createTextNode("");
    anchor.before(_anchor);
    this.anchor = _anchor;
    for (let child of this.children) {
      child.mountBefore(_anchor);
    }
  }

  moveBefore(anchor: ChildNode) {
    const _anchor = document.createTextNode("");
    anchor.before(_anchor);
    this.anchor = _anchor;
    for (let child of this.children) {
      child.moveBefore(_anchor);
    }
  }
  patch(other: any) {
    const oldKeys = this.keys;
    const newKeys = other.keys;
    const oldCh = this.children;
    const newCh: Block[] = other.children;
    let oldStartIdx = 0;
    let newStartIdx = 0;
    let oldEndIdx = oldCh.length - 1;
    let newEndIdx = newCh.length - 1;
    let mapping: any = undefined;
    const _anchor = this.anchor!;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (oldCh[oldStartIdx] === null) {
        oldStartIdx++;
      } else if (oldCh[oldEndIdx] === null) {
        oldEndIdx--;
      } else if (oldKeys[oldStartIdx] === newKeys[newStartIdx]) {
        oldCh[oldStartIdx].patch(newCh[newStartIdx]);
        newCh[newStartIdx] = oldCh[oldStartIdx];
        oldStartIdx++;
        newStartIdx++;
      } else if (oldKeys[oldEndIdx] === newKeys[newEndIdx]) {
        oldCh[oldEndIdx].patch(newCh[newEndIdx]);
        newCh[newEndIdx] = oldCh[oldEndIdx];
        oldEndIdx--;
        newEndIdx--;
      } else if (oldKeys[oldStartIdx] === newKeys[newEndIdx]) {
        // bnode moved right
        const elm = oldCh[oldStartIdx];
        elm.patch(newCh[newEndIdx]);
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.firstChildNode()! : _anchor;
        elm.moveBefore(anchor);
        newCh[newEndIdx] = elm;
        oldStartIdx++;
        newEndIdx--;
      } else if (oldKeys[oldEndIdx] === newKeys[newStartIdx]) {
        // bnode moved left
        const elm = oldCh[oldEndIdx];
        elm.patch(newCh[newStartIdx]);
        const nextChild = oldCh[oldStartIdx];
        const anchor = nextChild ? nextChild.firstChildNode()! : _anchor;
        elm.moveBefore(anchor);
        newCh[newStartIdx] = elm;
        oldEndIdx--;
        newStartIdx++;
      } else {
        mapping = mapping || createMapping(oldKeys, oldStartIdx, oldEndIdx);
        let idxInOld = mapping[newKeys[newStartIdx]];
        if (idxInOld === undefined) {
          // new element
          newCh[newStartIdx].mountBefore(oldCh[oldStartIdx].firstChildNode()!);
          newStartIdx++;
        } else {
          const elmToMove = oldCh[idxInOld];
          elmToMove.moveBefore(oldCh[oldStartIdx].firstChildNode()!);
          elmToMove.patch(newCh[newStartIdx]);
          newCh[newStartIdx] = elmToMove;
          oldCh[idxInOld] = null as any;
          newStartIdx++;
        }
      }
    }
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      if (oldStartIdx > oldEndIdx) {
        const nextChild = newCh[newEndIdx + 1];
        const anchor = nextChild ? nextChild.firstChildNode()! : _anchor;
        for (let i = newStartIdx; i <= newEndIdx; i++) {
          newCh[i].mountBefore(anchor);
        }
      } else {
        for (let i = oldStartIdx; i <= oldEndIdx; i++) {
          let ch = oldCh[i];
          if (ch) {
            ch.remove();
          }
        }
      }
    }
    this.children = newCh;
    this.keys = newKeys;
  }
}

function createMapping(
  oldKeys: any[],
  oldStartIdx: number,
  oldEndIdx: number
): { [key: string]: any } {
  let mapping: any = {};
  for (let i = oldStartIdx; i <= oldEndIdx; i++) {
    mapping[oldKeys[i]] = i;
  }
  return mapping;
}
interface Type<T> extends Function {
  new (...args: any[]): T;
}

export const Blocks: { [key: string]: Type<Block> } = {
  BNode,
  BMulti,
  BHtml,
  BCollection,
  BText,
};
