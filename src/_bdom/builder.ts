import { mountBefore, patch, remove } from "./blockdom";
import { Builder } from "./types";

// -----------------------------------------------------------------------------
//  makeBuilder
// -----------------------------------------------------------------------------
interface BuilderContext {
  path: string[];
  isDynamic: boolean;
  hasChild: boolean;
  hasHandler: boolean;
  info: { index: number; type: "text" | "child" | "handler"; path: string; event?: string }[];
}

function toDom(node: ChildNode, ctx: BuilderContext): HTMLElement | Text | Comment {
  switch (node.nodeType) {
    case 1: {
      // HTMLElement
      const tagName = (node as Element).tagName;
      if (tagName.startsWith("owl-text-")) {
        const index = parseInt(tagName.slice(9), 10);
        ctx.info.push({ index, path: ctx.path.join("."), type: "text" });
        ctx.isDynamic = true;
        return document.createTextNode("");
      }
      if (tagName.startsWith("owl-child-")) {
        const index = parseInt(tagName.slice(10), 10);
        ctx.info.push({ index, type: "child", path: ctx.path.join(".") });
        ctx.hasChild = true;
        return document.createTextNode("");
      }
      const result = document.createElement((node as Element).tagName);
      const attrs = (node as Element).attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attrName = attrs[i].name;
        const attrValue = attrs[i].value;
        if (attrName.startsWith("owl-handler-")) {
          const index = parseInt(attrName.slice(12), 10);
          ctx.info.push({ index, path: ctx.path.join("."), type: "handler", event: attrValue });
          ctx.hasHandler = true;
        } else {
          result.setAttribute(attrs[i].name, attrValue);
        }
      }
      let children = (node as Element).childNodes;
      const initialPath = ctx.path.slice();
      let currentPath = initialPath.slice();
      for (let i = 0; i < children.length; i++) {
        currentPath = currentPath.concat(i === 0 ? "firstChild" : "nextSibling");
        ctx.path = currentPath;
        result.appendChild(toDom(children[i], ctx));
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

export function makeBuilder(str: string): Builder {
  const info: BuilderContext["info"] = [];
  const ctx: BuilderContext = {
    path: ["el"],
    info,
    hasChild: false,
    hasHandler: false,
    isDynamic: false,
  };

  const doc = new DOMParser().parseFromString(str, "text/xml");
  const template = toDom(doc.firstChild!, ctx) as any;
  const isDynamic = ctx.isDynamic;
  const hasChild = ctx.hasChild;
  const hasHandler = ctx.hasHandler;

  // console.log(context)
  const signature = hasChild ? "data, children" : isDynamic || hasHandler ? "data" : "";
  const code: string[] = [
    `  return class Builder {`,
    `    constructor(${signature}) {`,
    `      this.el = template.cloneNode(true);`,
  ];

  // preparing all internal refs
  if (info.length) {
    for (let i = 0; i < info.length; i++) {
      code.push(`      let ref${i} = this.${info[i].path};`);
    }
    code.push(
      `      this.refs = [${info.map((t: any, index: number) => `ref${index}`).join(", ")}];`
    );
  }

  if (isDynamic || hasHandler) {
    code.push(`      this.data = [];`);
  }
  if (hasChild) {
    code.push(`      this.children = [];`);
  }
  if (hasHandler) {
    // todo
    code.push(`      const handler = this.handleEvent;`);
    for (let i = 0; i < info.length; i++) {
      if (info[i].type === "handler") {
        code.push(
          `      ref${i}.addEventListener("${info[i].event}", handler.bind(this, ${info[i].index}));`
        );
      }
    }
  }
  if (info.length) {
    code.push(`      this.update(${signature});`);
  }

  // end of constructor
  code.push(`    }`);
  code.push(`    update(${signature}) {`);

  // update function
  if (info.length) {
    if (isDynamic || hasChild) {
      code.push(`      const refs = this.refs;`);
    }
    if (isDynamic || hasHandler) {
      code.push(`      const currentData = this.data;`);
      code.push(`      const nextData = data.data;`);
    }
    if (hasChild) {
      code.push(`      const currentChildren = this.children;`);
    }

    for (let i = 0; i < info.length; i++) {
      const data = info[i];
      const index = data.index;
      switch (data.type) {
        case "text":
          code.push(
            `      if (nextData[${index}] !== currentData[${index}]) { refs[${i}].textContent = nextData[${index}]}`
          );
          break;
        case "child":
          code.push(
            `      let currentChild${index} = currentChildren[${index}], child${index} = children[${index}];`
          );
          code.push(
            `      if (currentChild${index}) { if (child${index}) { patch(currentChild${index}, child${index}); } else { remove(currentChild${index}); } }`
          );
          code.push(`      else if (child${index}) { mountBefore(child${index}, refs[${i}]) }`);
      }
    }
    if (isDynamic || hasHandler) {
      code.push(`      this.data = nextData;`);
    }
    if (hasChild) {
      code.push(`      this.children = children;`);
    }
  }
  code.push(`    }`);
  if (hasHandler) {
    code.push(`    handleEvent(n) {`);
    code.push(`      const [owner, method] = this.data[n];`);
    code.push(`      owner[method]();`);
    code.push(`    }`);
  }
  code.push(`  }`);

  //   console.warn(code.join("\n"));
  const wrapper = new Function("template, mountBefore, patch, remove", code.join("\n"));
  return wrapper(template, mountBefore, patch, remove);
}
