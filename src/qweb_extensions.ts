import { QWeb, UTILS } from "./qweb_core";
import { VNode } from "./vdom";

/**
 * Owl QWeb Extensions
 *
 * This file contains the implementation of non standard QWeb directives, added
 * by Owl and that will only work on Owl projects:
 *
 * - t-on
 * - t-ref
 * - t-transition
 * - t-component/t-keepalive
 * - t-mounted
 * - t-slot
 * - t-model
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
UTILS.nextFrame = function(cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

UTILS.transitionInsert = function(vn: VNode, name: string) {
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

UTILS.transitionRemove = function(vn: VNode, name: string, rm: () => void) {
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
  atNodeCreation({ value, addNodeHook }) {
    let name = value;
    const hooks = {
      insert: `this.utils.transitionInsert(vn, '${name}');`,
      remove: `this.utils.transitionRemove(vn, '${name}', rm);`
    };
    for (let hookName in hooks) {
      addNodeHook(hookName, hooks[hookName]);
    }
  }
});

//------------------------------------------------------------------------------
// t-component
//------------------------------------------------------------------------------

const T_COMPONENT_MODS_CODE = Object.assign({}, MODS_CODE, {
  self: "if (e.target !== vn.elm) {return}"
});

/**
 * The t-component directive is certainly a complicated and hard to maintain piece
 * of code.  To help you, fellow developer, if you have to maintain it, I offer
 * you this advice: Good luck...
 *
 * Since it is not 'direct' code, but rather code that generates other code, it
 * is not easy to understand.  To help you, here  is a detailed and commented
 * explanation of the code generated by the t-component directive for the following
 * situation:
 * ```xml
 *   <Child
 *      t-key="'somestring'"
 *      flag="state.flag"
 *      t-transition="fade"/>
 * ```
 *
 * ```js
 * // we assign utils on top of the function because it will be useful for
 * // each components
 * let utils = this.utils;
 *
 * // this is the virtual node representing the parent div
 * let c1 = [], p1 = { key: 1 };
 * var vn1 = h("div", p1, c1);
 *
 * // t-component directive: we start by evaluating the expression given by t-key:
 * let key5 = "somestring";
 *
 * // def3 is the promise that will contain later either the new component
 * // creation, or the props update...
 * let def3;
 *
 * // this is kind of tricky: we need here to find if the component was already
 * // created by a previous rendering.  This is done by checking the internal
 * // `cmap` (children map) of the parent component: it maps keys to component ids,
 * // and, then, if there is an id, we look into the children list to get the
 * // instance
 * let w4 =
 *   key5 in context.__owl__.cmap
 *   ? context.__owl__.children[context.__owl__.cmap[key5]]
 *   : false;
 *
 * // We keep the index of the position of the component in the closure.  We push
 * // null to reserve the slot, and will replace it later by the component vnode,
 * // when it will be ready (do not forget that preparing/rendering a component is
 * // asynchronous)
 * let _2_index = c1.length;
 * c1.push(null);
 *
 * // we evaluate here the props given to the component. It is done here to be
 * // able to easily reference it later, and also, it might be an expensive
 * // computation, so it is certainly better to do it only once
 * let props4 = { flag: context["state"].flag };
 *
 * // If we have a component, currently rendering, but not ready yet, we do not want
 * // to wait for it to be ready if we can avoid it
 * if (w4 && w4.__owl__.renderPromise && !w4.__owl__.vnode) {
 *   // we check if the props are the same.  In that case, we can simply reuse
 *   // the previous rendering and skip all useless work
 *   if (utils.shallowEqual(props4, w4.__owl__.renderProps)) {
 *     def3 = w4.__owl__.renderPromise;
 *   } else {
 *     // if the props are not the same, we destroy the component and starts anew.
 *     // this will be faster than waiting for its rendering, then updating it
 *     w4.destroy();
 *     w4 = false;
 *   }
 * }
 *
 * if (!w4) {
 *   // in this situation, we need to create a new component.  First step is
 *   // to get a reference to the class, then create an instance with
 *   // current context as parent, and the props.
 *   let W4 = context.component && context.components[componentKey4] || QWeb.component[componentKey4];

 *   if (!W4) {
 *     throw new Error("Cannot find the definition of component 'child'");
 *   }
 *   w4 = new W4(owner, props4);
 *
 *   // Whenever we rerender the parent component, we need to be sure that we
 *   // are able to find the component instance. To do that, we register it to
 *   // the parent cmap (children map).  Note that the 'template' key is
 *   // used here, since this is what identify the component from the template
 *   // perspective.
 *   context.__owl__.cmap[key5] = w4.__owl__.id;
 *
 *   // __prepare is called, to basically call willStart, then render the
 *   // component
 *   def3 = w4.__prepare();
 *
 *   def3 = def3.then(vnode => {
 *     // we create here a virtual node for the parent (NOT the component). This
 *     // means that the vdom of the parent will be stopped here, and from
 *     // the parent's perspective, it simply is a vnode with no children.
 *     // However, it shares the same dom element with the component root
 *     // vnode.
 *     let pvnode = h(vnode.sel, { key: key5 });
 *
 *     // we add hooks to the parent vnode so we can interact with the new
 *     // component at the proper time
 *     pvnode.data.hook = {
 *       insert(vn) {
 *         // the __mount method will patch the component vdom into the elm vn.elm,
 *         // then call the mounted hooks. However, suprisingly, the snabbdom
 *         // patch method actually replace the elm by a new elm, so we need
 *         // to synchronise the pvnode elm with the resulting elm
 *         let nvn = w4.__mount(vnode, vn.elm);
 *         pvnode.elm = nvn.elm;
 *         // what follows is only present if there are animations on the component
 *         utils.transitionInsert(vn, "fade");
 *       },
 *       remove() {
 *         // override with empty function to prevent from removing the node
 *         // directly. It will be removed when destroy is called anyway, which
 *         // delays the removal if there are animations.
 *       },
 *       destroy() {
 *         // if there are animations, we delay the call to destroy on the
 *         // component, if not, we call it directly.
 *         let finalize = () => {
 *           w4.destroy();
 *         };
 *         utils.transitionRemove(vn, "fade", finalize);
 *       }
 *     };
 *     // the pvnode is inserted at the correct position in the div's children
 *     c1[_2_index] = pvnode;
 *
 *     // we keep here a reference to the parent vnode (representing the
 *     // component, so we can reuse it later whenever we update the component
 *     w4.__owl__.pvnode = pvnode;
 *   });
 * } else {
 *   // this is the 'update' path of the directive.
 *   // the call to __updateProps is the actual component update
 *   // Note that we only update the props if we cannot reuse the previous
 *   // rendering work (in the case it was rendered with the same props)
 *   def3 = def3 || w4.__updateProps(props4, extra.forceUpdate, extra.patchQueue);
 *   def3 = def3.then(() => {
 *     // if component was destroyed in the meantime, we do nothing (so, this
 *     // means that the parent's element children list will have a null in
 *     // the component's position, which will cause the pvnode to be removed
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
  name: "component",
  extraNames: ["props", "keepalive", "asyncroot"],
  priority: 100,
  atNodeEncounter({ ctx, value, node, qweb }): boolean {
    ctx.addLine("//COMPONENT");
    ctx.rootContext.shouldDefineOwner = true;
    ctx.rootContext.shouldDefineQWeb = true;
    ctx.rootContext.shouldDefineUtils = true;
    let keepAlive = node.getAttribute("t-keepalive") ? true : false;
    let async = node.getAttribute("t-asyncroot") ? true : false;

    // t-on- events and t-transition
    const events: [string, string[], string, string][] = [];
    let transition: string = "";
    const attributes = (<Element>node).attributes;
    const props: { [key: string]: string } = {};
    for (let i = 0; i < attributes.length; i++) {
      const name = attributes[i].name;
      const value = attributes[i].textContent!;
      if (name.startsWith("t-on-")) {
        const [eventName, ...mods] = name.slice(5).split(".");
        let extraArgs;
        let handlerName = value.replace(/\(.*\)/, function(args) {
          extraArgs = args.slice(1, -1);
          return "";
        });
        events.push([eventName, mods, handlerName, extraArgs]);
      } else if (name === "t-transition") {
        transition = value;
      } else if (!name.startsWith("t-")) {
        if (name !== "class" && name !== "style") {
          // this is a prop!
          props[name] = ctx.formatExpression(value);
        }
      }
    }

    let key = node.getAttribute("t-key");
    if (key) {
      key = ctx.formatExpression(key);
    }

    // computing the props string representing the props object
    let propStr = Object.keys(props)
      .map(k => k + ":" + props[k])
      .join(",");
    let dummyID = ctx.generateID();
    let defID = ctx.generateID();
    let componentID = ctx.generateID();
    let keyID = key && ctx.generateID();
    if (key) {
      // we bind a variable to the key (could be a complex expression, so we
      // want to evaluate it only once)
      ctx.addLine(`let key${keyID} = ${key};`);
    }
    ctx.addLine(`let def${defID};`);
    let templateID = key
      ? `key${keyID}`
      : ctx.inLoop
      ? `String(-${componentID} - i)`
      : String(componentID);
    if (ctx.allowMultipleRoots) {
      // necessary to prevent collisions
      if (!key && ctx.inLoop) {
        let id = ctx.generateID();
        ctx.addLine(`let template${id} = "_slot_" + String(-${componentID} - i)`);
        templateID = `template${id}`;
      } else {
        templateID = `"_slot_${templateID}"`;
      }
    }

    let ref = node.getAttribute("t-ref");
    let refExpr = "";
    let refKey: string = "";
    if (ref) {
      refKey = `ref${ctx.generateID()}`;
      ctx.addLine(`const ${refKey} = ${ctx.interpolate(ref)};`);
      refExpr = `context.refs[${refKey}] = w${componentID};`;
    }
    let transitionsInsertCode = "";
    if (transition) {
      transitionsInsertCode = `utils.transitionInsert(vn, '${transition}');`;
    }
    let finalizeComponentCode = `w${componentID}.${keepAlive ? "unmount" : "destroy"}();`;
    if (ref && !keepAlive) {
      finalizeComponentCode += `delete context.refs[${refKey}];`;
    }
    if (transition) {
      finalizeComponentCode = `let finalize = () => {
          ${finalizeComponentCode}
        };
        utils.transitionRemove(vn, '${transition}', finalize);`;
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
    let classObj = "";
    if (classAttr || tattClass || styleAttr || tattStyle || events.length) {
      if (classAttr) {
        let classDef = classAttr
          .trim()
          .split(/\s+/)
          .map(a => `'${a}':true`)
          .join(",");
        classObj = `_${ctx.generateID()}`;
        ctx.addLine(`let ${classObj} = {${classDef}};`);
      }
      if (tattClass) {
        let tattExpr = ctx.formatExpression(tattClass);
        if (tattExpr[0] !== "{" || tattExpr[tattExpr.length - 1] !== "}") {
          tattExpr = `this.utils.toObj(${tattExpr})`;
        }
        if (classAttr) {
          ctx.addLine(`Object.assign(${classObj}, ${tattExpr})`);
        } else {
          classObj = `_${ctx.generateID()}`;
          ctx.addLine(`let ${classObj} = ${tattExpr};`);
        }
      }
      let eventsCode = events
        .map(function([eventName, mods, handlerName, extraArgs]) {
          let params = "owner";
          if (extraArgs) {
            if (ctx.inLoop) {
              let argId = ctx.generateID();
              // we need to evaluate the arguments now, because the handler will
              // be set asynchronously later when the widget is ready, and the
              // context might be different.
              ctx.addLine(`let arg${argId} = ${ctx.formatExpression(extraArgs)};`);
              params = `owner, arg${argId}`;
            } else {
              params = `owner, ${ctx.formatExpression(extraArgs)}`;
            }
          }
          let handler;
          if (mods.length > 0) {
            handler = `function (e) {`;
            handler += mods
              .map(function(mod) {
                return T_COMPONENT_MODS_CODE[mod];
              })
              .join("");
            handler += `owner['${handlerName}'].call(${params}, e);}`;
          } else {
            handler = `owner['${handlerName}'].bind(${params})`;
          }
          return `vn.elm.addEventListener('${eventName}', ${handler});`;
        })
        .join("");
      const styleExpr = tattStyle || (styleAttr ? `'${styleAttr}'` : false);
      const styleCode = styleExpr ? `vn.elm.style = ${styleExpr};` : "";
      createHook = `vnode.data.hook = {create(_, vn){${styleCode}${eventsCode}}};`;
    }

    ctx.addLine(
      `let w${componentID} = ${templateID} in context.__owl__.cmap ? context.__owl__.children[context.__owl__.cmap[${templateID}]] : false;`
    );
    ctx.addLine(`let _${dummyID}_index = c${ctx.parentNode}.length;`);
    if (async) {
      ctx.addLine(`const patchQueue${componentID} = [];`);
      ctx.addLine(
        `c${ctx.parentNode}.push(w${componentID} && w${componentID}.__owl__.pvnode || null);`
      );
    } else {
      ctx.addLine(`c${ctx.parentNode}.push(null);`);
    }
    ctx.addLine(`let props${componentID} = {${propStr}};`);
    ctx.addIf(
      `w${componentID} && w${componentID}.__owl__.renderPromise && !w${componentID}.__owl__.vnode`
    );
    ctx.addIf(`utils.shallowEqual(props${componentID}, w${componentID}.__owl__.renderProps)`);
    ctx.addLine(`def${defID} = w${componentID}.__owl__.renderPromise;`);
    ctx.addElse();
    ctx.addLine(`w${componentID}.destroy();`);
    ctx.addLine(`w${componentID} = false;`);
    ctx.closeIf();
    ctx.closeIf();

    ctx.addIf(`!w${componentID}`);
    // new component
    ctx.addLine(`let componentKey${componentID} = ${ctx.interpolate(value)};`);
    ctx.addLine(
      `let W${componentID} = context.components && context.components[componentKey${componentID}] || QWeb.components[componentKey${componentID}];`
    );

    // maybe only do this in dev mode...
    ctx.addLine(
      `if (!W${componentID}) {throw new Error('Cannot find the definition of component "' + componentKey${componentID} + '"')}`
    );
    ctx.addLine(`w${componentID} = new W${componentID}(owner, props${componentID});`);
    ctx.addLine(`context.__owl__.cmap[${templateID}] = w${componentID}.__owl__.id;`);

    // SLOTS
    if (node.childNodes.length) {
      const clone = <Element>node.cloneNode(true);
      const slotNodes = clone.querySelectorAll("[t-set]");
      const slotId = qweb.nextSlotId++;
      ctx.addLine(`w${componentID}.__owl__.slotId = ${slotId};`);
      if (slotNodes.length) {
        for (let i = 0, length = slotNodes.length; i < length; i++) {
          const slotNode = slotNodes[i];
          slotNode.parentElement!.removeChild(slotNode);
          const key = slotNode.getAttribute("t-set")!;
          slotNode.removeAttribute("t-set");
          const slotFn = qweb._compile(`slot_${key}_template`, slotNode, ctx.parentNode!);
          qweb.slots[`${slotId}_${key}`] = slotFn.bind(qweb);
        }
      }
      if (clone.childNodes.length) {
        const t = clone.ownerDocument!.createElement("t");
        for (let child of Object.values(clone.childNodes)) {
          t.appendChild(child);
        }
        const slotFn = qweb._compile(`slot_default_template`, t, ctx.parentNode!);
        qweb.slots[`${slotId}_default`] = slotFn.bind(qweb);
      }
    }

    ctx.addLine(`def${defID} = w${componentID}.__prepare();`);
    // hack: specify empty remove hook to prevent the node from being removed from the DOM
    ctx.addLine(
      `def${defID} = def${defID}.then(vnode=>{${createHook}let pvnode=h(vnode.sel, {key: ${templateID}, hook: {insert(vn) {let nvn=w${componentID}.__mount(vnode, pvnode.elm);pvnode.elm=nvn.elm;${refExpr}${transitionsInsertCode}},remove() {},destroy(vn) {${finalizeComponentCode}}}});c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;w${componentID}.__owl__.pvnode = pvnode;});`
    );

    ctx.addElse();
    // need to update component
    const patchQueueCode = async ? `patchQueue${componentID}` : "extra.patchQueue";
    ctx.addLine(
      `def${defID} = def${defID} || w${componentID}.__updateProps(props${componentID}, extra.forceUpdate, ${patchQueueCode});`
    );
    let keepAliveCode = "";
    if (keepAlive) {
      keepAliveCode = `pvnode.data.hook.insert = vn => {vn.elm.parentNode.replaceChild(w${componentID}.el,vn.elm);vn.elm=w${componentID}.el;w${componentID}.__remount();};`;
    }
    ctx.addLine(
      `def${defID} = def${defID}.then(()=>{if (w${componentID}.__owl__.isDestroyed) {return};${
        tattStyle ? `w${componentID}.el.style=${tattStyle};` : ""
      }let pvnode=w${componentID}.__owl__.pvnode;${keepAliveCode}c${
        ctx.parentNode
      }[_${dummyID}_index]=pvnode;});`
    );
    ctx.closeIf();

    if (classObj) {
      ctx.addLine(`w${componentID}.__owl__.classObj=${classObj};`);
    }

    if (async) {
      ctx.addLine(
        `def${defID}.then(w${componentID}.__applyPatchQueue.bind(w${componentID}, patchQueue${componentID}));`
      );
    } else {
      ctx.addLine(`extra.promises.push(def${defID});`);
    }

    if (node.hasAttribute("t-if") || node.hasAttribute("t-else") || node.hasAttribute("t-elif")) {
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
    ctx.addLine(`const slot${slotKey} = this.slots[context.__owl__.slotId + '_' + '${value}'];`);
    ctx.addIf(`slot${slotKey}`);
    ctx.addLine(
      `slot${slotKey}(context.__owl__.parent, Object.assign({}, extra, {parentNode: c${
        ctx.parentNode
      }}));`
    );
    ctx.closeIf();
    return true;
  }
});

//------------------------------------------------------------------------------
// t-model
//------------------------------------------------------------------------------
UTILS.toNumber = function(val: string): number | string {
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
