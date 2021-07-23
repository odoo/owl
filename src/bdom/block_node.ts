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
  refs?: { [name: string]: HTMLElement };

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
            const classStr = k.trim().split(/\s+/);
            for (let i = 0; i < classStr.length; i++) {
              elem.classList.add(classStr[i]);
            }
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

  setupHandler(el: HTMLElement, eventType: string, index: number) {
    el.addEventListener(eventType, (ev) => {
      const callback = this.handlers![index];
      callback(ev);
    });
  }

  protected build() {}

  patch(newTree: BNode): void {
    this.data = newTree.data;
    this.refs = newTree.refs;
    this.handlers = newTree.handlers;
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
            child.fullRemove();
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
