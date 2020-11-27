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
  el: HTMLElement | Text | null = null;
  refs?: { [name: string]: HTMLElement };

  mount(parent: HTMLElement | DocumentFragment) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.mountBefore(anchor);
    anchor.remove();
  }

  abstract mountBefore(anchor: Text): void;

  abstract patch(other: Block): void;

  remove() {}

  move(parent: HTMLElement | DocumentFragment) {
    const anchor = document.createTextNode("");
    parent.appendChild(anchor);
    this.moveBefore(anchor);
    anchor.remove();
  }

  moveBefore(anchor: Text): void {
    this.mountBefore(anchor);
  }
}

// -----------------------------------------------------------------------------
//  Html Block
// -----------------------------------------------------------------------------

export class BHtml extends Block {
  html: string;
  content: ChildNode[] = [];
  anchor: Text;
  constructor(html: any) {
    super();
    this.html = String(html);
    this.anchor = document.createTextNode("");
  }

  mountBefore(anchor: Text) {
    this.build();
    anchor.before(this.anchor);
    for (let elem of this.content) {
      this.anchor.before(elem);
    }
  }

  moveBefore(anchor: Text): void {
    anchor.before(this.anchor);
    for (let elem of this.content) {
      this.anchor.before(elem);
    }
  }

  build() {
    const div = document.createElement("div");
    div.innerHTML = this.html;
    this.content = [...div.childNodes];
    this.el = this.content[0] as any;
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
  constructor(text: string) {
    super();
    this.el = document.createTextNode(text);
  }

  mountBefore(anchor: Text) {
    anchor.before(this.el);
  }

  patch(other: any) {
    this.el.textContent = other.el.textContent;
  }

  toString() {
    return this.el.textContent;
  }
}

// -----------------------------------------------------------------------------
//  Content Block
// -----------------------------------------------------------------------------

export class BNode extends Block {
  static el: HTMLElement | Text;
  // el?: HTMLElement | Text;
  children: (BNode | null)[] | null = null;
  anchors?: Text[] | null = null;
  data?: any[] | null = null;
  handlers?: any[] | null = null;

  toString(): string {
    const div = document.createElement("div");
    this.mount(div);
    return div.innerHTML;
  }

  mountBefore(anchor: Text) {
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

  moveBefore(anchor: Text) {
    anchor.before(this.el!);
  }

  update() {}

  updateClass(elem: HTMLElement, _class: string) {
    if (_class) {
      elem.classList.add(_class);
    }
  }

  updateAttr(elem: HTMLElement, attr: string, value: any) {
    if (value) {
      elem.setAttribute(attr, value);
    } else {
      elem.removeAttribute(attr);
    }
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
    this.update();
    if (this.children) {
      const children = this.children;
      const newChildren = newTree.children!;
      for (let i = 0; i < newChildren.length; i++) {
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
          const anchor = this.anchors![i];
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
  anchors?: Text[];

  constructor(n: number) {
    super();
    this.children = new Array(n);
    this.anchors = new Array(n);
  }

  mountBefore(anchor: Text) {
    for (let i = 0; i < this.children.length; i++) {
      let child: any = this.children[i];
      const childAnchor = document.createTextNode("");
      anchor.before(childAnchor);
      this.anchors![i] = childAnchor;
      if (child) {
        child.mountBefore(childAnchor);
      }
    }
  }

  moveBefore(anchor: Text) {
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
    for (let i = 0; i < this.children.length; i++) {
      const block = this.children[i];
      const newBlock = newTree.children[i];
      if (block) {
        if (newBlock) {
          block.patch(newBlock);
        } else {
          this.children[0] = null;
          block.remove();
        }
      } else if (newBlock) {
        this.children[i] = newBlock;
        newBlock.mountBefore(this.anchors![i]);
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
  anchor?: Text;
  keys: (string | number)[];

  constructor(n: number) {
    super();
    this.keys = new Array(n);
    this.children = new Array(n);
  }

  mountBefore(anchor: Text) {
    const _anchor = document.createTextNode("");
    anchor.before(_anchor);
    this.anchor = _anchor;
    for (let child of this.children) {
      child.mountBefore(_anchor);
    }
  }

  moveBefore(anchor: Text) {
    const _anchor = document.createTextNode("");
    anchor.before(_anchor);
    this.anchor = _anchor;
    for (let child of this.children) {
      child.moveBefore(_anchor);
    }
  }
  patch() {}
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
