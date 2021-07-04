import { Block } from "./block";

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
    this.el = (this.constructor as any).el.cloneNode(true);
    this.build();
    this.update();
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
          for (let cl of _class.trim().split(/\s+/)) {
            elem.classList.add(cl);
          }
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
    el.addEventListener(eventType, (ev) => {
      const info = this.handlers![index];
      const [, callback, ctx] = info;
      if (ctx.__owl__ && !ctx.__owl__.isMounted) {
        return;
      }
      callback(ev);
    });
  }

  protected build() {}

  patch(newTree: any) {
    this.data = newTree.data;
    this.refs = newTree.refs;
    this.update();
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
            child.remove();
          }
        } else if (newChild) {
          children[i] = newChild;
          newChild.mountBefore(anchors[i]);
        }
      }
    }
  }

  remove() {
    this.el!.remove();
  }
}
