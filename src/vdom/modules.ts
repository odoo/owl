import { Module, VNode, VNodeData } from "./vdom";

//------------------------------------------------------------------------------
// module/props.ts
//------------------------------------------------------------------------------

function updateProps(oldVnode: VNode, vnode: VNode): void {
  var key: string,
    cur: any,
    old: any,
    elm = vnode.elm,
    oldProps = (oldVnode.data as VNodeData).props,
    props = (vnode.data as VNodeData).props;

  if (!oldProps && !props) return;
  if (oldProps === props) return;
  oldProps = oldProps || {};
  props = props || {};

  for (key in oldProps) {
    if (!props[key]) {
      delete (elm as any)[key];
    }
  }
  for (key in props) {
    cur = props[key];
    old = oldProps[key];
    if (old !== cur && (key !== "value" || (elm as any)[key] !== cur)) {
      (elm as any)[key] = cur;
    }
  }
}

export const propsModule = {
  create: updateProps,
  update: updateProps,
} as Module;

//------------------------------------------------------------------------------
// module/eventlisteners.ts
//------------------------------------------------------------------------------

function invokeHandler(handler: any, vnode?: VNode, event?: Event): void {
  if (typeof handler === "function") {
    // call function handler
    handler.call(vnode, event, vnode);
  } else if (typeof handler === "object") {
    // call handler with arguments
    if (typeof handler[0] === "function") {
      // special case for single argument for performance
      if (handler.length === 2) {
        handler[0].call(vnode, handler[1], event, vnode);
      } else {
        var args = handler.slice(1);
        args.push(event);
        args.push(vnode);
        handler[0].apply(vnode, args);
      }
    } else {
      // call multiple handlers
      for (let i = 0, iLen = handler.length; i < iLen; i++) {
        invokeHandler(handler[i], vnode, event);
      }
    }
  }
}

function handleEvent(event: Event, vnode: VNode) {
  var name = event.type,
    on = (vnode.data as VNodeData).on;

  // call event handler(s) if exists
  if (on) {
    if (on[name]) {
      invokeHandler(on[name], vnode, event);
    } else if (on["!" + name]) {
      invokeHandler(on["!" + name], vnode, event);
    }
  }
}

function createListener() {
  return function handler(event: Event) {
    handleEvent(event, (handler as any).vnode);
  };
}

function updateEventListeners(oldVnode: VNode, vnode?: VNode): void {
  var oldOn = (oldVnode.data as VNodeData).on,
    oldListener = (oldVnode as any).listener,
    oldElm: Element = oldVnode.elm as Element,
    on = vnode && (vnode.data as VNodeData).on,
    elm: Element = (vnode && vnode.elm) as Element,
    name: string;

  // optimization for reused immutable handlers
  if (oldOn === on) {
    return;
  }

  // remove existing listeners which no longer used
  if (oldOn && oldListener) {
    // if element changed or deleted we remove all existing listeners unconditionally
    if (!on) {
      for (name in oldOn) {
        // remove listener if element was changed or existing listeners removed
        const capture = name.charAt(0) === "!";
        name = capture ? name.slice(1) : name;
        oldElm.removeEventListener(name, oldListener, capture);
      }
    } else {
      for (name in oldOn) {
        // remove listener if existing listener removed
        if (!on[name]) {
          const capture = name.charAt(0) === "!";
          name = capture ? name.slice(1) : name;
          oldElm.removeEventListener(name, oldListener, capture);
        }
      }
    }
  }

  // add new listeners which has not already attached
  if (on) {
    // reuse existing listener or create new
    var listener = ((vnode as any).listener = (oldVnode as any).listener || createListener());
    // update vnode for listener
    listener.vnode = vnode;

    // if element changed or added we add all needed listeners unconditionally
    if (!oldOn) {
      for (name in on) {
        // add listener if element was changed or new listeners added
        const capture = name.charAt(0) === "!";
        name = capture ? name.slice(1) : name;
        elm.addEventListener(name, listener, capture);
      }
    } else {
      for (name in on) {
        // add listener if new listener added
        if (!oldOn[name]) {
          const capture = name.charAt(0) === "!";
          name = capture ? name.slice(1) : name;
          elm.addEventListener(name, listener, capture);
        }
      }
    }
  }
}

export const eventListenersModule = {
  create: updateEventListeners,
  update: updateEventListeners,
  destroy: updateEventListeners,
} as Module;

//------------------------------------------------------------------------------
// attributes.ts
//------------------------------------------------------------------------------

const xlinkNS = "http://www.w3.org/1999/xlink";
const xmlNS = "http://www.w3.org/XML/1998/namespace";
const colonChar = 58;
const xChar = 120;

function updateAttrs(oldVnode: VNode, vnode: VNode): void {
  var key: string,
    elm: Element = vnode.elm as Element,
    oldAttrs = (oldVnode.data as VNodeData).attrs,
    attrs = (vnode.data as VNodeData).attrs;

  if (!oldAttrs && !attrs) return;
  if (oldAttrs === attrs) return;
  oldAttrs = oldAttrs || {};
  attrs = attrs || {};

  // update modified attributes, add new attributes
  for (key in attrs) {
    const cur = attrs[key];
    const old = oldAttrs[key];
    if (old !== cur) {
      if (cur === true) {
        elm.setAttribute(key, "");
      } else if (cur === false) {
        elm.removeAttribute(key);
      } else {
        if (key.charCodeAt(0) !== xChar) {
          elm.setAttribute(key, cur);
        } else if (key.charCodeAt(3) === colonChar) {
          // Assume xml namespace
          elm.setAttributeNS(xmlNS, key, cur);
        } else if (key.charCodeAt(5) === colonChar) {
          // Assume xlink namespace
          elm.setAttributeNS(xlinkNS, key, cur);
        } else {
          elm.setAttribute(key, cur);
        }
      }
    }
  }
  // remove removed attributes
  // use `in` operator since the previous `for` iteration uses it (.i.e. add even attributes with undefined value)
  // the other option is to remove all attributes with value == undefined
  for (key in oldAttrs) {
    if (!(key in attrs)) {
      elm.removeAttribute(key);
    }
  }
}

export const attrsModule = {
  create: updateAttrs,
  update: updateAttrs,
} as Module;

//------------------------------------------------------------------------------
// class.ts
//------------------------------------------------------------------------------
function updateClass(oldVnode: VNode, vnode: VNode): void {
  var cur: any,
    name: string,
    elm: Element,
    oldClass = (oldVnode.data as VNodeData).class,
    klass = (vnode.data as VNodeData).class;

  if (!oldClass && !klass) return;
  if (oldClass === klass) return;
  oldClass = oldClass || {};
  klass = klass || {};

  elm = vnode.elm as Element;

  for (name in oldClass) {
    if (name && !klass[name]) {
      elm.classList.remove(name);
    }
  }
  for (name in klass) {
    cur = klass[name];
    if (cur !== oldClass[name]) {
      (elm.classList as any)[cur ? "add" : "remove"](name);
    }
  }
}

export const classModule = { create: updateClass, update: updateClass } as Module;
