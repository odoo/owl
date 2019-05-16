import { QWeb, UTILS } from "./qweb_core";

/**
 * Owl QWeb Extensions
 *
 * This file contains the implementation of non standard QWeb directives, added
 * by Owl and that will only work on Owl projects:
 *
 * - t-on
 * - t-ref
 * - t-transition
 * - t-widget/t-props/t-keepalive
 * - t-mounted
 */

//------------------------------------------------------------------------------
// t-on
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "on",
  priority: 90,
  atNodeCreation({ ctx, fullName, value, nodeID }) {
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
        `p${nodeID}.on['${eventName}'] = (context['${handler}'] || ${error}).bind(owner, ${ctx.formatExpression(
          extraArgs
        )});`
      );
    } else {
      ctx.addLine(
        `extra.handlers['${eventName}' + ${nodeID}] = extra.handlers['${eventName}' + ${nodeID}] || (context['${handler}'] || ${error}).bind(owner);`
      );
      ctx.addLine(
        `p${nodeID}.on['${eventName}'] = extra.handlers['${eventName}' + ${nodeID}];`
      );
    }
  }
});

//------------------------------------------------------------------------------
// t-ref
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "ref",
  priority: 95,
  atNodeCreation({ ctx, nodeID, value, addNodeHook }) {
    const refKey = `ref${ctx.generateID()}`;
    ctx.addLine(`const ${refKey} = ${ctx.formatExpression(value)}`);
    addNodeHook("create", `context.refs[${refKey}] = n.elm;`);
  }
});

//------------------------------------------------------------------------------
// t-transition
//------------------------------------------------------------------------------
(<any>UTILS).nextFrame = function(cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

(<any>UTILS).transitionCreate = function(elm: HTMLElement, name: string) {
  elm.classList.add(name + "-enter");
  elm.classList.add(name + "-enter-active");
};

(<any>UTILS).transitionInsert = function(elm: HTMLElement, name: string) {
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

(<any>UTILS).transitionRemove = function(
  elm: HTMLElement,
  name: string,
  rm: () => void
) {
  elm.classList.add(name + "-leave");
  elm.classList.add(name + "-leave-active");
  const finalize = () => {
    elm.classList.remove(name + "-leave-active");
    elm.classList.remove(name + "-enter-to");
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
  const durations: Array<string> = (styles.transitionDuration || "").split(
    ", "
  );
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
    let name = value;
    const hooks = {
      create: `this.utils.transitionCreate(n.elm, '${name}');`,
      insert: `this.utils.transitionInsert(vn.elm, '${name}');`,
      remove: `this.utils.transitionRemove(vn.elm, '${name}', rm);`
    };
    for (let hookName in hooks) {
      addNodeHook(hookName, hooks[hookName]);
    }
  }
});

//------------------------------------------------------------------------------
// t-widget
//------------------------------------------------------------------------------
QWeb.addDirective({
  name: "widget",
  extraNames: ["props", "keepalive"],
  priority: 100,
  atNodeEncounter({ ctx, value, node }): boolean {
    ctx.addLine("//WIDGET");
    ctx.rootContext.shouldDefineOwner = true;
    let props = node.getAttribute("t-props");
    let keepAlive = node.getAttribute("t-keepalive") ? true : false;

    // t-on- events...
    const events: [string, string][] = [];
    const attributes = (<Element>node).attributes;
    for (let i = 0; i < attributes.length; i++) {
      const name = attributes[i].name;
      if (name.startsWith("t-on-")) {
        events.push([name.slice(5), attributes[i].textContent!]);
      }
    }

    let key = node.getAttribute("t-key");
    if (key) {
      key = ctx.formatExpression(key);
    }
    if (props) {
      props = ctx.formatExpression(props);
    }
    let dummyID = ctx.generateID();
    let defID = ctx.generateID();
    let widgetID = ctx.generateID();
    let keyID = key && ctx.generateID();
    if (key) {
      // we bind a variable to the key (could be a complex expression, so we
      // want to evaluate it only once)
      ctx.addLine(`let key${keyID} = ${key};`);
    }
    ctx.addLine(`let _${dummyID}_index = c${ctx.parentNode}.length;`);
    ctx.addLine(`c${ctx.parentNode}.push(null);`);
    ctx.addLine(`let def${defID};`);
    let templateID = key
      ? `key${keyID}`
      : ctx.inLoop
      ? `String(-${widgetID} - i)`
      : String(widgetID);

    let ref = node.getAttribute("t-ref");
    let refExpr = "";
    let refKey: string = "";
    if (ref) {
      refKey = `ref${ctx.generateID()}`;
      ctx.addLine(`const ${refKey} = ${ctx.formatExpression(ref)}`);
      refExpr = `context.refs[${refKey}] = w${widgetID};`;
    }

    let finalizeWidgetCode = `w${widgetID}.${
      keepAlive ? "unmount" : "destroy"
    }()`;
    if (ref) {
      finalizeWidgetCode += `;delete context.refs[${refKey}]`;
    }
    let createHook = "";
    let classAttr = node.getAttribute("class");
    let tattClass = node.getAttribute("t-att-class");
    let styleAttr = node.getAttribute("style");
    let tattStyle = node.getAttribute("t-att-style");
    if (tattStyle) {
      const attVar = `_${ctx.generateID()}`;
      ctx.addLine(`const ${attVar} = ${ctx.formatExpression(tattStyle)};`);
      tattStyle = attVar;
    }
    let updateClassCode = "";
    if (classAttr || tattClass || styleAttr || tattStyle) {
      let classCode = "";
      if (classAttr) {
        classCode =
          classAttr
            .split(" ")
            .map(c => `vn.elm.classList.add('${c}')`)
            .join(";") + ";";
      }
      if (tattClass) {
        const attVar = `_${ctx.generateID()}`;
        ctx.addLine(`const ${attVar} = ${ctx.formatExpression(tattClass)};`);
        classCode = `for (let k in ${attVar}) {
              if (${attVar}[k]) {
                  vn.elm.classList.add(k);
              }
          }`;
        updateClassCode = `let cl=w${widgetID}.el.classList;for (let k in ${attVar}) {if (${attVar}[k]) {cl.add(k)} else {cl.remove(k)}}`;
      }
      const styleExpr = tattStyle || (styleAttr ? `'${styleAttr}'` : false);
      const styleCode = styleExpr ? `vn.elm.style = ${styleExpr}` : "";
      createHook = `vnode.data.hook = {create(_, vn){${classCode}${styleCode}}};`;
    }


    ctx.addLine(
      `let w${widgetID} = ${templateID} in context.__owl__.cmap ? context.__owl__.children[context.__owl__.cmap[${templateID}]] : false;`
    );
    ctx.addLine(`let props${widgetID} = ${props || "{}"};`);
    ctx.addLine(`let sameProps${widgetID} = w${widgetID} && props${widgetID} === w${widgetID}.__owl__.renderProps`);
    ctx.addIf(`w${widgetID} && w${widgetID}.__owl__.renderPromise && !w${widgetID}.__owl__.isStarted && !sameProps${widgetID}`);
    ctx.addLine(`w${widgetID}.destroy();`);
    ctx.addLine(`w${widgetID} = false`);
    ctx.closeIf();


    ctx.addLine(`let isNew${widgetID} = !w${widgetID};`);
    ctx.addIf(`isNew${widgetID}`);
    // new widget
    ctx.addLine(`let W${widgetID} = context.widgets['${value}'];`);

    // maybe only do this in dev mode...
    ctx.addLine(`if (!W${widgetID}) {throw new Error(\`Cannot find the definition of widget "${value}"\`)}`);
    ctx.addLine(`w${widgetID} = new W${widgetID}(owner, props${widgetID});`);
    ctx.addLine(
      `context.__owl__.cmap[${templateID}] = w${widgetID}.__owl__.id;`
    );
    for (let [event, method] of events) {
      ctx.addLine(`w${widgetID}.on('${event}', owner, owner['${method}'])`);
    }
    ctx.addLine(`def${defID} = w${widgetID}._prepare();`);
    ctx.addLine(
      `def${defID} = def${defID}.then(vnode=>{${createHook}let pvnode=h(vnode.sel, {key: ${templateID}});c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;pvnode.data.hook = {insert(vn){let nvn=w${widgetID}._mount(vnode, vn.elm);pvnode.elm=nvn.elm;${refExpr}},remove(){${finalizeWidgetCode}},destroy(){${finalizeWidgetCode}}}; w${widgetID}.__owl__.pvnode = pvnode;});`
    );

    ctx.addElse();
    // need to update widget
    ctx.addIf(`w${widgetID}.__owl__.renderPromise && sameProps${widgetID}`);
    ctx.addLine(`def${defID} = w${widgetID}.__owl__.renderPromise;`);
    ctx.addElse();
    ctx.addLine(
      `def${defID} = w${widgetID}._updateProps(props${widgetID}, extra.forceUpdate, extra.patchQueue);`
    );
    ctx.closeIf()
    ctx.addLine(
      `def${defID} = def${defID}.then(()=>{if (w${widgetID}.__owl__.isDestroyed) {return};${
        tattStyle ? `w${widgetID}.el.style=${tattStyle};` : ""
      }${updateClassCode}let pvnode=h(w${widgetID}.__owl__.pvnode.sel, {key: ${templateID}});pvnode.elm=w${widgetID}.el;pvnode.data.hook = {insert(a){a.elm.parentNode.replaceChild(w${widgetID}.el,a.elm);a.elm=w${widgetID}.el;w${widgetID}.__mount();},remove(){${finalizeWidgetCode}}, destroy() {${finalizeWidgetCode}}};c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;});`
    );

    ctx.closeIf()

    ctx.addLine(`extra.promises.push(def${defID});`);

    if (
      node.hasAttribute("t-if") ||
      node.hasAttribute("t-else") ||
      node.hasAttribute("t-elif")
    ) {
      ctx.closeIf();
    }

    return true;
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
    addNodeHook(
      "insert",
      `if (context.__owl__.isMounted) { extra.mountedHandlers[${nodeID}](); }`
    );
  }
});
