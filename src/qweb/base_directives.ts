import { CompilationContext, INTERP_REGEXP } from "./compilation_context";
import { QWeb } from "./qweb";
import { htmlToVDOM } from "../vdom/html_to_vdom";
import { QWebVar } from "./expression_parser";

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
QWeb.utils.htmlToVDOM = htmlToVDOM;

function compileValueNode(value: any, node: Element, qweb: QWeb, ctx: CompilationContext) {
  ctx.rootContext.shouldDefineScope = true;
  if (value === "0") {
    if (ctx.parentNode) {
      // the 'zero' magical symbol is where we can find the result of the rendering
      // of  the body of the t-call.
      ctx.rootContext.shouldDefineUtils = true;
      const zeroArgs = ctx.escaping
        ? `{text: utils.vDomToString(scope[utils.zero])}`
        : `...scope[utils.zero]`;
      ctx.addLine(`c${ctx.parentNode}.push(${zeroArgs});`);
    }
    return;
  }

  let exprID: string;
  if (typeof value === "string") {
    exprID = `_${ctx.generateID()}`;
    ctx.addLine(`let ${exprID} = ${ctx.formatExpression(value)};`);
  } else {
    exprID = `scope.${value.id}`;
  }
  ctx.addIf(`${exprID} != null`);

  if (ctx.escaping) {
    let protectID;
    if (value.hasBody) {
      ctx.rootContext.shouldDefineUtils = true;
      protectID = ctx.startProtectScope();
      ctx.addLine(
        `${exprID} = ${exprID} instanceof utils.VDomArray ? utils.vDomToString(${exprID}) : ${exprID};`
      );
    }
    if (ctx.parentTextNode) {
      ctx.addLine(`vn${ctx.parentTextNode}.text += ${exprID};`);
    } else if (ctx.parentNode) {
      ctx.addLine(`c${ctx.parentNode}.push({text: ${exprID}});`);
    } else {
      let nodeID = ctx.generateID();
      ctx.rootContext.rootNode = nodeID;
      ctx.rootContext.parentTextNode = nodeID;
      ctx.addLine(`let vn${nodeID} = {text: ${exprID}};`);
      if (ctx.rootContext.shouldDefineResult) {
        ctx.addLine(`result = vn${nodeID}`);
      }
    }
    if (value.hasBody) {
      ctx.stopProtectScope(protectID);
    }
  } else {
    ctx.rootContext.shouldDefineUtils = true;
    if (value.hasBody) {
      ctx.addLine(
        `const vnodeArray = ${exprID} instanceof utils.VDomArray ? ${exprID} : utils.htmlToVDOM(${exprID});`
      );
      ctx.addLine(`c${ctx.parentNode}.push(...vnodeArray);`);
    } else {
      ctx.addLine(`c${ctx.parentNode}.push(...utils.htmlToVDOM(${exprID}));`);
    }
  }
  if (node.childNodes.length) {
    ctx.addElse();
    qweb._compileChildren(node, ctx);
  }

  ctx.closeIf();
}

QWeb.addDirective({
  name: "esc",
  priority: 70,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    let value = ctx.getValue(node.getAttribute("t-esc")!);
    compileValueNode(value, node, qweb, ctx.subContext("escaping", true));
    return true;
  },
});

QWeb.addDirective({
  name: "raw",
  priority: 80,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    let value = ctx.getValue(node.getAttribute("t-raw")!);
    compileValueNode(value, node, qweb, ctx);
    return true;
  },
});

//------------------------------------------------------------------------------
// t-set
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "set",
  extraNames: ["value"],
  priority: 60,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    ctx.rootContext.shouldDefineScope = true;
    const variable = node.getAttribute("t-set")!;
    let value = node.getAttribute("t-value")!;
    ctx.variables[variable] = ctx.variables[variable] || ({} as QWebVar);
    let qwebvar = ctx.variables[variable];
    const hasBody = node.hasChildNodes();

    qwebvar.id = variable;
    qwebvar.expr = `scope.${variable}`;
    if (value) {
      const formattedValue = ctx.formatExpression(value);
      let scopeExpr = `scope`;
      if (ctx.protectedScopeNumber) {
        ctx.rootContext.shouldDefineUtils = true;
        scopeExpr = `utils.getScope(scope, '${variable}')`;
      }
      ctx.addLine(`${scopeExpr}.${variable} = ${formattedValue};`);
      qwebvar.value = formattedValue;
    }

    if (hasBody) {
      ctx.rootContext.shouldDefineUtils = true;
      if (value) {
        ctx.addIf(`!(${qwebvar.expr})`);
      }
      const tempParentNodeID = ctx.generateID();
      const _parentNode = ctx.parentNode;
      ctx.parentNode = tempParentNodeID;

      ctx.addLine(`let c${tempParentNodeID} = new utils.VDomArray();`);
      const nodeCopy = node.cloneNode(true) as Element;
      for (let attr of ["t-set", "t-value", "t-if", "t-else", "t-elif"]) {
        nodeCopy.removeAttribute(attr);
      }
      qweb._compileNode(nodeCopy, ctx);

      ctx.addLine(`${qwebvar.expr} = c${tempParentNodeID}`);
      qwebvar.value = `c${tempParentNodeID}`;
      qwebvar.hasBody = true;

      ctx.parentNode = _parentNode;
      if (value) {
        ctx.closeIf();
      }
    }
    return true;
  },
});

//------------------------------------------------------------------------------
// t-if, t-elif, t-else
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "if",
  priority: 20,
  atNodeEncounter({ node, ctx }): boolean {
    let cond = ctx.getValue(node.getAttribute("t-if")!);
    ctx.addIf(typeof cond === "string" ? ctx.formatExpression(cond) : `scope.${cond.id!}`);
    return false;
  },
  finalize({ ctx }) {
    ctx.closeIf();
  },
});

QWeb.addDirective({
  name: "elif",
  priority: 30,
  atNodeEncounter({ node, ctx }): boolean {
    let cond = ctx.getValue(node.getAttribute("t-elif")!);
    ctx.addLine(
      `else if (${typeof cond === "string" ? ctx.formatExpression(cond) : `scope.${cond.id}`}) {`
    );
    ctx.indent();
    return false;
  },
  finalize({ ctx }) {
    ctx.closeIf();
  },
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
  },
});

//------------------------------------------------------------------------------
// t-call
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "call",
  priority: 50,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    // Step 1: sanity checks
    // ------------------------------------------------
    ctx.rootContext.shouldDefineScope = true;
    ctx.rootContext.shouldDefineUtils = true;
    const subTemplate = node.getAttribute("t-call")!;
    const isDynamic = INTERP_REGEXP.test(subTemplate);
    const nodeTemplate = qweb.templates[subTemplate];
    if (!isDynamic && !nodeTemplate) {
      throw new Error(`Cannot find template "${subTemplate}" (t-call)`);
    }

    // Step 2: compile target template in sub templates
    // ------------------------------------------------
    let subIdstr: string;
    if (isDynamic) {
      const _id = ctx.generateID();
      ctx.addLine(`let tname${_id} = ${ctx.interpolate(subTemplate)};`);
      ctx.addLine(`let tid${_id} = this.subTemplates[tname${_id}];`);
      ctx.addIf(`!tid${_id}`);
      ctx.addLine(`tid${_id} = this.constructor.nextId++;`);
      ctx.addLine(`this.subTemplates[tname${_id}] = tid${_id};`);
      ctx.addLine(
        `this.constructor.subTemplates[tid${_id}] = this._compile(tname${_id}, {hasParent: true, defineKey: true});`
      );
      ctx.closeIf();
      subIdstr = `tid${_id}`;
    } else {
      let subId = qweb.subTemplates[subTemplate];
      if (!subId) {
        subId = QWeb.nextId++;
        qweb.subTemplates[subTemplate] = subId;
        const subTemplateFn = qweb._compile(subTemplate, { hasParent: true, defineKey: true });
        QWeb.subTemplates[subId] = subTemplateFn;
      }
      subIdstr = `'${subId}'`;
    }

    // Step 3: compile t-call body if necessary
    // ------------------------------------------------
    let hasBody = node.hasChildNodes();
    const protectID = ctx.startProtectScope();
    if (hasBody) {
      // we add a sub scope to protect the ambient scope
      ctx.addLine(`{`);
      ctx.indent();
      const nodeCopy = node.cloneNode(true) as Element;
      for (let attr of ["t-if", "t-else", "t-elif", "t-call"]) {
        nodeCopy.removeAttribute(attr);
      }
      // this local scope is intended to trap c__0
      ctx.addLine(`{`);
      ctx.indent();
      ctx.addLine("let c__0 = [];");
      qweb._compileNode(nodeCopy, ctx.subContext("parentNode", "__0"));
      ctx.rootContext.shouldDefineUtils = true;
      ctx.addLine("scope[utils.zero] = c__0;");
      ctx.dedent();
      ctx.addLine(`}`);
    }

    // Step 4: add the appropriate function call to current component
    // ------------------------------------------------
    const parentComponent = `utils.getComponent(context)`;
    const key = ctx.generateTemplateKey();
    const parentNode = ctx.parentNode ? `c${ctx.parentNode}` : "result";
    const extra = `Object.assign({}, extra, {parentNode: ${parentNode}, parent: ${parentComponent}, key: ${key}})`;
    if (ctx.parentNode) {
      ctx.addLine(`this.constructor.subTemplates[${subIdstr}].call(this, scope, ${extra});`);
    } else {
      // this is a t-call with no parentnode, we need to extract the result
      ctx.rootContext.shouldDefineResult = true;
      ctx.addLine(`result = []`);
      ctx.addLine(`this.constructor.subTemplates[${subIdstr}].call(this, scope, ${extra});`);
      ctx.addLine(`result = result[0]`);
    }

    // Step 5: restore previous scope
    // ------------------------------------------------
    if (hasBody) {
      ctx.dedent();
      ctx.addLine(`}`);
    }
    ctx.stopProtectScope(protectID);

    return true;
  },
});

//------------------------------------------------------------------------------
// t-foreach
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "foreach",
  extraNames: ["as"],
  priority: 10,
  atNodeEncounter({ node, qweb, ctx }): boolean {
    ctx.rootContext.shouldDefineScope = true;
    ctx = ctx.subContext("loopNumber", ctx.loopNumber + 1);
    const elems = node.getAttribute("t-foreach")!;
    const name = node.getAttribute("t-as")!;
    let arrayID = ctx.generateID();
    ctx.addLine(`let _${arrayID} = ${ctx.formatExpression(elems)};`);
    ctx.addLine(`if (!_${arrayID}) { throw new Error('QWeb error: Invalid loop expression')}`);
    let keysID = ctx.generateID();
    let valuesID = ctx.generateID();
    ctx.addLine(`let _${keysID} = _${valuesID} = _${arrayID};`);
    ctx.addIf(`!(_${arrayID} instanceof Array)`);
    ctx.addLine(`_${keysID} = Object.keys(_${arrayID});`);
    ctx.addLine(`_${valuesID} = Object.values(_${arrayID});`);
    ctx.closeIf();
    ctx.addLine(`let _length${keysID} = _${keysID}.length;`);
    let varsID = ctx.startProtectScope(true);
    const loopVar = `i${ctx.loopNumber}`;
    ctx.addLine(`for (let ${loopVar} = 0; ${loopVar} < _length${keysID}; ${loopVar}++) {`);
    ctx.indent();

    ctx.addLine(`scope.${name}_first = ${loopVar} === 0`);
    ctx.addLine(`scope.${name}_last = ${loopVar} === _length${keysID} - 1`);
    ctx.addLine(`scope.${name}_index = ${loopVar}`);
    ctx.addLine(`scope.${name} = _${keysID}[${loopVar}]`);
    ctx.addLine(`scope.${name}_value = _${valuesID}[${loopVar}]`);
    const nodeCopy = <Element>node.cloneNode(true);
    let shouldWarn =
      !nodeCopy.hasAttribute("t-key") &&
      node.children.length === 1 &&
      node.children[0].tagName !== "t" &&
      !node.children[0].hasAttribute("t-key");
    if (shouldWarn) {
      console.warn(
        `Directive t-foreach should always be used with a t-key! (in template: '${ctx.templateName}')`
      );
    }
    if (nodeCopy.hasAttribute("t-key")) {
      const expr = ctx.formatExpression(nodeCopy.getAttribute("t-key")!);
      ctx.addLine(`let key${ctx.loopNumber} = ${expr};`);
      nodeCopy.removeAttribute("t-key");
    } else {
      ctx.addLine(`let key${ctx.loopNumber} = i${ctx.loopNumber};`);
    }

    nodeCopy.removeAttribute("t-foreach");
    qweb._compileNode(nodeCopy, ctx);
    ctx.dedent();
    ctx.addLine("}");
    ctx.stopProtectScope(varsID);
    return true;
  },
});

//------------------------------------------------------------------------------
// t-debug
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "debug",
  priority: 1,
  atNodeEncounter({ ctx }) {
    ctx.addLine("debugger;");
  },
});

//------------------------------------------------------------------------------
// t-log
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "log",
  priority: 1,
  atNodeEncounter({ ctx, value }) {
    const expr = ctx.formatExpression(value);
    ctx.addLine(`console.log(${expr})`);
  },
});
