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
// these are pieces of code that will be injected into the event handler if
// modifiers are specified
const MODS_CODE = {
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
    let params = extraArgs
      ? `owner, ${ctx.formatExpression(extraArgs)}`
      : "owner";
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
  atNodeCreation({ ctx, value, addNodeHook }) {
    const refKey = `ref${ctx.generateID()}`;
    ctx.addLine(`const ${refKey} = ${ctx.interpolate(value)};`);
    addNodeHook("create", `context.refs[${refKey}] = n.elm;`);
  }
});

//------------------------------------------------------------------------------
// t-transition
//------------------------------------------------------------------------------
UTILS.nextFrame = function(cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

UTILS.transitionInsert = function(elm: HTMLElement, name: string) {
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

UTILS.transitionRemove = function(
  elm: HTMLElement,
  name: string,
  rm: () => void
) {
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
  atNodeCreation({ value, addNodeHook }) {
    let name = value;
    const hooks = {
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

/**
 * The t-widget directive is certainly a complicated and hard to maintain piece
 * of code.  To help you, fellow developer, if you have to maintain it, I offer
 * you this advice: Good luck...
 *
 * Since it is not 'direct' code, but rather code that generates other code, it
 * is not easy to understand.  To help you, here  is a detailed and commented
 * explanation of the code generated by the t-widget directive for the following
 * situation:
 * ```xml
 *   <t t-widget="child"
 *      t-key="'somestring'"
 *      t-props="{flag:state.flag}"
 *      t-transition="fade"/>
 * ```
 *
 * ```js
 * // this is the virtual node representing the parent div
 * let c1 = [], p1 = { key: 1 };
 * var vn1 = h("div", p1, c1);
 *
 * // t-widget directive: we start by evaluating the expression given by t-key:
 * let key5 = "somestring";
 *
 * // We keep the index of the position of the widget in the closure.  We push
 * // null to reserve the slot, and will replace it later by the widget vnode,
 * // when it will be ready (do not forget that preparing/rendering a widget is
 * // asynchronous)
 * let _2_index = c1.length;
 * c1.push(null);
 *
 * // def3 is the deferred that will contain later either the new widget
 * // creation, or the props update...
 * let def3;
 *
 * // this is kind of tricky: we need here to find if the widget was already
 * // created by a previous rendering.  This is done by checking the internal
 * // `cmap` (children map) of the parent widget: it maps keys to widget ids,
 * // and, then, if there is an id, we look into the children list to get the
 * // instance
 * let w4 =
 *   key5 in context.__owl__.cmap
 *   ? context.__owl__.children[context.__owl__.cmap[key5]]
 *   : false;
 *
 * // we evaluate here the props given to the component. It is done here to be
 * // able to easily reference it later, and also, it might be an expensive
 * // computation, so it is certainly better to do it only once
 * let props4 = { flag: context["state"].flag };
 *
 * // If we have a widget, currently rendering, but not ready yet, and which was
 * // rendered with different props, we do not want to wait for it to be ready,
 * // then update it. We simply destroy it, and start anew.
 * if (
 *   w4 &&
 *   w4.__owl__.renderPromise &&
 *   !w4.__owl__.isStarted &&
 *   props4 !== w4.__owl__.renderProps
 * ) {
 *   w4.destroy();
 *   w4 = false;
 * }
 *
 * if (!w4) {
 *   // in this situation, we need to create a new widget.  First step is
 *   // to get a reference to the class, then create an instance with
 *   // current context as parent, and the props.
 *   let W4 = context.widgets["child"];
 *   if (!W4) {
 *     throw new Error("Cannot find the definition of widget 'child'");
 *   }
 *   w4 = new W4(owner, props4);
 *
 *   let utils = this.utils;
 *
 *   // Whenever we rerender the parent widget, we need to be sure that we
 *   // are able to find the widget instance. To do that, we register it to
 *   // the parent cmap (children map).  Note that the 'template' key is
 *   // used here, since this is what identify the widget from the template
 *   // perspective.
 *   context.__owl__.cmap[key5] = w4.__owl__.id;
 *
 *   // _prepare is called, to basically call willStart, then render the
 *   // widget
 *   def3 = w4._prepare();
 *
 *   def3 = def3.then(vnode => {
 *     // we create here a virtual node for the parent (NOT the widget). This
 *     // means that the vdom of the parent will be stopped here, and from
 *     // the parent's perspective, it simply is a vnode with no children.
 *     // However, it shares the same dom element with the component root
 *     // vnode.
 *     let pvnode = h(vnode.sel, { key: key5 });
 *
 *     // we add hooks to the parent vnode so we can interact with the new
 *     // widget at the proper time
 *     pvnode.data.hook = {
 *       insert(vn) {
 *         // the _mount method will patch the widget vdom into the elm vn.elm,
 *         // then call the mounted hooks. However, suprisingly, the snabbdom
 *         // patch method actually replace the elm by a new elm, so we need
 *         // to synchronise the pvnode elm with the resulting elm
 *         let nvn = w4._mount(vnode, vn.elm);
 *         pvnode.elm = nvn.elm;
 *         // what follows is only present if there are animations on the widget
 *         utils.transitionInsert(vn.elm, "fade");
 *       },
 *       remove() {
 *         // override with empty function to prevent from removing the node
 *         // directly. It will be removed when destroy is called anyway, which
 *         // delays the removal if there are animations.
 *       },
 *       destroy() {
 *         // if there are animations, we delay the call to destroy on the
 *         // widget, if not, we call it directly.
 *         let finalize = () => {
 *           w4.destroy();
 *         };
 *         utils.transitionRemove(vn.elm, "fade", finalize);
 *       }
 *     };
 *     // the pvnode is inserted at the correct position in the div's children
 *     c1[_2_index] = pvnode;
 *
 *     // we keep here a reference to the parent vnode (representing the
 *     // widget, so we can reuse it later whenever we update the widget
 *     w4.__owl__.pvnode = pvnode;
 *   });
 * } else {
 *   // this is the 'update' path of the directive.
 *   // the call to _updateProps is the actual widget update
 *   def3 = w4._updateProps(props4, extra.forceUpdate, extra.patchQueue);
 *   def3 = def3.then(() => {
 *     // if widget was destroyed in the meantime, we do nothing (so, this
 *     // means that the parent's element children list will have a null in
 *     // the widget's position, which will cause the pvnode to be removed
 *     // when it is patched.
 *     if (w4.__owl__.isDestroyed) {
 *       return;
 *     }
 *     // like above, we register the pvnode to the children list, so it
 *     // will not be patched out of the dom.
 *     let pvnode = w4.__owl__.pvnode;
 *     c1[_2_index] = pvnode;
 *   });
 * }
 *
 * // we register the deferred here so the parent can coordinate its patch operation
 * // with all the children.
 * extra.promises.push(def3);
 * return vn1;
 * ```
 */

QWeb.addDirective({
  name: "widget",
  extraNames: ["props", "keepalive"],
  priority: 100,
  atNodeEncounter({ ctx, value, node }): boolean {
    ctx.addLine("//WIDGET");
    ctx.rootContext.shouldDefineOwner = true;
    ctx.rootContext.shouldDefineQWeb = true;
    ctx.rootContext.shouldDefineUtils = true;
    let props = node.getAttribute("t-props");
    let keepAlive = node.getAttribute("t-keepalive") ? true : false;

    // t-on- events and t-transition
    const events: [string, string][] = [];
    let transition: string = "";
    const attributes = (<Element>node).attributes;
    for (let i = 0; i < attributes.length; i++) {
      const name = attributes[i].name;
      if (name.startsWith("t-on-")) {
        events.push([name.slice(5), attributes[i].textContent!]);
      } else if (name === "t-transition") {
        transition = attributes[i].textContent!;
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
      ctx.addLine(`const ${refKey} = ${ctx.interpolate(ref)};`);
      refExpr = `context.refs[${refKey}] = w${widgetID};`;
    }
    let transitionsInsertCode = "";
    if (transition) {
      transitionsInsertCode = `utils.transitionInsert(vn.elm, '${transition}');`;
    }
    let finalizeWidgetCode = `w${widgetID}.${
      keepAlive ? "unmount" : "destroy"
    }();`;
    if (ref) {
      finalizeWidgetCode += `delete context.refs[${refKey}];`; // FIXME: shouldn't we keep ref if keepAlive is true?
    }
    if (transition) {
      finalizeWidgetCode = `let finalize = () => {
          ${finalizeWidgetCode}
        };
        utils.transitionRemove(vn.elm, '${transition}', finalize);`;
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
    ctx.addIf(
      `w${widgetID} && w${widgetID}.__owl__.renderPromise && !w${widgetID}.__owl__.vnode && props${widgetID} !== w${widgetID}.__owl__.renderProps`
    );
    ctx.addLine(`w${widgetID}.destroy();`);
    ctx.addLine(`w${widgetID} = false`);
    ctx.closeIf();

    ctx.addIf(`!w${widgetID}`);
    // new widget
    ctx.addLine(`let widgetKey${widgetID} = ${ctx.interpolate(value)};`);
    ctx.addLine(
      `let W${widgetID} = context.widgets && context.widgets[widgetKey${widgetID}] || QWeb.widgets[widgetKey${widgetID}];`
    );

    // maybe only do this in dev mode...
    ctx.addLine(
      `if (!W${widgetID}) {throw new Error('Cannot find the definition of widget "' + widgetKey${widgetID} + '"')}`
    );
    ctx.addLine(`w${widgetID} = new W${widgetID}(owner, props${widgetID});`);
    ctx.addLine(
      `context.__owl__.cmap[${templateID}] = w${widgetID}.__owl__.id;`
    );
    for (let [event, method] of events) {
      ctx.addLine(`w${widgetID}.on('${event}', owner, owner['${method}'])`);
    }
    ctx.addLine(`def${defID} = w${widgetID}._prepare();`);
    // hack: specify empty remove hook to prevent the node from being removed from the DOM
    // FIXME: click to re-add widget during remove transition -> leak
    ctx.addLine(
      `def${defID} = def${defID}.then(vnode=>{${createHook}let pvnode=h(vnode.sel, {key: ${templateID}, hook: {insert(vn) {let nvn=w${widgetID}._mount(vnode, pvnode.elm);pvnode.elm=nvn.elm;${refExpr}${transitionsInsertCode}},remove() {},destroy(vn) {${finalizeWidgetCode}}}});c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;w${widgetID}.__owl__.pvnode = pvnode;});`
    );

    ctx.addElse();
    // need to update widget
    ctx.addLine(
      `def${defID} = w${widgetID}._updateProps(props${widgetID}, extra.forceUpdate, extra.patchQueue);`
    );
    let keepAliveCode = "";
    if (keepAlive) {
      keepAliveCode = `pvnode.data.hook.insert = vn => {vn.elm.parentNode.replaceChild(w${widgetID}.el,vn.elm);vn.elm=w${widgetID}.el;w${widgetID}._remount();};`;
    }
    ctx.addLine(
      `def${defID} = def${defID}.then(()=>{if (w${widgetID}.__owl__.isDestroyed) {return};${
        tattStyle ? `w${widgetID}.el.style=${tattStyle};` : ""
      }${updateClassCode}let pvnode=w${widgetID}.__owl__.pvnode;${keepAliveCode}c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;});`
    );
    ctx.closeIf();

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
