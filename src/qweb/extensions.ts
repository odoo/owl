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
    ctx.addIf(`!context['${handlerName}']`);
    ctx.addLine(
      `throw new Error('Missing handler \\'' + '${handlerName}' + \`\\' when evaluating template '${ctx.templateName.replace(
        /`/g,
        "'"
      )}'\`)`
    );
    ctx.closeIf();
    let params = extraArgs ? `owner, ${ctx.formatExpression(extraArgs)}` : "owner";
    let handler;
    if (mods.length > 0) {
      handler = `function (e) {`;
      handler += mods
        .map(function(mod) {
          return MODS_CODE[mod];
        })
        .join("");
      handler += `context['${handlerName}'].call(${params}, e);}`;
    } else {
      handler = `context['${handlerName}'].bind(${params})`;
    }
    if (extraArgs) {
      ctx.addLine(`p${nodeID}.on['${eventName}'] = ${handler};`);
    } else {
      ctx.addLine(
        `extra.handlers['${eventName}' + ${nodeID}] = extra.handlers['${eventName}' + ${nodeID}] || ${handler};`
      );
      ctx.addLine(`p${nodeID}.on['${eventName}'] = extra.handlers['${eventName}' + ${nodeID}];`);
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
    const refKey = `ref${ctx.generateID()}`;
    ctx.addLine(`const ${refKey} = ${ctx.interpolate(value)};`);
    addNodeHook("create", `context.refs[${refKey}] = n.elm;`);
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
// t-mounted
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "mounted",
  priority: 97,
  atNodeCreation({ ctx, fullName, value, nodeID, addNodeHook }) {
    ctx.rootContext.shouldDefineOwner = true;
    const eventName = fullName.slice(5);
    if (!eventName) {
      throw new Error("Missing event name with t-on directive");
    }
    let extraArgs;
    let handler = value.replace(/\(.*\)/, function(args) {
      extraArgs = args.slice(1, -1);
      return "";
    });
    let error = `(function () {throw new Error('Missing handler \\'' + '${handler}' + \`\\' when evaluating template '${ctx.templateName.replace(
      /`/g,
      "'"
    )}'\`)})()`;
    if (extraArgs) {
      ctx.addLine(
        `extra.mountedHandlers[${nodeID}] = (context['${handler}'] || ${error}).bind(owner, ${ctx.formatExpression(
          extraArgs
        )});`
      );
    } else {
      ctx.addLine(
        `extra.mountedHandlers[${nodeID}] = extra.mountedHandlers[${nodeID}] || (context['${handler}'] || ${error}).bind(owner);`
      );
    }
    addNodeHook("insert", `if (context.__owl__.isMounted) { extra.mountedHandlers[${nodeID}](); }`);
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
    ctx.addLine(`const slot${slotKey} = this.slots[context.__owl__.slotId + '_' + '${value}'];`);
    ctx.addIf(`slot${slotKey}`);
    ctx.addLine(
      `slot${slotKey}(context.__owl__.parent, Object.assign({}, extra, {parentNode: c${ctx.parentNode}, vars: extra.vars, parent: owner}));`
    );
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
  atNodeCreation({ ctx, nodeID, value, node, fullName }) {
    const type = node.getAttribute("type");
    let handler;
    let event = fullName.includes(".lazy") ? "change" : "input";
    if (node.tagName === "select") {
      ctx.addLine(`p${nodeID}.props = {value: context.state['${value}']};`);
      event = "change";
      handler = `(ev) => {context.state['${value}'] = ev.target.value}`;
    } else if (type === "checkbox") {
      ctx.addLine(`p${nodeID}.props = {checked: context.state['${value}']};`);
      handler = `(ev) => {context.state['${value}'] = ev.target.checked}`;
    } else if (type === "radio") {
      const nodeValue = node.getAttribute("value")!;
      ctx.addLine(`p${nodeID}.props = {checked:context.state['${value}'] === '${nodeValue}'};`);
      handler = `(ev) => {context.state['${value}'] = ev.target.value}`;
      event = "click";
    } else {
      ctx.addLine(`p${nodeID}.props = {value: context.state['${value}']};`);
      const trimCode = fullName.includes(".trim") ? ".trim()" : "";
      let valueCode = `ev.target.value${trimCode}`;
      if (fullName.includes(".number")) {
        ctx.rootContext.shouldDefineUtils = true;
        valueCode = `utils.toNumber(${valueCode})`;
      }
      handler = `(ev) => {context.state['${value}'] = ${valueCode}}`;
    }
    ctx.addLine(
      `extra.handlers['${event}' + ${nodeID}] = extra.handlers['${event}' + ${nodeID}] || (${handler});`
    );
    ctx.addLine(`p${nodeID}.on['${event}'] = extra.handlers['${event}' + ${nodeID}];`);
  }
});
