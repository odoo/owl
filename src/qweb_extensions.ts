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
  atNodeCreation({ ctx, nodeID, value }) {
    const refKey = `ref${ctx.generateID()}`;
    ctx.addLine(`const ${refKey} = ${ctx.formatExpression(value)}`);
    ctx.addLine(`p${nodeID}.hook = {
            create: (_, n) => context.refs[${refKey}] = n.elm,
        };`);
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
  atNodeCreation({ ctx, value }) {
    let name = value;
    ctx.addLine(`p${ctx.parentNode}.hook = {
        create: (_, n) => {
          this.utils.transitionCreate(n.elm, '${name}');
        },
        insert: vn => {
          this.utils.transitionInsert(vn.elm, '${name}');
        },
        remove: (vn, rm) => {
          this.utils.transitionRemove(vn.elm, '${name}', rm);
        }
      };`);
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
    ctx.addLine(
      `let w${widgetID} = ${templateID} in context.__owl__.cmap ? context.__owl__.children[context.__owl__.cmap[${templateID}]] : false;`
    );
    ctx.addLine(`let props${widgetID} = ${props || "{}"};`);
    ctx.addLine(`let isNew${widgetID} = !w${widgetID};`);

    // check if we can reuse current rendering promise
    ctx.addIf(`w${widgetID} && w${widgetID}.__owl__.renderPromise`);
    ctx.addIf(`w${widgetID}.__owl__.isStarted`);
    ctx.addLine(
      `def${defID} = w${widgetID}._updateProps(props${widgetID}, extra.forceUpdate, extra.patchQueue);`
    );
    ctx.addElse();
    ctx.addLine(`isNew${widgetID} = true`);
    ctx.addIf(`props${widgetID} === w${widgetID}.__owl__.renderProps`);
    ctx.addLine(`def${defID} = w${widgetID}.__owl__.renderPromise;`);
    ctx.addElse();
    ctx.addLine(`w${widgetID}.destroy();`);
    ctx.addLine(`w${widgetID} = false`);
    ctx.closeIf();
    ctx.closeIf();
    ctx.closeIf();

    ctx.addIf(`!def${defID}`);
    ctx.addIf(`w${widgetID}`);
    ctx.addLine(
      `def${defID} = w${widgetID}._updateProps(props${widgetID}, extra.forceUpdate, extra.patchQueue);`
    );
    ctx.addElse();
    ctx.addLine(
      `w${widgetID} = new context.widgets['${value}'](owner, props${widgetID});`
    );
    ctx.addLine(
      `context.__owl__.cmap[${templateID}] = w${widgetID}.__owl__.id;`
    );
    for (let [event, method] of events) {
      ctx.addLine(`w${widgetID}.on('${event}', owner, owner['${method}'])`);
    }
    ctx.addLine(`def${defID} = w${widgetID}._prepare();`);
    ctx.closeIf();
    ctx.closeIf();
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
    ctx.addIf(`isNew${widgetID}`);
    ctx.addLine(
      `def${defID} = def${defID}.then(vnode=>{${createHook}let pvnode=h(vnode.sel, {key: ${templateID}});c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;pvnode.data.hook = {insert(vn){let nvn=w${widgetID}._mount(vnode, vn.elm);pvnode.elm=nvn.elm;${refExpr}},remove(){${finalizeWidgetCode}},destroy(){${finalizeWidgetCode}}}; w${widgetID}.__owl__.pvnode = pvnode;});`
    );
    ctx.addElse();
    ctx.addLine(
      `def${defID} = def${defID}.then(()=>{if (w${widgetID}.__owl__.isDestroyed) {return};${
        tattStyle ? `w${widgetID}.el.style=${tattStyle};` : ""
      }${updateClassCode}let vnode;if (!w${widgetID}.__owl__.vnode){vnode=w${widgetID}.__owl__.pvnode} else { vnode=h(w${widgetID}.__owl__.vnode.sel, {key: ${templateID}});vnode.elm=w${widgetID}.el;vnode.data.hook = {insert(a){a.elm.parentNode.replaceChild(w${widgetID}.el,a.elm);a.elm=w${widgetID}.el;w${widgetID}.__mount();},remove(){${finalizeWidgetCode}}, destroy() {${finalizeWidgetCode}}}}c${
        ctx.parentNode
      }[_${dummyID}_index]=vnode;});`
    );
    ctx.closeIf();

    ctx.addLine(`extra.promises.push(def${defID});`);

    if (node.hasAttribute("t-if") || node.hasAttribute("t-else")) {
      ctx.closeIf();
    }

    return true;
  }
});
