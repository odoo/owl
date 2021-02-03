import { STATUS } from "../component/component";
import { VNode } from "../vdom/index";
import { INTERP_REGEXP } from "./compilation_context";
import { QWeb } from "./qweb";

/**
 * Owl QWeb Extensions
 *
 * This file contains the implementation of non standard QWeb directives, added
 * by Owl and that will only work on Owl projects:
 *
 * - t-on
 * - t-ref
 * - t-transition
 * - t-mounted
 * - t-slot
 * - t-model
 */

//------------------------------------------------------------------------------
// t-on
//------------------------------------------------------------------------------
// these are pieces of code that will be injected into the event handler if
// modifiers are specified
export const MODS_CODE = {
  prevent: "e.preventDefault();",
  self: "if (e.target !== this.elm) {return}",
  stop: "e.stopPropagation();",
};

interface HandlerInfo {
  event: string;
  handler: string;
}

const FNAMEREGEXP = /^[$A-Z_][0-9A-Z_$]*$/i;

export function makeHandlerCode(
  ctx,
  fullName,
  value,
  putInCache: boolean,
  modcodes = MODS_CODE
): HandlerInfo {
  let [event, ...mods] = fullName.slice(5).split(".");
  if (mods.includes("capture")) {
    event = "!" + event;
  }
  if (!event) {
    throw new Error("Missing event name with t-on directive");
  }
  let code: string;
  // check if it is a method with no args, a method with args or an expression
  let args: string = "";
  const name: string = value.replace(/\(.*\)/, function (_args) {
    args = _args.slice(1, -1);
    return "";
  });
  const isMethodCall = name.match(FNAMEREGEXP);

  // then generate code
  if (isMethodCall) {
    ctx.rootContext.shouldDefineUtils = true;
    const comp = `utils.getComponent(context)`;
    if (args) {
      const argId = ctx.generateID();
      ctx.addLine(`let args${argId} = [${ctx.formatExpression(args)}];`);
      code = `${comp}['${name}'](...args${argId}, e);`;
      putInCache = false;
    } else {
      code = `${comp}['${name}'](e);`;
    }
  } else {
    // if we get here, then it is an expression
    // we need to capture every variable in it
    putInCache = false;
    code = ctx.captureExpression(value);
  }
  const modCode = mods.map((mod) => modcodes[mod]).join("");
  let handler = `function (e) {if (context.__owl__.status === ${STATUS.DESTROYED}){return}${modCode}${code}}`;
  if (putInCache) {
    const key = ctx.generateTemplateKey(event);
    ctx.addLine(`extra.handlers[${key}] = extra.handlers[${key}] || ${handler};`);
    handler = `extra.handlers[${key}]`;
  }
  return { event, handler };
}

QWeb.addDirective({
  name: "on",
  priority: 90,
  atNodeCreation({ ctx, fullName, value, nodeID }) {
    const { event, handler } = makeHandlerCode(ctx, fullName, value, true);
    ctx.addLine(`p${nodeID}.on['${event}'] = ${handler};`);
  },
});

//------------------------------------------------------------------------------
// t-ref
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "ref",
  priority: 95,
  atNodeCreation({ ctx, value, addNodeHook }) {
    ctx.rootContext.shouldDefineRefs = true;
    const refKey = `ref${ctx.generateID()}`;
    ctx.addLine(`const ${refKey} = ${ctx.interpolate(value)};`);
    addNodeHook("create", `context.__owl__.refs[${refKey}] = n.elm;`);
    addNodeHook("destroy", `delete context.__owl__.refs[${refKey}];`);
  },
});

//------------------------------------------------------------------------------
// t-transition
//------------------------------------------------------------------------------
QWeb.utils.nextFrame = function (cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

QWeb.utils.transitionInsert = function (vn: VNode, name: string) {
  const elm = <HTMLElement>vn.elm;
  // remove potential duplicated vnode that is currently being removed, to
  // prevent from having twice the same node in the DOM during an animation
  const dup = elm.parentElement && elm.parentElement!.querySelector(`*[data-owl-key='${vn.key}']`);
  if (dup) {
    dup.remove();
  }

  elm.classList.add(name + "-enter");
  elm.classList.add(name + "-enter-active");
  elm.classList.remove(name + "-leave-active");
  elm.classList.remove(name + "-leave-to");
  const finalize = () => {
    elm.classList.remove(name + "-enter-active");
    elm.classList.remove(name + "-enter-to");
  };
  this.nextFrame(() => {
    elm.classList.remove(name + "-enter");
    elm.classList.add(name + "-enter-to");
    whenTransitionEnd(elm, finalize);
  });
};

QWeb.utils.transitionRemove = function (vn: VNode, name: string, rm: () => void) {
  const elm = <HTMLElement>vn.elm;
  elm.setAttribute("data-owl-key", vn.key!);

  elm.classList.add(name + "-leave");
  elm.classList.add(name + "-leave-active");
  const finalize = () => {
    if (!elm.classList.contains(name + "-leave-active")) {
      return;
    }
    elm.classList.remove(name + "-leave-active");
    elm.classList.remove(name + "-leave-to");
    rm();
  };
  this.nextFrame(() => {
    elm.classList.remove(name + "-leave");
    elm.classList.add(name + "-leave-to");
    whenTransitionEnd(elm, finalize);
  });
};

function getTimeout(delays: Array<string>, durations: Array<string>): number {
  /* istanbul ignore next */
  while (delays.length < durations.length) {
    delays = delays.concat(delays);
  }

  return Math.max.apply(
    null,
    durations.map((d, i) => {
      return toMs(d) + toMs(delays[i]);
    })
  );
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer numbers
// in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down (i.e. acting
// as a floor function) causing unexpected behaviors
function toMs(s: string): number {
  return Number(s.slice(0, -1).replace(",", ".")) * 1000;
}

function whenTransitionEnd(elm: HTMLElement, cb) {
  if (!elm.parentNode) {
    // if we get here, this means that the element was removed for some other
    // reasons, and in that case, we don't want to work on animation since nothing
    // will be displayed anyway.
    return;
  }

  const styles = window.getComputedStyle(elm);
  const delays: Array<string> = (styles.transitionDelay || "").split(", ");
  const durations: Array<string> = (styles.transitionDuration || "").split(", ");
  const timeout: number = getTimeout(delays, durations);
  if (timeout > 0) {
    elm.addEventListener("transitionend", cb, { once: true });
  } else {
    cb();
  }
}

QWeb.addDirective({
  name: "transition",
  priority: 96,
  atNodeCreation({ ctx, value, addNodeHook }) {
    if (!QWeb.enableTransitions) {
      return;
    }
    ctx.rootContext.shouldDefineUtils = true;
    let name = value;
    const hooks = {
      insert: `utils.transitionInsert(vn, '${name}');`,
      remove: `utils.transitionRemove(vn, '${name}', rm);`,
    };
    for (let hookName in hooks) {
      addNodeHook(hookName, hooks[hookName]);
    }
  },
});

//------------------------------------------------------------------------------
// t-slot
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "slot",
  priority: 80,
  atNodeEncounter({ ctx, value, node, qweb }): boolean {
    const slotKey = ctx.generateID();
    const valueExpr = value.match(INTERP_REGEXP) ? ctx.interpolate(value) : `'${value}'`;
    ctx.addLine(
      `const slot${slotKey} = this.constructor.slots[context.__owl__.slotId + '_' + ${valueExpr}];`
    );
    ctx.addIf(`slot${slotKey}`);
    let parentNode = `c${ctx.parentNode}`;
    if (!ctx.parentNode) {
      ctx.rootContext.shouldDefineResult = true;
      ctx.rootContext.shouldDefineUtils = true;
      parentNode = `children${ctx.generateID()}`;
      ctx.addLine(`let ${parentNode}= []`);
      ctx.addLine(`result = {}`);
    }
    ctx.addLine(
      `slot${slotKey}.call(this, context.__owl__.scope, Object.assign({}, extra, {parentNode: ${parentNode}, parent: extra.parent || context}));`
    );
    if (!ctx.parentNode) {
      ctx.addLine(`utils.defineProxy(result, ${parentNode}[0]);`);
    }
    if (node.hasChildNodes()) {
      ctx.addElse();
      const nodeCopy = <Element>node.cloneNode(true);
      nodeCopy.removeAttribute("t-slot");
      qweb._compileNode(nodeCopy, ctx);
    }
    ctx.closeIf();
    return true;
  },
});

//------------------------------------------------------------------------------
// t-model
//------------------------------------------------------------------------------
QWeb.utils.toNumber = function (val: string): number | string {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
};

const hasDotAtTheEnd = /\.[\w_]+\s*$/;
const hasBracketsAtTheEnd = /\[[^\[]+\]\s*$/;

QWeb.addDirective({
  name: "model",
  priority: 42,
  atNodeCreation({ ctx, nodeID, value, node, fullName, addNodeHook }) {
    const type = node.getAttribute("type");
    let handler;
    let event = fullName.includes(".lazy") ? "change" : "input";

    // First step: we need to understand the structure of the expression, and
    // from it, extract a base expression (that we can capture, which is
    // important because it will be used in a handler later) and a formatted
    // expression (which uses the captured base expression)
    //
    // Also, we support 2 kinds of values: some.expr.value or some.expr[value]
    // For the first one, we have:
    // - base expression = scope[some].expr
    // - expression = exprX.value (where exprX is the var that captures the base expr)
    // and for the expression with brackets:
    // - base expression = scope[some].expr
    // - expression = exprX[keyX] (where exprX is the var that captures the base expr
    //        and keyX captures scope[value])
    let expr: string;
    let baseExpr: string;

    if (hasDotAtTheEnd.test(value)) {
      // we manage the case where the expr has a dot: some.expr.value
      const index = value.lastIndexOf(".");
      baseExpr = value.slice(0, index);
      ctx.addLine(`let expr${nodeID} = ${ctx.formatExpression(baseExpr)};`);
      expr = `expr${nodeID}${value.slice(index)}`;
    } else if (hasBracketsAtTheEnd.test(value)) {
      // we manage here the case where the expr ends in a bracket expression:
      //    some.expr[value]
      const index = value.lastIndexOf("[");
      baseExpr = value.slice(0, index);
      ctx.addLine(`let expr${nodeID} = ${ctx.formatExpression(baseExpr)};`);
      let exprKey = value.trimRight().slice(index + 1, -1);
      ctx.addLine(`let exprKey${nodeID} = ${ctx.formatExpression(exprKey)};`);
      expr = `expr${nodeID}[exprKey${nodeID}]`;
    } else {
      throw new Error(`Invalid t-model expression: "${value}" (it should be assignable)`);
    }

    const key = ctx.generateTemplateKey();
    if (node.tagName === "select") {
      ctx.addLine(`p${nodeID}.props = {value: ${expr}};`);
      addNodeHook("create", `n.elm.value=${expr};`);
      event = "change";
      handler = `(ev) => {${expr} = ev.target.value}`;
    } else if (type === "checkbox") {
      ctx.addLine(`p${nodeID}.props = {checked: ${expr}};`);
      handler = `(ev) => {${expr} = ev.target.checked}`;
    } else if (type === "radio") {
      const nodeValue = node.getAttribute("value")!;
      ctx.addLine(`p${nodeID}.props = {checked:${expr} === '${nodeValue}'};`);
      handler = `(ev) => {${expr} = ev.target.value}`;
      event = "click";
    } else {
      ctx.addLine(`p${nodeID}.props = {value: ${expr}};`);
      const trimCode = fullName.includes(".trim") ? ".trim()" : "";
      let valueCode = `ev.target.value${trimCode}`;
      if (fullName.includes(".number")) {
        ctx.rootContext.shouldDefineUtils = true;
        valueCode = `utils.toNumber(${valueCode})`;
      }
      handler = `(ev) => {${expr} = ${valueCode}}`;
    }
    ctx.addLine(`extra.handlers[${key}] = extra.handlers[${key}] || (${handler});`);
    ctx.addLine(`p${nodeID}.on['${event}'] = extra.handlers[${key}];`);
  },
});

//------------------------------------------------------------------------------
// t-key
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "key",
  priority: 45,
  atNodeEncounter({ ctx, value, node }) {
    if (ctx.loopNumber === 0) {
      ctx.keyStack.push(ctx.rootContext.hasKey0);
      ctx.rootContext.hasKey0 = true;
    }
    ctx.addLine("{");
    ctx.indent();
    ctx.addLine(`let key${ctx.loopNumber} = ${ctx.formatExpression(value)};`);
  },
  finalize({ ctx }) {
    ctx.dedent();
    ctx.addLine("}");
    if (ctx.loopNumber === 0) {
      ctx.rootContext.hasKey0 = ctx.keyStack.pop() as boolean;
    }
  },
});
