import { toClassObj } from "../template_utils";
import { Block, mountBlock, removeBlock } from "./block";

// -----------------------------------------------------------------------------
//  Content Block
// -----------------------------------------------------------------------------

export class BElem implements Block<BElem> {
  static el: ChildNode;
  el: ChildNode | null = null;
  children: (BElem | null)[] | null = null;
  anchors?: ChildNode[] | null = null;
  data?: any[] | null = null;
  handlers?: any[] | null = null;
  refs?: { [name: string]: HTMLElement };

  firstChildNode(): ChildNode | null {
    return this.el;
  }

  toString(): string {
    const div = document.createElement("div");
    mountBlock(this, div);
    return div.innerHTML;
  }

  mountBefore(anchor: ChildNode) {
    this.el = (this.constructor as any).el.cloneNode(true);
    this.build();
    this.update([], this.data!);
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

  update(prevData: any[], newData: any[]) {}

  updateClass(elem: HTMLElement, prevClass: any, _class: any) {
    if (prevClass === _class) {
      return;
    }
    prevClass = prevClass === undefined ? {} : toClassObj(prevClass);
    _class = _class === undefined ? {} : toClassObj(_class);
    // remove classes
    for (let c in prevClass) {
      if (!(c in _class)) {
        elem.classList.remove(c);
      }
    }
    // add classes
    for (let c in _class) {
      if (!(c in prevClass)) {
        elem.classList.add(c);
      }
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

  setupHandler(el: HTMLElement, eventType: string, index: number) {
    el.addEventListener(eventType, (ev) => {
      const info = this.handlers![index];
      if (typeof info === "function") {
        info(ev);
      } else {
        const ctx = info[0];
        const method = info[1];
        const args = info[2] || [];
        ctx.__owl__.component[method](...args, ev);
      }
    });
  }

  protected build() {}

  patch(newTree: BElem): void {
    const prevData = this.data!;
    this.data = newTree.data;
    this.refs = newTree.refs;
    this.handlers = newTree.handlers;
    this.update(prevData, this.data!);
    if (this.children) {
      const anchors = this.anchors!;
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
            removeBlock(child);
          }
        } else if (newChild) {
          children[i] = newChild;
          newChild.mountBefore(anchors[i]);
        }
      }
    }
  }

  beforeRemove() {
    const children = this.children;
    if (children) {
      for (let child of this.children!) {
        if (child) {
          child.beforeRemove();
        }
      }
    }
  }

  remove() {
    this.el!.remove();
  }
}
