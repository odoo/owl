import { VNode } from "../vdom/index";
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
  stop: "e.stopPropagation();"
};

QWeb.addDirective({
  name: "on",
  priority: 90,
  atNodeCreation({ ctx, fullName, value, nodeID }) {
    ctx.rootContext.shouldDefineOwner = true;
    const [eventName, ...mods] = fullName.slice(5).split(".");
    if (!eventName) {
      throw new Error("Missing event name with t-on directive");
    }
    let extraArgs;
    let handlerName = value.replace(/\(.*\)/, function(args) {
      extraArgs = args.slice(1, -1);
      return "";
    });
    let params = extraArgs ? `owner, ${ctx.formatExpression(extraArgs)}` : "owner";
    let handler = `function (e) {`;
    handler += mods
      .map(function(mod) {
        return MODS_CODE[mod];
      })
      .join("");
    if (handlerName) {
      if (!extraArgs) {
        handler += `const fn = context['${handlerName}'];`;
        handler += `if (fn) { fn.call(${params}, e); } else { context.${handlerName}; }`;
        handler += `}`;
        ctx.addLine(
          `extra.handlers['${eventName}' + ${nodeID}] = extra.handlers['${eventName}' + ${nodeID}] || ${handler};`
        );
        ctx.addLine(`p${nodeID}.on['${eventName}'] = extra.handlers['${eventName}' + ${nodeID}];`);
      } else {
        const handlerKey = `handler${ctx.generateID()}`;
        ctx.addLine(`const ${handlerKey} = context['${handlerName}'] && context['${handlerName}'].bind(${params});`);
        handler += `if (${handlerKey}) { ${handlerKey}(e); } else { context.${value}; }`;
        handler += `}`;
        ctx.addLine(`p${nodeID}.on['${eventName}'] = ${handler};`);
      }
    } else {
      handler += "}";
      ctx.addLine(`p${nodeID}.on['${eventName}'] = ${handler};`);
    }
  }
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
  }
});

//------------------------------------------------------------------------------
// t-transition
//------------------------------------------------------------------------------
QWeb.utils.nextFrame = function(cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

QWeb.utils.transitionInsert = function(vn: VNode, name: string) {
  const elm = <HTMLElement>vn.elm;
  // remove potential duplicated vnode that is currently being removed, to
  // prevent from having twice the same node in the DOM during an animation
  const dup = elm.parentElement && elm.parentElement!.querySelector(`*[data-owl-key='${vn.key}']`);
  if (dup) {
    dup.remove();
  }

  elm.classList.add(name + "-enter");
  elm.classList.add(name + "-enter-active");
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

QWeb.utils.transitionRemove = function(vn: VNode, name: string, rm: () => void) {
  const elm = <HTMLElement>vn.elm;
  elm.setAttribute("data-owl-key", vn.key!);

  elm.classList.add(name + "-leave");
  elm.classList.add(name + "-leave-active");
  const finalize = () => {
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
    ctx.rootContext.shouldDefineUtils = true;
    let name = value;
    const hooks = {
      insert: `utils.transitionInsert(vn, '${name}');`,
      remove: `utils.transitionRemove(vn, '${name}', rm);`
    };
    for (let hookName in hooks) {
      addNodeHook(hookName, hooks[hookName]);
    }
  }
});

//------------------------------------------------------------------------------
// t-slot
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "slot",
  priority: 80,
  atNodeEncounter({ ctx, value }): boolean {
    const slotKey = ctx.generateID();
    ctx.rootContext.shouldDefineOwner = true;
    ctx.addLine(
      `const slot${slotKey} = this.constructor.slots[context.__owl__.slotId + '_' + '${value}'];`
    );
    ctx.addIf(`slot${slotKey}`);
    let parentNode = `c${ctx.parentNode}`;
    if (!ctx.parentNode) {
      ctx.rootContext.shouldDefineResult = true;
      ctx.rootContext.shouldDefineUtils = true;
      parentNode = `children${ctx.nextID++}`;
      ctx.addLine(`let ${parentNode}= []`);
      ctx.addLine(`result = {}`);
    }
    ctx.addLine(
      `slot${slotKey}.call(this, context.__owl__.parent, Object.assign({}, extra, {parentNode: ${parentNode}, vars: extra.vars, parent: owner}));`
    );
    if (!ctx.parentNode) {
      ctx.addLine(`utils.defineProxy(result, ${parentNode}[0]);`);
    }
    ctx.closeIf();
    return true;
  }
});

//------------------------------------------------------------------------------
// t-model
//------------------------------------------------------------------------------
QWeb.utils.toNumber = function(val: string): number | string {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
};

QWeb.addDirective({
  name: "model",
  priority: 42,
  atNodeCreation({ ctx, nodeID, value, node, fullName, addNodeHook }) {
    const type = node.getAttribute("type");
    let handler;
    let event = fullName.includes(".lazy") ? "change" : "input";
    const expr = ctx.formatExpression(value);
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
    ctx.addLine(
      `extra.handlers['${event}' + ${nodeID}] = extra.handlers['${event}' + ${nodeID}] || (${handler});`
    );
    ctx.addLine(`p${nodeID}.on['${event}'] = extra.handlers['${event}' + ${nodeID}];`);
  }
});
