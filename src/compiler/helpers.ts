export const enum DomType {
  Text,
  Comment,
  Node,
}

export interface DomText {
  type: DomType.Text;
  value: string;
}

export interface DomComment {
  type: DomType.Comment;
  value: string;
}
export interface DomNode {
  type: DomType.Node;
  tag: string;
  attrs: { [key: string]: string };
  content: Dom[];
}

export type Dom = DomText | DomComment | DomNode;

export function domToString(dom: Dom): string {
  switch (dom.type) {
    case DomType.Text:
      return dom.value;
    case DomType.Comment:
      return `<!--${dom.value}-->`;
    case DomType.Node:
      const content = dom.content.map(domToString).join("");
      const attrs: string[] = [];
      for (let [key, value] of Object.entries(dom.attrs)) {
        if (!(key === "class" && value === "")) {
          attrs.push(`${key}="${value}"`);
        }
      }
      if (content) {
        return `<${dom.tag}${attrs.length ? " " + attrs.join(" ") : ""}>${content}</${dom.tag}>`;
      } else {
        return `<${dom.tag}${attrs.length ? " " + attrs.join(" ") : ""}/>`;
      }
  }
}

export function isProp(tag: string, key: string): boolean {
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
