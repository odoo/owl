import { Context, QWeb, UTILS } from "./qweb_core";

/**
 * Owl QWeb Directives
 *
 * This file contains the implementation of most standard QWeb directives:
 * - t-esc
 * - t-raw
 * - t-set/t-value
 * - t-if/t-elif/t-else
 * - t-call
 * - t-foreach/t-as
 * - t-debug
 * - t-log
 */


//------------------------------------------------------------------------------
// t-esc and t-raw
//------------------------------------------------------------------------------
(<any>UTILS).getFragment = function(str: string): DocumentFragment {
  const temp = document.createElement("template");
  temp.innerHTML = str;
  return temp.content;
};

function compileValueNode(value: any, node: Element, qweb: QWeb, ctx: Context) {
  if (value === "0" && ctx.caller) {
    qweb._compileNode(ctx.caller, ctx);
    return;
  }

  if (typeof value === "string") {
    let exprID = value;
    if (!(value in ctx.definedVariables)) {
      exprID = `_${ctx.generateID()}`;
      ctx.addLine(`var ${exprID} = ${ctx.formatExpression(value)};`);
    }
    ctx.addIf(`${exprID} || ${exprID} === 0`);
    if (!ctx.parentNode) {
      throw new Error("Should not have a text node without a parent");
    }
    if (ctx.escaping) {
      ctx.addLine(`c${ctx.parentNode}.push({text: ${exprID}});`);
    } else {
      let fragID = ctx.generateID();
      ctx.addLine(`var frag${fragID} = this.utils.getFragment(${exprID})`);
      let tempNodeID = ctx.generateID();
      ctx.addLine(`var p${tempNodeID} = {hook: {`);
      ctx.addLine(
        `  insert: n => n.elm.parentNode.replaceChild(frag${fragID}, n.elm),`
      );
      ctx.addLine(`}};`);
      ctx.addLine(`var vn${tempNodeID} = h('div', p${tempNodeID})`);
      ctx.addLine(`c${ctx.parentNode}.push(vn${tempNodeID});`);
    }
    if (node.childNodes.length) {
      ctx.addElse();
      qweb._compileChildren(node, ctx);
    }
    ctx.closeIf();
    return;
  }
  if (value instanceof NodeList) {
    for (let node of Array.from(value)) {
      qweb._compileNode(<ChildNode>node, ctx);
    }
  }
}

QWeb.addDirective({
  name: "esc",
  priority: 70,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      let nodeID = qweb._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }
    let value = ctx.getValue(node.getAttribute("t-esc")!);
    compileValueNode(value, node, qweb, ctx.subContext("escaping", true));
    return true;
  }
});

QWeb.addDirective({
  name: "raw",
  priority: 80,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      let nodeID = qweb._compileGenericNode(node, ctx);
      ctx = ctx.withParent(nodeID);
    }
    let value = ctx.getValue(node.getAttribute("t-raw")!);
    compileValueNode(value, node, qweb, ctx);
    return true;
  }
});

//------------------------------------------------------------------------------
// t-set
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "set",
  extraNames: ["value"],
  priority: 60,
  atNodeEncounter({ node, ctx }): boolean {
    const variable = node.getAttribute("t-set")!;
    let value = node.getAttribute("t-value")!;
    if (value) {
      const formattedValue = ctx.formatExpression(value);
      if (ctx.variables.hasOwnProperty(variable)) {
        ctx.addLine(`${ctx.variables[variable]} = ${formattedValue}`);
      } else {
        const varName = `_${ctx.generateID()}`;
        ctx.addLine(`var ${varName} = ${formattedValue};`);
        ctx.definedVariables[varName] = formattedValue;
        ctx.variables[variable] = varName;
      }
    } else {
      ctx.variables[variable] = node.childNodes;
    }
    return true;
  }
});

//------------------------------------------------------------------------------
// t-if, t-elif, t-else
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "if",
  priority: 20,
  atNodeEncounter({ node, ctx }): boolean {
    let cond = ctx.getValue(node.getAttribute("t-if")!);
    ctx.addIf(`${ctx.formatExpression(cond)}`);
    return false;
  },
  finalize({ ctx }) {
    ctx.closeIf();
  }
});

QWeb.addDirective({
  name: "elif",
  priority: 30,
  atNodeEncounter({ node, ctx }): boolean {
    let cond = ctx.getValue(node.getAttribute("t-elif")!);
    ctx.addLine(`else if (${ctx.formatExpression(cond)}) {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.closeIf();
  }
});

QWeb.addDirective({
  name: "else",
  priority: 40,
  atNodeEncounter({ ctx }): boolean {
    ctx.addLine(`else {`);
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.closeIf();
  }
});

//------------------------------------------------------------------------------
// t-call
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "call",
  priority: 50,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    if (node.nodeName !== "t") {
      throw new Error("Invalid tag for t-call directive (should be 't')");
    }
    const subTemplate = node.getAttribute("t-call")!;
    const nodeTemplate = qweb.templates[subTemplate];
    if (!nodeTemplate) {
      throw new Error(`Cannot find template "${subTemplate}" (t-call)`);
    }
    const nodeCopy = node.cloneNode(true) as Element;
    nodeCopy.removeAttribute("t-call");

    // extract variables from nodecopy
    const tempCtx = new Context();
    tempCtx.nextID = ctx.rootContext.nextID;
    qweb._compileNode(nodeCopy, tempCtx);
    const vars = Object.assign({}, ctx.variables, tempCtx.variables);
    var definedVariables = Object.assign(
      {},
      ctx.definedVariables,
      tempCtx.definedVariables
    );
    ctx.rootContext.nextID = tempCtx.nextID;

    // open new scope, if necessary
    const hasNewVariables = Object.keys(definedVariables).length > 0;
    if (hasNewVariables) {
      ctx.addLine("{");
      ctx.indent();
    }

    // add new variables, if any
    for (let key in definedVariables) {
      ctx.addLine(`let ${key} = ${definedVariables[key]}`);
    }

    // compile sub template
    const subCtx = ctx
      .subContext("caller", nodeCopy)
      .subContext("variables", Object.create(vars))
      .subContext("definedVariables", Object.create(definedVariables));

    qweb._compileNode(nodeTemplate.elem, subCtx);

    // close new scope
    if (hasNewVariables) {
      ctx.dedent();
      ctx.addLine("}");
    }

    return true;
  }
});

//------------------------------------------------------------------------------
// t-foreach
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "foreach",
  extraNames: ["as"],
  priority: 10,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    ctx.rootContext.shouldProtectContext = true;
    ctx = ctx.subContext("inLoop", true);
    const elems = node.getAttribute("t-foreach")!;
    const name = node.getAttribute("t-as")!;
    let arrayID = ctx.generateID();
    ctx.addLine(`var _${arrayID} = ${ctx.formatExpression(elems)};`);
    ctx.addLine(
      `if (!_${arrayID}) { throw new Error('QWeb error: Invalid loop expression')}`
    );
    let keysID = ctx.generateID();
    let valuesID = ctx.generateID();
    ctx.addLine(`var _${keysID} = _${valuesID} = _${arrayID};`);
    ctx.addIf(`!(_${arrayID} instanceof Array)`);
    ctx.addLine(`_${keysID} = Object.keys(_${arrayID});`);
    ctx.addLine(`_${valuesID} = Object.values(_${arrayID});`);
    ctx.closeIf();
    ctx.addLine(`var _length${keysID} = _${keysID}.length;`);
    ctx.addLine(`for (let i = 0; i < _length${keysID}; i++) {`);
    ctx.indent();
    ctx.addLine(`context.${name}_first = i === 0;`);
    ctx.addLine(`context.${name}_last = i === _length${keysID} - 1;`);
    ctx.addLine(`context.${name}_index = i;`);
    ctx.addLine(`context.${name} = _${keysID}[i];`);
    ctx.addLine(`context.${name}_value = _${valuesID}[i];`);
    const nodeCopy = <Element>node.cloneNode(true);
    let shouldWarn =
      nodeCopy.tagName !== "t" && !nodeCopy.hasAttribute("t-key");
    if (!shouldWarn && node.tagName === "t") {
      if (node.hasAttribute("t-widget") && !node.hasAttribute("t-key")) {
        shouldWarn = true;
      }
      if (
        !shouldWarn &&
        node.children.length === 1 &&
        node.children[0].tagName !== "t" &&
        !node.children[0].hasAttribute("t-key")
      ) {
        shouldWarn = true;
      }
    }
    if (shouldWarn) {
      console.warn(
        `Directive t-foreach should always be used with a t-key! (in template: '${
          ctx.templateName
        }')`
      );
    }
    nodeCopy.removeAttribute("t-foreach");
    qweb._compileNode(nodeCopy, ctx);
    ctx.dedent();
    ctx.addLine("}");
    return true;
  }
});

//------------------------------------------------------------------------------
// t-debug
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "debug",
  priority: 99,
  atNodeEncounter({ ctx }) {
    ctx.addLine("debugger;");
  }
});

//------------------------------------------------------------------------------
// t-log
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "log",
  priority: 99,
  atNodeEncounter({ ctx, value }) {
    const expr = ctx.formatExpression(value);
    ctx.addLine(`console.log(${expr})`);
  }
});
