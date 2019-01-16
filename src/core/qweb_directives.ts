import QWeb from "./qweb";
import { Context } from "./qweb";

interface CompilationInfo {
  nodeID?: string;
  node: Element;
  qweb: QWeb;
  ctx: Context;
  fullName: string;
  value: string;
}

export interface Directive {
  name: string;
  priority: number;
  // if return true, then directive is fully applied and there is no need to
  // keep processing node. Otherwise, we keep going.
  atNodeEncounter?(info: CompilationInfo): boolean;
  atNodeCreation?(info: CompilationInfo);
  finalize?(info: CompilationInfo);
}

const forEachDirective: Directive = {
  name: "foreach",
  priority: 10,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    const elems = node.getAttribute("t-foreach")!;
    const name = node.getAttribute("t-as")!;
    let arrayID = ctx.generateID();
    ctx.addLine(`let ${arrayID} = ${qweb._formatExpression(elems)}`);
    ctx.addLine(
      `if (typeof ${arrayID} === 'number') { ${arrayID} = Array.from(Array(${arrayID}).keys())}`
    );
    let keysID = ctx.generateID();
    ctx.addLine(
      `let ${keysID} = ${arrayID} instanceof Array ? ${arrayID} : Object.keys(${arrayID})`
    );
    let valuesID = ctx.generateID();
    ctx.addLine(
      `let ${valuesID} = ${arrayID} instanceof Array ? ${arrayID} : Object.values(${arrayID})`
    );
    ctx.addLine(`for (let i = 0; i < ${keysID}.length; i++) {`);
    ctx.indent();
    ctx.addLine(`context.${name}_first = i === 0`);
    ctx.addLine(`context.${name}_last = i === ${keysID}.length - 1`);
    ctx.addLine(`context.${name}_parity = i % 2 === 0 ? 'even' : 'odd'`);
    ctx.addLine(`context.${name}_index = i`);
    ctx.addLine(`context.${name} = ${keysID}[i]`);
    ctx.addLine(`context.${name}_value = ${valuesID}[i]`);
    const nodes = Array.from(node.childNodes);
    for (let i = 0; i < nodes.length; i++) {
      qweb._compileNode(nodes[i], ctx);
    }
    ctx.dedent();
    ctx.addLine("}");
    return true;
  }
};

const ifDirective: Directive = {
  name: "if",
  priority: 20,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    let cond = qweb._getValue(node.getAttribute("t-if")!, ctx);
    ctx.addLine(`if (${qweb._formatExpression(cond)}) {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine(`}`);
  }
};

const elifDirective: Directive = {
  name: "elif",
  priority: 30,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    let cond = qweb._getValue(node.getAttribute("t-elif")!, ctx);
    ctx.addLine(`else if (${qweb._formatExpression(cond)}) {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine(`}`);
  }
};

const elseDirective: Directive = {
  name: "else",
  priority: 40,
  atNodeEncounter({ ctx }): boolean {
    ctx.addLine(`else {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine(`}`);
  }
};

const callDirective: Directive = {
  name: "call",
  priority: 50,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    const subTemplate = node.getAttribute("t-call")!;
    const nodeTemplate = qweb.nodeTemplates[subTemplate];
    const nodeCopy = <Element>node.cloneNode(true);
    nodeCopy.removeAttribute("t-call");

    // extract variables from nodecopy
    const tempCtx = new Context();
    qweb._compileNode(nodeCopy, tempCtx);
    const vars = Object.assign({}, ctx.variables, tempCtx.variables);
    const subCtx = ctx.withCaller(nodeCopy).withVariables(vars);

    qweb._compileNode(nodeTemplate.firstChild!, subCtx);
    return true;
  }
};

const setDirective: Directive = {
  name: "set",
  priority: 60,
  atNodeEncounter({ node, ctx }): boolean {
    const variable = node.getAttribute("t-set")!;
    let value = node.getAttribute("t-value")!;
    if (value) {
      ctx.variables[variable] = value;
    } else {
      ctx.variables[variable] = node.childNodes;
    }
    return true;
  }
};

function compileValueNode(value: any, node: Element, qweb: QWeb, ctx: Context) {
  if (value === "0" && ctx.caller) {
    qweb._compileNode(ctx.caller, ctx);
    return;
  }

  if (typeof value === "string") {
    const exprID = ctx.generateID();
    ctx.addLine(`let ${exprID} = ${qweb._formatExpression(value)}`);
    ctx.addLine(`if (${exprID} || ${exprID} === 0) {`);
    ctx.indent();
    let text = exprID;
    if (ctx.escaping) {
      text = `this.escape(${text})`;
    }

    const nodeID = ctx.generateID();
    ctx.addLine(`let ${nodeID} = document.createTextNode(${text})`);
    ctx.addNode(nodeID);
    ctx.dedent();
    if (node.childNodes.length) {
      ctx.addLine("} else {");
      ctx.indent();
      qweb._compileChildren(node, ctx);
      ctx.dedent();
    }
    ctx.addLine("}");
    return;
  }
  if (value instanceof NodeList) {
    for (let node of Array.from(value)) {
      qweb._compileNode(<ChildNode>node, ctx);
    }
  }
}

const escDirective: Directive = {
  name: "esc",
  priority: 70,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      let nodeID = qweb._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }
    let value = qweb._getValue(node.getAttribute("t-esc")!, ctx);
    compileValueNode(value, node, qweb, ctx.withEscaping());
    return true;
  }
};

const rawDirective: Directive = {
  name: "raw",
  priority: 80,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      let nodeID = qweb._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }
    let value = qweb._getValue(node.getAttribute("t-raw")!, ctx);
    compileValueNode(value, node, qweb, ctx);
    return true;
  }
};

const onDirective: Directive = {
  name: "on",
  priority: 90,
  atNodeCreation({ ctx, fullName, value, nodeID }) {
    const eventName = fullName.slice(5);
    let extraArgs;
    let handler = value.replace(/\(.*\)/, function(args) {
      extraArgs = args.slice(1, -1);
      return "";
    });
    ctx.addLine(
      `${nodeID}.addEventListener('${eventName}', context['${handler}'].bind(context${
        extraArgs ? ", " + extraArgs : ""
      }))`
    );
  }
};

export default [
  forEachDirective,
  ifDirective,
  elifDirective,
  elseDirective,
  callDirective,
  setDirective,
  escDirective,
  rawDirective,
  onDirective
];
