import { VNode, h, addNS } from "./vdom";

const parser = new DOMParser();

export function htmlToVDOM(html: string): VNode[] {
  const doc = parser.parseFromString(html, "text/html");
  const result: VNode[] = [];
  for (let child of doc.body.childNodes) {
    result.push(htmlToVNode(child));
  }
  return result;
}

function htmlToVNode(node: ChildNode): VNode {
  if (!(node instanceof Element)) {
    if (node instanceof Comment) {
      return h("!", node.textContent);
    }
    return { text: node.textContent! } as VNode;
  }
  const attrs = {};
  for (let attr of node.attributes) {
    attrs[attr.name] = attr.textContent;
  }
  const children: VNode[] = [];
  for (let c of node.childNodes) {
    children.push(htmlToVNode(c));
  }
  const vnode = h((node as Element).tagName, { attrs }, children);
  if (vnode.sel === "svg") {
    addNS(vnode.data, (vnode as any).children, vnode.sel);
  }
  return vnode;
}
