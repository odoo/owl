(function (exports) {
    'use strict';

    /**
     * Owl Observer
     *
     * This code contains the logic that allows Owl to observe and react to state
     * changes.
     *
     * This is a Observer class that can observe any JS values.  The way it works
     * can be summarized thusly:
     * - primitive values are not observed at all
     * - Objects are observed by replacing all their keys with getters/setters
     *   (recursively)
     * - Arrays are observed by replacing their prototype with a customized version,
     *   which wrap some methods to allow the tracking of each state change.
     *
     * Note that this code is inspired by Vue.
     */
    //------------------------------------------------------------------------------
    // Modified Array prototype
    //------------------------------------------------------------------------------
    // we define here a new modified Array prototype, which basically override all
    // Array methods that change some state to be able to track their changes
    const methodsToPatch = [
        "push",
        "pop",
        "shift",
        "unshift",
        "splice",
        "sort",
        "reverse"
    ];
    const methodLen = methodsToPatch.length;
    const ArrayProto = Array.prototype;
    const ModifiedArrayProto = Object.create(ArrayProto);
    for (let i = 0; i < methodLen; i++) {
        const method = methodsToPatch[i];
        const initialMethod = ArrayProto[method];
        ModifiedArrayProto[method] = function (...args) {
            if (!this.__observer__.allowMutations) {
                throw new Error(`Array cannot be changed here")`);
            }
            this.__observer__.rev++;
            this.__observer__.notifyChange();
            this.__owl__.rev++;
            let parent = this;
            do {
                parent.__owl__.deepRev++;
            } while ((parent = parent.__owl__.parent));
            let inserted;
            switch (method) {
                case "push":
                case "unshift":
                    inserted = args;
                    break;
                case "splice":
                    inserted = args.slice(2);
                    break;
            }
            if (inserted) {
                for (let i = 0, iLen = inserted.length; i < iLen; i++) {
                    this.__observer__.observe(inserted[i], this);
                }
            }
            return initialMethod.call(this, ...args);
        };
    }
    //------------------------------------------------------------------------------
    // Observer
    //------------------------------------------------------------------------------
    class Observer {
        constructor() {
            this.rev = 1;
            this.allowMutations = true;
            this.dirty = false;
        }
        static set(target, key, value) {
            if (!target.__owl__) {
                throw Error("`Observer.set()` can only be called with observed Objects or Arrays");
            }
            target.__owl__.observer.set(target, key, value);
        }
        static delete(target, key) {
            if (!target.__owl__) {
                throw Error("`Observer.delete()` can only be called with observed Objects");
            }
            target.__owl__.observer.delete(target, key);
        }
        notifyCB() { }
        notifyChange() {
            this.dirty = true;
            Promise.resolve().then(() => {
                if (this.dirty) {
                    this.dirty = false;
                    this.notifyCB();
                }
            });
        }
        observe(value, parent) {
            if (value === null) {
                // fun fact: typeof null === 'object'
                return;
            }
            if (typeof value !== "object") {
                return;
            }
            if ("__owl__" in value) {
                // already observed
                value.__owl__.parent = parent;
                return;
            }
            if (Array.isArray(value)) {
                this._observeArr(value, parent);
            }
            else {
                this._observeObj(value, parent);
            }
        }
        set(target, key, value) {
            let alreadyDefined = key in target &&
                Object.getOwnPropertyDescriptor(target, key).configurable === false;
            if (alreadyDefined) {
                target[key] = value;
            }
            else {
                this._addProp(target, key, value);
                this._updateRevNumber(target);
            }
            this.notifyChange();
        }
        delete(target, key) {
            delete target[key];
            this._updateRevNumber(target);
            this.notifyChange();
        }
        _observeObj(obj, parent) {
            obj.__owl__ = {
                rev: this.rev,
                deepRev: this.rev,
                parent,
                observer: this
            };
            Object.defineProperty(obj, "__owl__", { enumerable: false });
            for (let key in obj) {
                this._addProp(obj, key, obj[key]);
            }
        }
        _observeArr(arr, parent) {
            arr.__owl__ = {
                rev: this.rev,
                deepRev: this.rev,
                parent,
                observer: this
            };
            Object.defineProperty(arr, "__owl__", { enumerable: false });
            arr.__proto__ = Object.create(ModifiedArrayProto);
            arr.__proto__.__observer__ = this;
            for (let i = 0, iLen = arr.length; i < iLen; i++) {
                this.observe(arr[i], arr);
            }
        }
        _addProp(obj, key, value) {
            var self = this;
            Object.defineProperty(obj, key, {
                configurable: true,
                enumerable: true,
                get() {
                    return value;
                },
                set(newVal) {
                    if (newVal !== value) {
                        if (!self.allowMutations) {
                            throw new Error(`Observed state cannot be changed here! (key: "${key}", val: "${newVal}")`);
                        }
                        self._updateRevNumber(obj);
                        value = newVal;
                        self.observe(newVal, obj);
                        self.notifyChange();
                    }
                }
            });
            this.observe(value, obj);
        }
        _updateRevNumber(target) {
            this.rev++;
            target.__owl__.rev++;
            let parent = target;
            do {
                parent.__owl__.deepRev++;
            } while ((parent = parent.__owl__.parent) && parent !== target);
        }
    }

    /**
     * Owl VDOM
     *
     * This file contains an implementation of a virtual DOM, which is a system that
     * can generate in-memory representations of a DOM tree, compare them, and
     * eventually change a concrete DOM tree to match its representation, in an
     * hopefully efficient way.
     *
     * Note that this code is a fork of Snabbdom, slightly tweaked/optimized for our
     * needs (see https://github.com/snabbdom/snabbdom).
     *
     * The main exported values are:
     * - interface VNode
     * - h function (a helper function to generate a vnode)
     * - patch function (to apply a vnode to an actual DOM node)
     */
    function vnode(sel, data, children, text, elm) {
        let key = data === undefined ? undefined : data.key;
        return { sel, data, children, text, elm, key };
    }
    //------------------------------------------------------------------------------
    // snabbdom.ts
    //------------------------------------------------------------------------------
    function isUndef(s) {
        return s === undefined;
    }
    function isDef(s) {
        return s !== undefined;
    }
    const emptyNode = vnode("", {}, [], undefined, undefined);
    function sameVnode(vnode1, vnode2) {
        return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
    }
    function isVnode(vnode) {
        return vnode.sel !== undefined;
    }
    function createKeyToOldIdx(children, beginIdx, endIdx) {
        let i, map = {}, key, ch;
        for (i = beginIdx; i <= endIdx; ++i) {
            ch = children[i];
            if (ch != null) {
                key = ch.key;
                if (key !== undefined)
                    map[key] = i;
            }
        }
        return map;
    }
    const hooks = [
        "create",
        "update",
        "remove",
        "destroy",
        "pre",
        "post"
    ];
    function init(modules, domApi) {
        let i, j, cbs = {};
        const api = domApi !== undefined ? domApi : htmlDomApi;
        for (i = 0; i < hooks.length; ++i) {
            cbs[hooks[i]] = [];
            for (j = 0; j < modules.length; ++j) {
                const hook = modules[j][hooks[i]];
                if (hook !== undefined) {
                    cbs[hooks[i]].push(hook);
                }
            }
        }
        function emptyNodeAt(elm) {
            const id = elm.id ? "#" + elm.id : "";
            const c = elm.className ? "." + elm.className.split(" ").join(".") : "";
            return vnode(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
        }
        function createRmCb(childElm, listeners) {
            return function rmCb() {
                if (--listeners === 0) {
                    const parent = api.parentNode(childElm);
                    api.removeChild(parent, childElm);
                }
            };
        }
        function createElm(vnode, insertedVnodeQueue) {
            let i, iLen, data = vnode.data;
            if (data !== undefined) {
                if (isDef((i = data.hook)) && isDef((i = i.init))) {
                    i(vnode);
                    data = vnode.data;
                }
            }
            let children = vnode.children, sel = vnode.sel;
            if (sel === "!") {
                if (isUndef(vnode.text)) {
                    vnode.text = "";
                }
                vnode.elm = api.createComment(vnode.text);
            }
            else if (sel !== undefined) {
                // Parse selector
                const hashIdx = sel.indexOf("#");
                const dotIdx = sel.indexOf(".", hashIdx);
                const hash = hashIdx > 0 ? hashIdx : sel.length;
                const dot = dotIdx > 0 ? dotIdx : sel.length;
                const tag = hashIdx !== -1 || dotIdx !== -1
                    ? sel.slice(0, Math.min(hash, dot))
                    : sel;
                const elm = (vnode.elm =
                    isDef(data) && isDef((i = data.ns))
                        ? api.createElementNS(i, tag)
                        : api.createElement(tag));
                if (hash < dot)
                    elm.setAttribute("id", sel.slice(hash + 1, dot));
                if (dotIdx > 0)
                    elm.setAttribute("class", sel.slice(dot + 1).replace(/\./g, " "));
                for (i = 0, iLen = cbs.create.length; i < iLen; ++i)
                    cbs.create[i](emptyNode, vnode);
                if (array(children)) {
                    for (i = 0, iLen = children.length; i < iLen; ++i) {
                        const ch = children[i];
                        if (ch != null) {
                            api.appendChild(elm, createElm(ch, insertedVnodeQueue));
                        }
                    }
                }
                else if (primitive(vnode.text)) {
                    api.appendChild(elm, api.createTextNode(vnode.text));
                }
                i = vnode.data.hook; // Reuse variable
                if (isDef(i)) {
                    if (i.create)
                        i.create(emptyNode, vnode);
                    if (i.insert)
                        insertedVnodeQueue.push(vnode);
                }
            }
            else {
                vnode.elm = api.createTextNode(vnode.text);
            }
            return vnode.elm;
        }
        function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
            for (; startIdx <= endIdx; ++startIdx) {
                const ch = vnodes[startIdx];
                if (ch != null) {
                    api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
                }
            }
        }
        function invokeDestroyHook(vnode) {
            let i, iLen, j, jLen, data = vnode.data;
            if (data !== undefined) {
                if (isDef((i = data.hook)) && isDef((i = i.destroy)))
                    i(vnode);
                for (i = 0, iLen = cbs.destroy.length; i < iLen; ++i)
                    cbs.destroy[i](vnode);
                if (vnode.children !== undefined) {
                    for (j = 0, jLen = vnode.children.length; j < jLen; ++j) {
                        i = vnode.children[j];
                        if (i != null && typeof i !== "string") {
                            invokeDestroyHook(i);
                        }
                    }
                }
            }
        }
        function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
            for (; startIdx <= endIdx; ++startIdx) {
                let i, iLen, listeners, rm, ch = vnodes[startIdx];
                if (ch != null) {
                    if (isDef(ch.sel)) {
                        invokeDestroyHook(ch);
                        listeners = cbs.remove.length + 1;
                        rm = createRmCb(ch.elm, listeners);
                        for (i = 0, iLen = cbs.remove.length; i < iLen; ++i)
                            cbs.remove[i](ch, rm);
                        if (isDef((i = ch.data)) &&
                            isDef((i = i.hook)) &&
                            isDef((i = i.remove))) {
                            i(ch, rm);
                        }
                        else {
                            rm();
                        }
                    }
                    else {
                        // Text node
                        api.removeChild(parentElm, ch.elm);
                    }
                }
            }
        }
        function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
            let oldStartIdx = 0, newStartIdx = 0;
            let oldEndIdx = oldCh.length - 1;
            let oldStartVnode = oldCh[0];
            let oldEndVnode = oldCh[oldEndIdx];
            let newEndIdx = newCh.length - 1;
            let newStartVnode = newCh[0];
            let newEndVnode = newCh[newEndIdx];
            let oldKeyToIdx;
            let idxInOld;
            let elmToMove;
            let before;
            while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
                if (oldStartVnode == null) {
                    oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
                }
                else if (oldEndVnode == null) {
                    oldEndVnode = oldCh[--oldEndIdx];
                }
                else if (newStartVnode == null) {
                    newStartVnode = newCh[++newStartIdx];
                }
                else if (newEndVnode == null) {
                    newEndVnode = newCh[--newEndIdx];
                }
                else if (sameVnode(oldStartVnode, newStartVnode)) {
                    patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
                    oldStartVnode = oldCh[++oldStartIdx];
                    newStartVnode = newCh[++newStartIdx];
                }
                else if (sameVnode(oldEndVnode, newEndVnode)) {
                    patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
                    oldEndVnode = oldCh[--oldEndIdx];
                    newEndVnode = newCh[--newEndIdx];
                }
                else if (sameVnode(oldStartVnode, newEndVnode)) {
                    // Vnode moved right
                    patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
                    api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
                    oldStartVnode = oldCh[++oldStartIdx];
                    newEndVnode = newCh[--newEndIdx];
                }
                else if (sameVnode(oldEndVnode, newStartVnode)) {
                    // Vnode moved left
                    patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
                    api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
                    oldEndVnode = oldCh[--oldEndIdx];
                    newStartVnode = newCh[++newStartIdx];
                }
                else {
                    if (oldKeyToIdx === undefined) {
                        oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
                    }
                    idxInOld = oldKeyToIdx[newStartVnode.key];
                    if (isUndef(idxInOld)) {
                        // New element
                        api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                        newStartVnode = newCh[++newStartIdx];
                    }
                    else {
                        elmToMove = oldCh[idxInOld];
                        if (elmToMove.sel !== newStartVnode.sel) {
                            api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                        }
                        else {
                            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
                            oldCh[idxInOld] = undefined;
                            api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
                        }
                        newStartVnode = newCh[++newStartIdx];
                    }
                }
            }
            if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
                if (oldStartIdx > oldEndIdx) {
                    before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
                    addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
                }
                else {
                    removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
                }
            }
        }
        function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
            let i, iLen, hook;
            if (isDef((i = vnode.data)) &&
                isDef((hook = i.hook)) &&
                isDef((i = hook.prepatch))) {
                i(oldVnode, vnode);
            }
            const elm = (vnode.elm = oldVnode.elm);
            let oldCh = oldVnode.children;
            let ch = vnode.children;
            if (oldVnode === vnode)
                return;
            if (vnode.data !== undefined) {
                for (i = 0, iLen = cbs.update.length; i < iLen; ++i)
                    cbs.update[i](oldVnode, vnode);
                i = vnode.data.hook;
                if (isDef(i) && isDef((i = i.update)))
                    i(oldVnode, vnode);
            }
            if (isUndef(vnode.text)) {
                if (isDef(oldCh) && isDef(ch)) {
                    if (oldCh !== ch)
                        updateChildren(elm, oldCh, ch, insertedVnodeQueue);
                }
                else if (isDef(ch)) {
                    if (isDef(oldVnode.text))
                        api.setTextContent(elm, "");
                    addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
                }
                else if (isDef(oldCh)) {
                    removeVnodes(elm, oldCh, 0, oldCh.length - 1);
                }
                else if (isDef(oldVnode.text)) {
                    api.setTextContent(elm, "");
                }
            }
            else if (oldVnode.text !== vnode.text) {
                if (isDef(oldCh)) {
                    removeVnodes(elm, oldCh, 0, oldCh.length - 1);
                }
                api.setTextContent(elm, vnode.text);
            }
            if (isDef(hook) && isDef((i = hook.postpatch))) {
                i(oldVnode, vnode);
            }
        }
        return function patch(oldVnode, vnode) {
            let i, iLen, elm, parent;
            const insertedVnodeQueue = [];
            for (i = 0, iLen = cbs.pre.length; i < iLen; ++i)
                cbs.pre[i]();
            if (!isVnode(oldVnode)) {
                oldVnode = emptyNodeAt(oldVnode);
            }
            if (sameVnode(oldVnode, vnode)) {
                patchVnode(oldVnode, vnode, insertedVnodeQueue);
            }
            else {
                elm = oldVnode.elm;
                parent = api.parentNode(elm);
                createElm(vnode, insertedVnodeQueue);
                if (parent !== null) {
                    api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
                    removeVnodes(parent, [oldVnode], 0, 0);
                }
            }
            for (i = 0, iLen = insertedVnodeQueue.length; i < iLen; ++i) {
                insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
            }
            for (i = 0, iLen = cbs.post.length; i < iLen; ++i)
                cbs.post[i]();
            return vnode;
        };
    }
    //------------------------------------------------------------------------------
    // is.ts
    //------------------------------------------------------------------------------
    const array = Array.isArray;
    function primitive(s) {
        return typeof s === "string" || typeof s === "number";
    }
    function createElement(tagName) {
        return document.createElement(tagName);
    }
    function createElementNS(namespaceURI, qualifiedName) {
        return document.createElementNS(namespaceURI, qualifiedName);
    }
    function createTextNode(text) {
        return document.createTextNode(text);
    }
    function createComment(text) {
        return document.createComment(text);
    }
    function insertBefore(parentNode, newNode, referenceNode) {
        parentNode.insertBefore(newNode, referenceNode);
    }
    function removeChild(node, child) {
        node.removeChild(child);
    }
    function appendChild(node, child) {
        node.appendChild(child);
    }
    function parentNode(node) {
        return node.parentNode;
    }
    function nextSibling(node) {
        return node.nextSibling;
    }
    function tagName(elm) {
        return elm.tagName;
    }
    function setTextContent(node, text) {
        node.textContent = text;
    }
    function getTextContent(node) {
        return node.textContent;
    }
    function isElement(node) {
        return node.nodeType === 1;
    }
    function isText(node) {
        return node.nodeType === 3;
    }
    function isComment(node) {
        return node.nodeType === 8;
    }
    const htmlDomApi = {
        createElement,
        createElementNS,
        createTextNode,
        createComment,
        insertBefore,
        removeChild,
        appendChild,
        parentNode,
        nextSibling,
        tagName,
        setTextContent,
        getTextContent,
        isElement,
        isText,
        isComment
    };
    function addNS(data, children, sel) {
        data.ns = "http://www.w3.org/2000/svg";
        if (sel !== "foreignObject" && children !== undefined) {
            for (let i = 0, iLen = children.length; i < iLen; ++i) {
                let childData = children[i].data;
                if (childData !== undefined) {
                    addNS(childData, children[i].children, children[i].sel);
                }
            }
        }
    }
    function h(sel, b, c) {
        var data = {}, children, text, i, iLen;
        if (c !== undefined) {
            data = b;
            if (array(c)) {
                children = c;
            }
            else if (primitive(c)) {
                text = c;
            }
            else if (c && c.sel) {
                children = [c];
            }
        }
        else if (b !== undefined) {
            if (array(b)) {
                children = b;
            }
            else if (primitive(b)) {
                text = b;
            }
            else if (b && b.sel) {
                children = [b];
            }
            else {
                data = b;
            }
        }
        if (children !== undefined) {
            for (i = 0, iLen = children.length; i < iLen; ++i) {
                if (primitive(children[i]))
                    children[i] = vnode(undefined, undefined, undefined, children[i], undefined);
            }
        }
        if (sel[0] === "s" &&
            sel[1] === "v" &&
            sel[2] === "g" &&
            (sel.length === 3 || sel[3] === "." || sel[3] === "#")) {
            addNS(data, children, sel);
        }
        return vnode(sel, data, children, text, undefined);
    }
    function updateProps(oldVnode, vnode) {
        var key, cur, old, elm = vnode.elm, oldProps = oldVnode.data.props, props = vnode.data.props;
        if (!oldProps && !props)
            return;
        if (oldProps === props)
            return;
        oldProps = oldProps || {};
        props = props || {};
        for (key in oldProps) {
            if (!props[key]) {
                delete elm[key];
            }
        }
        for (key in props) {
            cur = props[key];
            old = oldProps[key];
            if (old !== cur && (key !== "value" || elm[key] !== cur)) {
                elm[key] = cur;
            }
        }
    }
    const propsModule = {
        create: updateProps,
        update: updateProps
    };
    function invokeHandler(handler, vnode, event) {
        if (typeof handler === "function") {
            // call function handler
            handler.call(vnode, event, vnode);
        }
        else if (typeof handler === "object") {
            // call handler with arguments
            if (typeof handler[0] === "function") {
                // special case for single argument for performance
                if (handler.length === 2) {
                    handler[0].call(vnode, handler[1], event, vnode);
                }
                else {
                    var args = handler.slice(1);
                    args.push(event);
                    args.push(vnode);
                    handler[0].apply(vnode, args);
                }
            }
            else {
                // call multiple handlers
                for (let i = 0, iLen = handler.length; i < iLen; i++) {
                    invokeHandler(handler[i], vnode, event);
                }
            }
        }
    }
    function handleEvent(event, vnode) {
        var name = event.type, on = vnode.data.on;
        // call event handler(s) if exists
        if (on && on[name]) {
            invokeHandler(on[name], vnode, event);
        }
    }
    function createListener() {
        return function handler(event) {
            handleEvent(event, handler.vnode);
        };
    }
    function updateEventListeners(oldVnode, vnode) {
        var oldOn = oldVnode.data.on, oldListener = oldVnode.listener, oldElm = oldVnode.elm, on = vnode && vnode.data.on, elm = (vnode && vnode.elm), name;
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
                    oldElm.removeEventListener(name, oldListener, false);
                }
            }
            else {
                for (name in oldOn) {
                    // remove listener if existing listener removed
                    if (!on[name]) {
                        oldElm.removeEventListener(name, oldListener, false);
                    }
                }
            }
        }
        // add new listeners which has not already attached
        if (on) {
            // reuse existing listener or create new
            var listener = (vnode.listener =
                oldVnode.listener || createListener());
            // update vnode for listener
            listener.vnode = vnode;
            // if element changed or added we add all needed listeners unconditionally
            if (!oldOn) {
                for (name in on) {
                    // add listener if element was changed or new listeners added
                    elm.addEventListener(name, listener, false);
                }
            }
            else {
                for (name in on) {
                    // add listener if new listener added
                    if (!oldOn[name]) {
                        elm.addEventListener(name, listener, false);
                    }
                }
            }
        }
    }
    const eventListenersModule = {
        create: updateEventListeners,
        update: updateEventListeners,
        destroy: updateEventListeners
    };
    const xlinkNS = "http://www.w3.org/1999/xlink";
    const xmlNS = "http://www.w3.org/XML/1998/namespace";
    const colonChar = 58;
    const xChar = 120;
    function updateAttrs(oldVnode, vnode) {
        var key, elm = vnode.elm, oldAttrs = oldVnode.data.attrs, attrs = vnode.data.attrs;
        if (!oldAttrs && !attrs)
            return;
        if (oldAttrs === attrs)
            return;
        oldAttrs = oldAttrs || {};
        attrs = attrs || {};
        // update modified attributes, add new attributes
        for (key in attrs) {
            const cur = attrs[key];
            const old = oldAttrs[key];
            if (old !== cur) {
                if (cur === true) {
                    elm.setAttribute(key, "");
                }
                else if (cur === false) {
                    elm.removeAttribute(key);
                }
                else {
                    if (key.charCodeAt(0) !== xChar) {
                        elm.setAttribute(key, cur);
                    }
                    else if (key.charCodeAt(3) === colonChar) {
                        // Assume xml namespace
                        elm.setAttributeNS(xmlNS, key, cur);
                    }
                    else if (key.charCodeAt(5) === colonChar) {
                        // Assume xlink namespace
                        elm.setAttributeNS(xlinkNS, key, cur);
                    }
                    else {
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
    const attrsModule = {
        create: updateAttrs,
        update: updateAttrs
    };
    const patch = init([eventListenersModule, attrsModule, propsModule]);

    /**
     * Owl QWeb Expression Parser
     *
     * Owl needs in various contexts to be able to understand the structure of a
     * string representing a javascript expression.  The usual goal is to be able
     * to rewrite some variables.  For example, if a template has
     *
     *  ```xml
     *  <t t-if="computeSomething({val: state.val})">...</t>
     * ```
     *
     * this needs to be translated in something like this:
     *
     * ```js
     *   if (context["computeSomething"]({val: context["state"].val})) { ... }
     * ```
     *
     * This file contains the implementation of an extremely naive tokenizer/parser
     * and evaluator for javascript expressions.  The supported grammar is basically
     * only expressive enough to understand the shape of objects, of arrays, and
     * various operators.
     */
    //------------------------------------------------------------------------------
    // Misc types, constants and helpers
    //------------------------------------------------------------------------------
    const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(",");
    const WORD_REPLACEMENT = {
        and: "&&",
        or: "||",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<="
    };
    const STATIC_TOKEN_MAP = {
        "{": "LEFT_BRACE",
        "}": "RIGHT_BRACE",
        "[": "LEFT_BRACKET",
        "]": "RIGHT_BRACKET",
        ":": "COLON",
        ",": "COMMA",
        "(": "LEFT_PAREN",
        ")": "RIGHT_PAREN"
    };
    const OPERATORS = ".,===,==,+,!,||,&&,>=,>,<=,<,?,-,*,/,%".split(',');
    let tokenizeString = function (expr) {
        let s = expr[0];
        let start = s;
        if (s !== "'" && s !== '"') {
            return false;
        }
        let i = 1;
        let cur;
        while (expr[i] && expr[i] !== start) {
            cur = expr[i];
            s += cur;
            if (cur === "\\") {
                i++;
                cur = expr[i];
                if (!cur) {
                    throw new Error("Invalid expression");
                }
                s += cur;
            }
            i++;
        }
        if (expr[i] !== start) {
            throw new Error("Invalid expression");
        }
        s += start;
        return { type: "VALUE", value: s };
    };
    let tokenizeNumber = function (expr) {
        let s = expr[0];
        if (s && s.match(/[0-9]/)) {
            let i = 1;
            while (expr[i] && expr[i].match(/[0-9]|\./)) {
                s += expr[i];
                i++;
            }
            return { type: "VALUE", value: s };
        }
        else {
            return false;
        }
    };
    let tokenizeSymbol = function (expr) {
        let s = expr[0];
        if (s && s.match(/[a-zA-Z_\$]/)) {
            let i = 1;
            while (expr[i] && expr[i].match(/\w/)) {
                s += expr[i];
                i++;
            }
            if (s in WORD_REPLACEMENT) {
                return { type: "OPERATOR", value: WORD_REPLACEMENT[s], size: s.length };
            }
            return { type: "SYMBOL", value: s };
        }
        else {
            return false;
        }
    };
    const tokenizeStatic = function (expr) {
        const char = expr[0];
        if (char && char in STATIC_TOKEN_MAP) {
            return { type: STATIC_TOKEN_MAP[char], value: char };
        }
        return false;
    };
    const tokenizeOperator = function (expr) {
        for (let op of OPERATORS) {
            if (expr.startsWith(op)) {
                return { type: "OPERATOR", value: op };
            }
        }
        return false;
    };
    const TOKENIZERS = [
        tokenizeString,
        tokenizeNumber,
        tokenizeSymbol,
        tokenizeStatic,
        tokenizeOperator
    ];
    /**
     * Convert a javascript expression (as a string) into a list of tokens. For
     * example: `tokenize("1 + b")` will return:
     * ```js
     *  [
     *   {type: "VALUE", value: "1"},
     *   {type: "OPERATOR", value: "+"},
     *   {type: "SYMBOL", value: "b"}
     * ]
     * ```
     */
    function tokenize(expr) {
        const result = [];
        let token = true;
        while (token) {
            expr = expr.trim();
            if (expr) {
                for (let tokenizer of TOKENIZERS) {
                    token = tokenizer(expr);
                    if (token) {
                        result.push(token);
                        expr = expr.slice(token.size || token.value.length);
                        break;
                    }
                }
            }
            else {
                token = false;
            }
        }
        if (expr.length) {
            throw new Error(`Tokenizer error: could not tokenize "${expr}"`);
        }
        return result;
    }
    //------------------------------------------------------------------------------
    // Expression "evaluator"
    //------------------------------------------------------------------------------
    /**
     * This is the main function exported by this file. This is the code that will
     * process an expression (given as a string) and returns another expression with
     * proper lookups in the context.
     *
     * Usually, this kind of code would be very simple to do if we had an AST (so,
     * if we had a javascript parser), since then, we would only need to find the
     * variables and replace them.  However, a parser is more complicated, and there
     * are no standard builtin parser API.
     *
     * Since this method is applied to simple javasript expressions, and the work to
     * be done is actually quite simple, we actually can get away with not using a
     * parser, which helps with the code size.
     *
     * Here is the heuristic used by this method to determine if a token is a
     * variable:
     * - by default, all symbols are considered a variable
     * - unless the previous token is a dot (in that case, this is a property: `a.b`)
     * - or if the previous token is a left brace or a comma, and the next token is
     *   a colon (in that case, this is an object key: `{a: b}`)
     */
    function compileExpr(expr, vars) {
        const tokens = tokenize(expr);
        let result = "";
        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value)) {
                // we need to find if it is a variable
                let isVar = true;
                let prevToken = tokens[i - 1];
                if (prevToken) {
                    if (prevToken.type === "OPERATOR" && prevToken.value === ".") {
                        isVar = false;
                    }
                    else if (prevToken.type === "LEFT_BRACE" ||
                        prevToken.type === "COMMA") {
                        let nextToken = tokens[i + 1];
                        if (nextToken && nextToken.type === "COLON") {
                            isVar = false;
                        }
                    }
                }
                if (isVar) {
                    if (token.value in vars && "id" in vars[token.value]) {
                        token.value = vars[token.value].id;
                    }
                    else {
                        token.value = `context['${token.value}']`;
                    }
                }
            }
            result += token.value;
        }
        return result;
    }

    //------------------------------------------------------------------------------
    // Const/global stuff/helpers
    //------------------------------------------------------------------------------
    const DISABLED_TAGS = [
        "input",
        "textarea",
        "button",
        "select",
        "option",
        "optgroup"
    ];
    const lineBreakRE = /[\r\n]/;
    const whitespaceRE = /\s+/g;
    const DIRECTIVE_NAMES = {
        name: 1,
        att: 1,
        attf: 1,
        key: 1
    };
    const DIRECTIVES = [];
    const NODE_HOOKS_PARAMS = {
        create: "(_, n)",
        insert: "vn",
        remove: "(vn, rm)"
    };
    const UTILS = {
        h: h,
        objectToAttrString(obj) {
            let classes = [];
            for (let k in obj) {
                if (obj[k]) {
                    classes.push(k);
                }
            }
            return classes.join(" ");
        },
        shallowEqual(p1, p2) {
            for (let k in p1) {
                if (p1[k] !== p2[k]) {
                    return false;
                }
            }
            return true;
        }
    };
    function parseXML(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");
        if (doc.getElementsByTagName("parsererror").length) {
            throw new Error("Invalid XML in template");
        }
        return doc;
    }
    let nextID = 1;
    //------------------------------------------------------------------------------
    // QWeb rendering engine
    //------------------------------------------------------------------------------
    class QWeb {
        constructor(data) {
            this.templates = {};
            this.utils = UTILS;
            // the id field is useful to be able to hash qweb instances.  The current
            // use case is that component's templates are qweb dependant, and need to be
            // able to map a qweb instance to a template name.
            this.id = nextID++;
            // slots contains sub templates defined with t-set inside t-component nodes, and
            // are meant to be used by the t-slot directive.
            this.slots = {};
            this.nextSlotId = 1;
            if (data) {
                this.addTemplates(data);
            }
        }
        static addDirective(directive) {
            DIRECTIVES.push(directive);
            DIRECTIVE_NAMES[directive.name] = 1;
            DIRECTIVES.sort((d1, d2) => d1.priority - d2.priority);
            if (directive.extraNames) {
                directive.extraNames.forEach(n => (DIRECTIVE_NAMES[n] = 1));
            }
        }
        static register(name, Component) {
            if (QWeb.components[name]) {
                throw new Error(`Component '${name}' has already been registered`);
            }
            QWeb.components[name] = Component;
        }
        /**
         * Add a template to the internal template map.  Note that it is not
         * immediately compiled.
         */
        addTemplate(name, xmlString) {
            const doc = parseXML(xmlString);
            if (!doc.firstChild) {
                throw new Error("Invalid template (should not be empty)");
            }
            this._addTemplate(name, doc.firstChild);
        }
        /**
         * Load templates from a xml (as a string).  This will look up for the first
         * <templates> tag, and will consider each child of this as a template, with
         * the name given by the t-name attribute.
         */
        addTemplates(xmlstr) {
            const doc = parseXML(xmlstr);
            const templates = doc.getElementsByTagName("templates")[0];
            if (!templates) {
                return;
            }
            for (let elem of templates.children) {
                const name = elem.getAttribute("t-name");
                this._addTemplate(name, elem);
            }
        }
        _addTemplate(name, elem) {
            if (name in this.templates) {
                throw new Error(`Template ${name} already defined`);
            }
            this._processTemplate(elem);
            const template = {
                elem,
                fn: (context, extra) => {
                    const compiledFunction = this._compile(name, elem);
                    template.fn = compiledFunction;
                    return compiledFunction.call(this, context, extra);
                }
            };
            this.templates[name] = template;
        }
        _processTemplate(elem) {
            let tbranch = elem.querySelectorAll("[t-elif], [t-else]");
            for (let i = 0, ilen = tbranch.length; i < ilen; i++) {
                let node = tbranch[i];
                let prevElem = node.previousElementSibling;
                let pattr = function (name) {
                    return prevElem.getAttribute(name);
                };
                let nattr = function (name) {
                    return +!!node.getAttribute(name);
                };
                if (prevElem && (pattr("t-if") || pattr("t-elif"))) {
                    if (pattr("t-foreach")) {
                        throw new Error("t-if cannot stay at the same level as t-foreach when using t-elif or t-else");
                    }
                    if (["t-if", "t-elif", "t-else"].map(nattr).reduce(function (a, b) {
                        return a + b;
                    }) > 1) {
                        throw new Error("Only one conditional branching directive is allowed per node");
                    }
                    // All text nodes between branch nodes are removed
                    let textNode;
                    while ((textNode = node.previousSibling) !== prevElem) {
                        if (textNode.nodeValue.trim().length) {
                            throw new Error("text is not allowed between branching directives");
                        }
                        textNode.remove();
                    }
                }
                else {
                    throw new Error("t-elif and t-else directives must be preceded by a t-if or t-elif directive");
                }
            }
        }
        /**
         * Render a template
         *
         * @param {string} name the template should already have been added
         */
        render(name, context = {}, extra = null) {
            const template = this.templates[name];
            if (!template) {
                throw new Error(`Template ${name} does not exist`);
            }
            return template.fn.call(this, context, extra);
        }
        _compile(name, elem) {
            const isDebug = elem.attributes.hasOwnProperty("t-debug");
            const ctx = new Context(name);
            this._compileNode(elem, ctx);
            if (ctx.shouldProtectContext) {
                ctx.code.unshift("    context = Object.create(context);");
            }
            if (ctx.shouldDefineOwner) {
                // this is necessary to prevent some directives (t-forach for ex) to
                // pollute the rendering context by adding some keys in it.
                ctx.code.unshift("    let owner = context;");
            }
            if (ctx.shouldDefineQWeb) {
                ctx.code.unshift("    let QWeb = this.constructor;");
            }
            if (ctx.shouldDefineUtils) {
                ctx.code.unshift("    let utils = this.utils;");
            }
            if (!ctx.rootNode) {
                throw new Error("A template should have one root node");
            }
            ctx.addLine(`return vn${ctx.rootNode};`);
            let template;
            try {
                template = new Function("context", "extra", ctx.code.join("\n"));
            }
            catch (e) {
                const templateName = ctx.templateName.replace(/`/g, "'");
                console.groupCollapsed(`Invalid Code generated by ${templateName}`);
                console.warn(ctx.code.join("\n"));
                console.groupEnd();
                throw new Error(`Invalid generated code while compiling template '${templateName}': ${e.message}`);
            }
            if (isDebug) {
                console.log(`Template: ${this.templates[name].elem.outerHTML}\nCompiled code:\n` +
                    template.toString());
            }
            return template;
        }
        /**
         * Generate code from an xml node
         *
         */
        _compileNode(node, ctx) {
            if (!(node instanceof Element)) {
                // this is a text node, there are no directive to apply
                let text = node.textContent;
                if (!ctx.inPreTag) {
                    if (lineBreakRE.test(text) && !text.trim()) {
                        return;
                    }
                    text = text.replace(whitespaceRE, " ");
                }
                if (ctx.parentNode) {
                    ctx.addLine(`c${ctx.parentNode}.push({text: \`${text}\`});`);
                }
                else if (ctx.parentTextNode) {
                    ctx.addLine(`vn${ctx.parentTextNode}.text += \`${text}\`;`);
                }
                else {
                    // this is an unusual situation: this text node is the result of the
                    // template rendering.
                    let nodeID = ctx.generateID();
                    ctx.addLine(`var vn${nodeID} = {text: \`${text}\`};`);
                    ctx.rootContext.rootNode = nodeID;
                    ctx.rootContext.parentTextNode = nodeID;
                }
                return;
            }
            const firstLetter = node.tagName[0];
            if (firstLetter === firstLetter.toUpperCase()) {
                // this is a component, we modify in place the xml document to change
                // <SomeComponent ... /> to <t t-component="SomeComponent" ... />
                node.setAttribute('t-component', node.tagName);
                node.nodeValue = 't';
            }
            const attributes = node.attributes;
            const validDirectives = [];
            let withHandlers = false;
            // maybe this is not optimal: we iterate on all attributes here, and again
            // just after for each directive.
            for (let i = 0; i < attributes.length; i++) {
                let attrName = attributes[i].name;
                if (attrName.startsWith("t-")) {
                    let dName = attrName.slice(2).split(/-|\./)[0];
                    if (!(dName in DIRECTIVE_NAMES)) {
                        throw new Error(`Unknown QWeb directive: '${attrName}'`);
                    }
                }
            }
            const DIR_N = DIRECTIVES.length;
            const ATTR_N = attributes.length;
            for (let i = 0; i < DIR_N; i++) {
                let directive = DIRECTIVES[i];
                let fullName;
                let value;
                for (let j = 0; j < ATTR_N; j++) {
                    const name = attributes[j].name;
                    if (name === "t-" + directive.name ||
                        name.startsWith("t-" + directive.name + "-") ||
                        name.startsWith("t-" + directive.name + ".")) {
                        fullName = name;
                        value = attributes[j].textContent;
                        validDirectives.push({ directive, value, fullName });
                        if (directive.name === "on" || directive.name === 'model') {
                            withHandlers = true;
                        }
                    }
                }
            }
            for (let { directive, value, fullName } of validDirectives) {
                if (directive.atNodeEncounter) {
                    const isDone = directive.atNodeEncounter({
                        node,
                        qweb: this,
                        ctx,
                        fullName,
                        value
                    });
                    if (isDone) {
                        return;
                    }
                }
            }
            if (node.nodeName !== "t") {
                let nodeID = this._compileGenericNode(node, ctx, withHandlers);
                ctx = ctx.withParent(nodeID);
                let nodeHooks = {};
                let addNodeHook = function (hook, handler) {
                    nodeHooks[hook] = nodeHooks[hook] || [];
                    nodeHooks[hook].push(handler);
                };
                for (let { directive, value, fullName } of validDirectives) {
                    if (directive.atNodeCreation) {
                        directive.atNodeCreation({
                            node,
                            qweb: this,
                            ctx,
                            fullName,
                            value,
                            nodeID,
                            addNodeHook
                        });
                    }
                }
                if (Object.keys(nodeHooks).length) {
                    ctx.addLine(`p${nodeID}.hook = {`);
                    for (let hook in nodeHooks) {
                        ctx.addLine(`  ${hook}: ${NODE_HOOKS_PARAMS[hook]} => {`);
                        for (let handler of nodeHooks[hook]) {
                            ctx.addLine(`    ${handler}`);
                        }
                        ctx.addLine(`  },`);
                    }
                    ctx.addLine(`};`);
                }
            }
            if (node.nodeName === "pre") {
                ctx = ctx.subContext("inPreTag", true);
            }
            this._compileChildren(node, ctx);
            for (let { directive, value, fullName } of validDirectives) {
                if (directive.finalize) {
                    directive.finalize({ node, qweb: this, ctx, fullName, value });
                }
            }
        }
        _compileGenericNode(node, ctx, withHandlers = true) {
            // nodeType 1 is generic tag
            if (node.nodeType !== 1) {
                throw new Error("unsupported node type");
            }
            const attributes = node.attributes;
            const attrs = [];
            const props = [];
            const tattrs = [];
            function handleBooleanProps(key, val) {
                let isProp = false;
                if (node.nodeName === "input" && key === "checked") {
                    let type = node.getAttribute("type");
                    if (type === "checkbox" || type === "radio") {
                        isProp = true;
                    }
                }
                if (node.nodeName === "option" && key === "selected") {
                    isProp = true;
                }
                if (key === "disabled" && DISABLED_TAGS.indexOf(node.nodeName) > -1) {
                    isProp = true;
                }
                if ((key === "readonly" && node.nodeName === "input") ||
                    node.nodeName === "textarea") {
                    isProp = true;
                }
                if (isProp) {
                    props.push(`${key}: _${val}`);
                }
            }
            for (let i = 0; i < attributes.length; i++) {
                let name = attributes[i].name;
                const value = attributes[i].textContent;
                // regular attributes
                if (!name.startsWith("t-") &&
                    !node.getAttribute("t-attf-" + name)) {
                    const attID = ctx.generateID();
                    ctx.addLine(`var _${attID} = '${value}';`);
                    if (!name.match(/^[a-zA-Z]+$/)) {
                        // attribute contains 'non letters' => we want to quote it
                        name = '"' + name + '"';
                    }
                    attrs.push(`${name}: _${attID}`);
                    handleBooleanProps(name, attID);
                }
                // dynamic attributes
                if (name.startsWith("t-att-")) {
                    let attName = name.slice(6);
                    const v = ctx.getValue(value);
                    let formattedValue = v.id || ctx.formatExpression(v);
                    if (formattedValue[0] === "{" &&
                        formattedValue[formattedValue.length - 1] === "}") {
                        formattedValue = `this.utils.objectToAttrString(${formattedValue})`;
                    }
                    const attID = ctx.generateID();
                    if (!attName.match(/^[a-zA-Z]+$/)) {
                        // attribute contains 'non letters' => we want to quote it
                        attName = '"' + attName + '"';
                    }
                    // we need to combine dynamic with non dynamic attributes:
                    // class="a" t-att-class="'yop'" should be rendered as class="a yop"
                    const attValue = node.getAttribute(attName);
                    if (attValue) {
                        const attValueID = ctx.generateID();
                        ctx.addLine(`var _${attValueID} = ${formattedValue};`);
                        formattedValue = `'${attValue}' + (_${attValueID} ? ' ' + _${attValueID} : '')`;
                        const attrIndex = attrs.findIndex(att => att.startsWith(attName + ":"));
                        attrs.splice(attrIndex, 1);
                    }
                    ctx.addLine(`var _${attID} = ${formattedValue};`);
                    attrs.push(`${attName}: _${attID}`);
                    handleBooleanProps(attName, attID);
                }
                if (name.startsWith("t-attf-")) {
                    let attName = name.slice(7);
                    if (!attName.match(/^[a-zA-Z]+$/)) {
                        // attribute contains 'non letters' => we want to quote it
                        attName = '"' + attName + '"';
                    }
                    const formattedExpr = ctx.interpolate(value);
                    const attID = ctx.generateID();
                    let staticVal = node.getAttribute(attName);
                    if (staticVal) {
                        ctx.addLine(`var _${attID} = '${staticVal} ' + ${formattedExpr};`);
                    }
                    else {
                        ctx.addLine(`var _${attID} = ${formattedExpr};`);
                    }
                    attrs.push(`${attName}: _${attID}`);
                }
                // t-att= attributes
                if (name === "t-att") {
                    let id = ctx.generateID();
                    ctx.addLine(`var _${id} = ${ctx.formatExpression(value)};`);
                    tattrs.push(id);
                }
            }
            let nodeID = ctx.generateID();
            let nodeKey = node.getAttribute("t-key");
            if (nodeKey) {
                nodeKey = ctx.formatExpression(nodeKey);
            }
            else {
                nodeKey = nodeID;
            }
            const parts = [`key:${nodeKey}`];
            if (attrs.length + tattrs.length > 0) {
                parts.push(`attrs:{${attrs.join(",")}}`);
            }
            if (props.length > 0) {
                parts.push(`props:{${props.join(",")}}`);
            }
            if (withHandlers) {
                parts.push(`on:{}`);
            }
            ctx.addLine(`let c${nodeID} = [], p${nodeID} = {${parts.join(",")}};`);
            for (let id of tattrs) {
                ctx.addIf(`_${id} instanceof Array`);
                ctx.addLine(`p${nodeID}.attrs[_${id}[0]] = _${id}[1];`);
                ctx.addElse();
                ctx.addLine(`for (let key in _${id}) {`);
                ctx.indent();
                ctx.addLine(`p${nodeID}.attrs[key] = _${id}[key];`);
                ctx.dedent();
                ctx.addLine(`}`);
                ctx.closeIf();
            }
            ctx.addLine(`var vn${nodeID} = h('${node.nodeName}', p${nodeID}, c${nodeID});`);
            if (ctx.parentNode) {
                ctx.addLine(`c${ctx.parentNode}.push(vn${nodeID});`);
            }
            return nodeID;
        }
        _compileChildren(node, ctx) {
            if (node.childNodes.length > 0) {
                for (let child of Array.from(node.childNodes)) {
                    this._compileNode(child, ctx);
                }
            }
        }
    }
    QWeb.components = Object.create(null);
    // dev mode enables better error messages or more costly validations
    QWeb.dev = false;
    //------------------------------------------------------------------------------
    // Compilation Context
    //------------------------------------------------------------------------------
    class Context {
        constructor(name) {
            this.nextID = 1;
            this.code = [];
            this.variables = {};
            this.escaping = false;
            this.parentNode = null;
            this.parentTextNode = null;
            this.rootNode = null;
            this.indentLevel = 0;
            this.shouldDefineOwner = false;
            this.shouldDefineQWeb = false;
            this.shouldDefineUtils = false;
            this.shouldProtectContext = false;
            this.inLoop = false;
            this.inPreTag = false;
            this.rootContext = this;
            this.templateName = name || "noname";
            this.addLine("var h = this.utils.h;");
        }
        generateID() {
            const id = this.rootContext.nextID++;
            return id;
        }
        withParent(node) {
            if (this === this.rootContext && (this.parentNode || this.parentTextNode)) {
                throw new Error("A template should not have more than one root node");
            }
            if (!this.rootContext.rootNode) {
                this.rootContext.rootNode = node;
            }
            return this.subContext("parentNode", node);
        }
        subContext(key, value) {
            const newContext = Object.create(this);
            newContext[key] = value;
            return newContext;
        }
        indent() {
            this.indentLevel++;
        }
        dedent() {
            this.indentLevel--;
        }
        addLine(line) {
            const prefix = new Array(this.indentLevel + 2).join("    ");
            this.code.push(prefix + line);
        }
        addIf(condition) {
            this.addLine(`if (${condition}) {`);
            this.indent();
        }
        addElse() {
            this.dedent();
            this.addLine("} else {");
            this.indent();
        }
        closeIf() {
            this.dedent();
            this.addLine("}");
        }
        getValue(val) {
            return val in this.variables ? this.getValue(this.variables[val]) : val;
        }
        /**
         * Prepare an expression for being consumed at render time.  Its main job
         * is to
         * - replace unknown variables by a lookup in the context
         * - replace already defined variables by their internal name
         */
        formatExpression(expr) {
            return compileExpr(expr, this.variables);
        }
        /**
         * Perform string interpolation on the given string. Note that if the whole
         * string is an expression, it simply returns it (formatted and enclosed in
         * parentheses).
         * For instance:
         *   'Hello {{x}}!' -> `Hello ${x}`
         *   '{{x ? 'a': 'b'}}' -> (x ? 'a' : 'b')
         */
        interpolate(s) {
            let matches = s.match(/\{\{.*?\}\}/g);
            if (matches && matches[0].length === s.length) {
                return `(${this.formatExpression(s.slice(2, -2))})`;
            }
            let r = s.replace(/\{\{.*?\}\}/g, s => "${" + this.formatExpression(s.slice(2, -2)) + "}");
            return "`" + r + "`";
        }
    }

    // If a component does not define explicitely a template
    // key, it needs to find a template with its name (or a parent's).  This is
    // qweb dependant, so we need a place to store this information indexed by
    // qweb instances.
    const TEMPLATE_MAP = {};
    //------------------------------------------------------------------------------
    // Component
    //------------------------------------------------------------------------------
    let nextId = 1;
    class Component {
        //--------------------------------------------------------------------------
        // Lifecycle
        //--------------------------------------------------------------------------
        /**
         * Creates an instance of Component.
         *
         * The root component of a component tree needs an environment:
         *
         * ```javascript
         *   const root = new RootComponent(env, props);
         * ```
         *
         * Every other component simply needs a reference to its parent:
         *
         * ```javascript
         *   const child = new SomeComponent(parent, props);
         * ```
         *
         * Note that most of the time, only the root component needs to be created by
         * hand.  Other components should be created automatically by the framework (with
         * the t-component directive in a template)
         */
        constructor(parent, props) {
            this.refs = {};
            const defaultProps = this.constructor.defaultProps;
            if (defaultProps) {
                props = this._applyDefaultProps(props, defaultProps);
            }
            if (QWeb.dev) {
                this._validateProps(props || {});
            }
            // is this a good idea?
            //   Pro: if props is empty, we can create easily a component
            //   Con: this is not really safe
            //   Pro: but creating component (by a template) is always unsafe anyway
            this.props = props || {};
            let id = nextId++;
            let p = null;
            if (parent instanceof Component) {
                p = parent;
                this.env = parent.env;
                parent.__owl__.children[id] = this;
            }
            else {
                this.env = parent;
            }
            this.__owl__ = {
                id: id,
                vnode: null,
                isMounted: false,
                isDestroyed: false,
                parent: p,
                children: {},
                cmap: {},
                renderId: 1,
                renderPromise: null,
                renderProps: props || null,
                boundHandlers: {},
                mountedHandlers: {}
            };
        }
        /**
         * The `el` is the root element of the component.  Note that it could be null:
         * this is the case if the component is not mounted yet, or is destroyed.
         */
        get el() {
            return this.__owl__.vnode ? this.__owl__.vnode.elm : null;
        }
        /**
         * willStart is an asynchronous hook that can be implemented to perform some
         * action before the initial rendering of a component.
         *
         * It will be called exactly once before the initial rendering. It is useful
         * in some cases, for example, to load external assets (such as a JS library)
         * before the component is rendered.
         *
         * Note that a slow willStart method will slow down the rendering of the user
         * interface.  Therefore, some effort should be made to make this method as
         * fast as possible.
         *
         * Note: this method should not be called manually.
         */
        async willStart() { }
        /**
         * mounted is a hook that is called each time a component is attached to the
         * DOM. This is a good place to add some listeners, or to interact with the
         * DOM, if the component needs to perform some measure for example.
         *
         * Note: this method should not be called manually.
         *
         * @see willUnmount
         */
        mounted() { }
        /**
         * The willUpdateProps is an asynchronous hook, called just before new props
         * are set. This is useful if the component needs some asynchronous task
         * performed, depending on the props (for example, assuming that the props are
         * some record Id, fetching the record data).
         *
         * This hook is not called during the first render (but willStart is called
         * and performs a similar job).
         */
        async willUpdateProps(nextProps) { }
        /**
         * The willPatch hook is called just before the DOM patching process starts.
         * It is not called on the initial render.  This is useful to get some
         * information which are in the DOM.  For example, the current position of the
         * scrollbar
         *
         * The return value of willPatch will be given to the patched function.
         */
        willPatch() { }
        /**
         * This hook is called whenever a component did actually update its props,
         * state or env.
         *
         * This method is not called on the initial render. It is useful to interact
         * with the DOM (for example, through an external library) whenever the
         * component was updated.
         *
         * Updating the component state in this hook is possible, but not encouraged.
         * One need to be careful, because updates here will cause rerender, which in
         * turn will cause other calls to updated. So, we need to be particularly
         * careful at avoiding endless cycles.
         *
         * The snapshot parameter is the result of the call to willPatch.
         */
        patched(snapshot) { }
        /**
         * willUnmount is a hook that is called each time just before a component is
         * unmounted from the DOM. This is a good place to remove some listeners, for
         * example.
         *
         * Note: this method should not be called manually.
         *
         * @see mounted
         */
        willUnmount() { }
        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------
        /**
         * Mount the component to a target element.
         *
         * This should only be done if the component was created manually. Components
         * created declaratively in templates are managed by the Owl system.
         */
        async mount(target) {
            const vnode = await this._prepare();
            if (this.__owl__.isDestroyed) {
                // component was destroyed before we get here...
                return;
            }
            this._patch(vnode);
            target.appendChild(this.el);
            if (document.body.contains(target)) {
                this._callMounted();
            }
        }
        unmount() {
            if (this.__owl__.isMounted) {
                this._callWillUnmount();
                this.el.remove();
            }
        }
        async render(force = false, patchQueue) {
            const __owl__ = this.__owl__;
            if (!__owl__.isMounted) {
                return;
            }
            const shouldPatch = !patchQueue;
            if (shouldPatch) {
                patchQueue = [];
            }
            const renderVDom = this._render(force, patchQueue);
            const renderId = __owl__.renderId;
            await renderVDom;
            if (shouldPatch && __owl__.isMounted && renderId === __owl__.renderId) {
                // we only update the vnode and the actual DOM if no other rendering
                // occurred between now and when the render method was initially called.
                this._applyPatchQueue(patchQueue);
            }
        }
        /**
         * Destroy the component.  This operation is quite complex:
         *  - it recursively destroy all children
         *  - call the willUnmount hooks if necessary
         *  - remove the dom node from the dom
         *
         * This should only be called manually if you created the component.  Most
         * components will be automatically destroyed.
         */
        destroy() {
            const __owl__ = this.__owl__;
            if (!__owl__.isDestroyed) {
                const el = this.el;
                this._destroy(__owl__.parent);
                if (el) {
                    el.remove();
                }
            }
        }
        /**
         * This method is called by the component system whenever its props are
         * updated. If it returns true, then the component will be rendered.
         * Otherwise, it will skip the rendering (also, its props will not be updated)
         */
        shouldUpdate(nextProps) {
            return true;
        }
        /**
         * This method is the correct way to update the environment of a component. Doing
         * this will cause a full rerender of the component and its children, so this is
         * an operation that should not be done frequently.
         *
         * A good usecase for updating the environment would be to update some mostly
         * static config keys, such as a boolean to determine if we are in mobile
         * mode or not.
         */
        async updateEnv(nextEnv) {
            const __owl__ = this.__owl__;
            if (__owl__.parent && __owl__.parent.env === this.env) {
                this.env = Object.create(this.env);
            }
            Object.assign(this.env, nextEnv);
            if (__owl__.isMounted) {
                await this.render(true);
            }
        }
        /**
         * Emit a custom event of type 'eventType' with the given 'payload' on the
         * component's el, if it exists. However, note that the event will only bubble
         * up to the parent DOM nodes. Thus, it must be called between mounted() and
         * willUnmount().
         */
        trigger(eventType, payload) {
            if (this.el) {
                const ev = new CustomEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    detail: payload
                });
                this.el.dispatchEvent(ev);
            }
        }
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        _destroy(parent) {
            const __owl__ = this.__owl__;
            const isMounted = __owl__.isMounted;
            if (isMounted) {
                this.willUnmount();
                __owl__.isMounted = false;
            }
            const children = __owl__.children;
            for (let key in children) {
                children[key]._destroy(this);
            }
            if (parent) {
                let id = __owl__.id;
                delete parent.__owl__.children[id];
                __owl__.parent = null;
            }
            __owl__.isDestroyed = true;
            delete __owl__.vnode;
        }
        _callMounted() {
            const __owl__ = this.__owl__;
            const children = __owl__.children;
            for (let id in children) {
                const comp = children[id];
                if (!comp.__owl__.isMounted && this.el.contains(comp.el)) {
                    comp._callMounted();
                }
            }
            __owl__.isMounted = true;
            const handlers = __owl__.mountedHandlers;
            for (let key in handlers) {
                handlers[key]();
            }
            this.mounted();
        }
        _callWillUnmount() {
            this.willUnmount();
            const __owl__ = this.__owl__;
            __owl__.isMounted = false;
            const children = __owl__.children;
            for (let id in children) {
                const comp = children[id];
                if (comp.__owl__.isMounted) {
                    comp._callWillUnmount();
                }
            }
        }
        async _updateProps(nextProps, forceUpdate = false, patchQueue) {
            const shouldUpdate = forceUpdate || this.shouldUpdate(nextProps);
            if (shouldUpdate) {
                const defaultProps = this.constructor.defaultProps;
                if (defaultProps) {
                    nextProps = this._applyDefaultProps(nextProps, defaultProps);
                }
                if (QWeb.dev) {
                    this._validateProps(nextProps);
                }
                await this.willUpdateProps(nextProps);
                this.props = nextProps;
                await this.render(forceUpdate, patchQueue);
            }
        }
        _patch(vnode) {
            const __owl__ = this.__owl__;
            __owl__.renderPromise = null;
            const target = __owl__.vnode || document.createElement(vnode.sel);
            __owl__.vnode = patch(target, vnode);
        }
        _prepare() {
            const __owl__ = this.__owl__;
            __owl__.renderProps = this.props;
            __owl__.renderPromise = this._prepareAndRender();
            return __owl__.renderPromise;
        }
        async _prepareAndRender() {
            await this.willStart();
            const __owl__ = this.__owl__;
            if (__owl__.isDestroyed) {
                return Promise.resolve(h("div"));
            }
            const qweb = this.env.qweb;
            if (!this.template) {
                let tmap = TEMPLATE_MAP[qweb.id];
                if (!tmap) {
                    tmap = {};
                    TEMPLATE_MAP[qweb.id] = tmap;
                }
                let p = this.constructor;
                let name = p.name;
                let template = tmap[name];
                if (template) {
                    this.template = template;
                }
                else {
                    while ((template = p.name) &&
                        !(template in qweb.templates) &&
                        p !== Component) {
                        p = p.__proto__;
                    }
                    if (p === Component) {
                        throw new Error(`Could not find template for component "${this.constructor.name}"`);
                    }
                    else {
                        tmap[name] = template;
                        this.template = template;
                    }
                }
            }
            __owl__.render = qweb.render.bind(qweb, this.template);
            this._observeState();
            return this._render();
        }
        async _render(force = false, patchQueue = []) {
            const __owl__ = this.__owl__;
            __owl__.renderId++;
            const promises = [];
            const patch = [this];
            if (__owl__.isMounted) {
                patchQueue.push(patch);
            }
            if (__owl__.observer) {
                __owl__.observer.allowMutations = false;
            }
            let vnode = __owl__.render(this, {
                promises,
                handlers: __owl__.boundHandlers,
                mountedHandlers: __owl__.mountedHandlers,
                forceUpdate: force,
                patchQueue
            });
            patch.push(vnode);
            if (__owl__.observer) {
                __owl__.observer.allowMutations = true;
            }
            // this part is critical for the patching process to be done correctly. The
            // tricky part is that a child component can be rerendered on its own, which
            // will update its own vnode representation without the knowledge of the
            // parent component.  With this, we make sure that the parent component will be
            // able to patch itself properly after
            vnode.key = __owl__.id;
            __owl__.renderProps = this.props;
            __owl__.renderPromise = Promise.all(promises).then(() => vnode);
            return __owl__.renderPromise;
        }
        /**
         * Only called by qweb t-component directive
         */
        _mount(vnode, elm) {
            const __owl__ = this.__owl__;
            __owl__.vnode = patch(elm, vnode);
            if (__owl__.parent.__owl__.isMounted && !__owl__.isMounted) {
                this._callMounted();
            }
            return __owl__.vnode;
        }
        /**
         * Only called by qweb t-component directive (when t-keepalive is set)
         */
        _remount() {
            const __owl__ = this.__owl__;
            if (!__owl__.isMounted) {
                __owl__.isMounted = true;
                this.mounted();
            }
        }
        _observeState() {
            if (this.state) {
                const __owl__ = this.__owl__;
                __owl__.observer = new Observer();
                __owl__.observer.observe(this.state);
                __owl__.observer.notifyCB = this.render.bind(this);
            }
        }
        /**
         * Apply default props (only top level).
         *
         * Note that this method does not modify in place the props, it returns a new
         * prop object
         */
        _applyDefaultProps(props, defaultProps) {
            props = props ? Object.create(props) : {};
            for (let propName in defaultProps) {
                if (props[propName] === undefined) {
                    props[propName] = defaultProps[propName];
                }
            }
            return props;
        }
        /**
         * Apply the given patch queue. A patch is a pair [c, vn], where c is a
         * Component instance and vn a VNode.
         *   1) Call 'willPatch' on the component of each patch
         *   2) Call '_patch' on the component of each patch
         *   3) Call 'patched' on the component of each patch, in inverse order
         */
        _applyPatchQueue(patchQueue) {
            const patchLen = patchQueue.length;
            for (let i = 0; i < patchLen; i++) {
                const patch = patchQueue[i];
                patch.push(patch[0].willPatch());
            }
            for (let i = 0; i < patchLen; i++) {
                const patch = patchQueue[i];
                patch[0]._patch(patch[1]);
            }
            for (let i = patchLen - 1; i >= 0; i--) {
                const patch = patchQueue[i];
                patch[0].patched(patch[2]);
            }
        }
        /**
         * Validate the component props (or next props) against the (static) props
         * description.  This is potentially an expensive operation: it may needs to
         * visit recursively the props and all the children to check if they are valid.
         * This is why it is only done in 'dev' mode.
         */
        _validateProps(props) {
            const propsDef = this.constructor.props;
            if (propsDef instanceof Array) {
                // list of strings (prop names)
                for (let i = 0, l = propsDef.length; i < l; i++) {
                    if (!(propsDef[i] in props)) {
                        throw new Error(`Missing props '${propsDef[i]}' (component '${this.constructor.name}')`);
                    }
                }
            }
            else if (propsDef) {
                // propsDef is an object now
                for (let propName in propsDef) {
                    if (!(propName in props)) {
                        if (propsDef[propName] && !propsDef[propName].optional) {
                            throw new Error(`Missing props '${propName}' (component '${this.constructor.name}')`);
                        }
                        else {
                            break;
                        }
                    }
                    let isValid = isValidProp(props[propName], propsDef[propName]);
                    if (!isValid) {
                        throw new Error(`Props '${propName}' of invalid type in component '${this.constructor.name}'`);
                    }
                }
            }
        }
    }
    //------------------------------------------------------------------------------
    // Prop validation helper
    //------------------------------------------------------------------------------
    /**
     * Check if an invidual prop value matches its (static) prop definition
     */
    function isValidProp(prop, propDef) {
        if (typeof propDef === "function") {
            // Check if a value is constructed by some Constructor.  Note that there is a
            // slight abuse of language: we want to consider primitive values as well.
            //
            // So, even though 1 is not an instance of Number, we want to consider that
            // it is valid.
            if (typeof prop === "object") {
                return prop instanceof propDef;
            }
            return typeof prop === propDef.name.toLowerCase();
        }
        else if (propDef instanceof Array) {
            // If this code is executed, this means that we want to check if a prop
            // matches at least one of its descriptor.
            let result = false;
            for (let i = 0, iLen = propDef.length; i < iLen; i++) {
                result = result || isValidProp(prop, propDef[i]);
            }
            return result;
        }
        // propsDef is an object
        let result = isValidProp(prop, propDef.type);
        if (propDef.type === Array) {
            for (let i = 0, iLen = prop.length; i < iLen; i++) {
                result = result && isValidProp(prop[i], propDef.element);
            }
        }
        if (propDef.type === Object) {
            const shape = propDef.shape;
            for (let key in shape) {
                result = result && isValidProp(prop[key], shape[key]);
            }
        }
        return result;
    }

    /**
     * We define here a simple event bus: it can
     * - emit events
     * - add/remove listeners.
     *
     * This is a useful pattern of communication in many cases.  For OWL, each
     * components and stores are event buses.
     */
    //------------------------------------------------------------------------------
    // EventBus
    //------------------------------------------------------------------------------
    class EventBus {
        constructor() {
            this.subscriptions = {};
        }
        /**
         * Add a listener for the 'eventType' events.
         *
         * Note that the 'owner' of this event can be anything, but will more likely
         * be a component or a class. The idea is that the callback will be called with
         * the proper owner bound.
         *
         * Also, the owner should be kind of unique. This will be used to remove the
         * listener.
         */
        on(eventType, owner, callback) {
            if (!callback) {
                throw new Error("Missing callback");
            }
            if (!this.subscriptions[eventType]) {
                this.subscriptions[eventType] = [];
            }
            this.subscriptions[eventType].push({
                owner,
                callback
            });
        }
        /**
         * Remove a listener
         */
        off(eventType, owner) {
            const subs = this.subscriptions[eventType];
            if (subs) {
                this.subscriptions[eventType] = subs.filter(s => s.owner !== owner);
            }
        }
        /**
         * Emit an event of type 'eventType'.  Any extra arguments will be passed to
         * the listeners callback.
         */
        trigger(eventType, ...args) {
            const subs = this.subscriptions[eventType] || [];
            for (let i = 0, iLen = subs.length; i < iLen; i++) {
                const sub = subs[i];
                sub.callback.call(sub.owner, ...args);
            }
        }
        /**
         * Remove all subscriptions.
         */
        clear() {
            this.subscriptions = {};
        }
    }

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
    UTILS.getFragment = function (str) {
        const temp = document.createElement("template");
        temp.innerHTML = str;
        return temp.content;
    };
    function compileValueNode(value, node, qweb, ctx) {
        if (value === "0" && ctx.caller) {
            qweb._compileNode(ctx.caller, ctx);
            return;
        }
        if (value.xml instanceof NodeList) {
            for (let node of Array.from(value.xml)) {
                qweb._compileNode(node, ctx);
            }
            return;
        }
        let exprID;
        if (typeof value === "string") {
            exprID = `_${ctx.generateID()}`;
            ctx.addLine(`var ${exprID} = ${ctx.formatExpression(value)};`);
        }
        else {
            exprID = value.id;
        }
        ctx.addIf(`${exprID} || ${exprID} === 0`);
        if (ctx.escaping) {
            if (ctx.parentTextNode) {
                ctx.addLine(`vn${ctx.parentTextNode}.text += ${exprID};`);
            }
            else if (ctx.parentNode) {
                ctx.addLine(`c${ctx.parentNode}.push({text: ${exprID}});`);
            }
            else {
                let nodeID = ctx.generateID();
                ctx.rootContext.rootNode = nodeID;
                ctx.rootContext.parentTextNode = nodeID;
                ctx.addLine(`var vn${nodeID} = {text: ${exprID}};`);
            }
        }
        else {
            let fragID = ctx.generateID();
            ctx.addLine(`var frag${fragID} = this.utils.getFragment(${exprID})`);
            let tempNodeID = ctx.generateID();
            ctx.addLine(`var p${tempNodeID} = {hook: {`);
            ctx.addLine(`  insert: n => n.elm.parentNode.replaceChild(frag${fragID}, n.elm),`);
            ctx.addLine(`}};`);
            ctx.addLine(`var vn${tempNodeID} = h('div', p${tempNodeID})`);
            ctx.addLine(`c${ctx.parentNode}.push(vn${tempNodeID});`);
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
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                let nodeID = qweb._compileGenericNode(node, ctx);
                ctx = ctx.withParent(nodeID);
            }
            let value = ctx.getValue(node.getAttribute("t-esc"));
            compileValueNode(value, node, qweb, ctx.subContext("escaping", true));
            return true;
        }
    });
    QWeb.addDirective({
        name: "raw",
        priority: 80,
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                let nodeID = qweb._compileGenericNode(node, ctx);
                ctx = ctx.withParent(nodeID);
            }
            let value = ctx.getValue(node.getAttribute("t-raw"));
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
        atNodeEncounter({ node, ctx }) {
            const variable = node.getAttribute("t-set");
            let value = node.getAttribute("t-value");
            if (value) {
                const formattedValue = ctx.formatExpression(value);
                if (ctx.variables.hasOwnProperty(variable)) {
                    ctx.addLine(`${ctx.variables[variable].id} = ${formattedValue}`);
                }
                else {
                    const varName = `_${ctx.generateID()}`;
                    ctx.addLine(`var ${varName} = ${formattedValue};`);
                    ctx.variables[variable] = {
                        id: varName,
                        expr: formattedValue
                    };
                }
            }
            else {
                ctx.variables[variable] = {
                    xml: node.childNodes
                };
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
        atNodeEncounter({ node, ctx }) {
            let cond = ctx.getValue(node.getAttribute("t-if"));
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
        atNodeEncounter({ node, ctx }) {
            let cond = ctx.getValue(node.getAttribute("t-elif"));
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
        atNodeEncounter({ ctx }) {
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
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                throw new Error("Invalid tag for t-call directive (should be 't')");
            }
            const subTemplate = node.getAttribute("t-call");
            const nodeTemplate = qweb.templates[subTemplate];
            if (!nodeTemplate) {
                throw new Error(`Cannot find template "${subTemplate}" (t-call)`);
            }
            const nodeCopy = node.cloneNode(true);
            nodeCopy.removeAttribute("t-call");
            // extract variables from nodecopy
            const tempCtx = new Context();
            tempCtx.nextID = ctx.rootContext.nextID;
            qweb._compileNode(nodeCopy, tempCtx);
            const vars = Object.assign({}, ctx.variables, tempCtx.variables);
            ctx.rootContext.nextID = tempCtx.nextID;
            // open new scope, if necessary
            const hasNewVariables = Object.keys(tempCtx.variables).length > 0;
            if (hasNewVariables) {
                ctx.addLine("{");
                ctx.indent();
                // add new variables, if any
                for (let key in tempCtx.variables) {
                    const v = tempCtx.variables[key];
                    if (v.expr) {
                        ctx.addLine(`let ${v.id} = ${v.expr};`);
                    }
                    // todo: handle XML variables...
                }
            }
            // compile sub template
            const subCtx = ctx
                .subContext("caller", nodeCopy)
                .subContext("variables", Object.create(vars));
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
        atNodeEncounter({ node, qweb, ctx }) {
            ctx.rootContext.shouldProtectContext = true;
            ctx = ctx.subContext("inLoop", true);
            const elems = node.getAttribute("t-foreach");
            const name = node.getAttribute("t-as");
            let arrayID = ctx.generateID();
            ctx.addLine(`var _${arrayID} = ${ctx.formatExpression(elems)};`);
            ctx.addLine(`if (!_${arrayID}) { throw new Error('QWeb error: Invalid loop expression')}`);
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
            const nodeCopy = node.cloneNode(true);
            let shouldWarn = nodeCopy.tagName !== "t" && !nodeCopy.hasAttribute("t-key");
            if (!shouldWarn && node.tagName === "t") {
                if (node.hasAttribute("t-component") && !node.hasAttribute("t-key")) {
                    shouldWarn = true;
                }
                if (!shouldWarn &&
                    node.children.length === 1 &&
                    node.children[0].tagName !== "t" &&
                    !node.children[0].hasAttribute("t-key")) {
                    shouldWarn = true;
                }
            }
            if (shouldWarn) {
                console.warn(`Directive t-foreach should always be used with a t-key! (in template: '${ctx.templateName}')`);
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
            let handlerName = value.replace(/\(.*\)/, function (args) {
                extraArgs = args.slice(1, -1);
                return "";
            });
            ctx.addIf(`!context['${handlerName}']`);
            ctx.addLine(`throw new Error('Missing handler \\'' + '${handlerName}' + \`\\' when evaluating template '${ctx.templateName.replace(/`/g, "'")}'\`)`);
            ctx.closeIf();
            let params = extraArgs
                ? `owner, ${ctx.formatExpression(extraArgs)}`
                : "owner";
            let handler;
            if (mods.length > 0) {
                handler = `function (e) {`;
                handler += mods
                    .map(function (mod) {
                    return MODS_CODE[mod];
                })
                    .join("");
                handler += `context['${handlerName}'].call(${params}, e);}`;
            }
            else {
                handler = `context['${handlerName}'].bind(${params})`;
            }
            if (extraArgs) {
                ctx.addLine(`p${nodeID}.on['${eventName}'] = ${handler};`);
            }
            else {
                ctx.addLine(`extra.handlers['${eventName}' + ${nodeID}] = extra.handlers['${eventName}' + ${nodeID}] || ${handler};`);
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
    UTILS.nextFrame = function (cb) {
        requestAnimationFrame(() => requestAnimationFrame(cb));
    };
    UTILS.transitionInsert = function (vn, name) {
        const elm = vn.elm;
        // remove potential duplicated vnode that is currently being removed, to
        // prevent from having twice the same node in the DOM during an animation
        const dup = elm.parentElement &&
            elm.parentElement.querySelector(`*[data-owl-key='${vn.key}']`);
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
    UTILS.transitionRemove = function (vn, name, rm) {
        const elm = vn.elm;
        elm.setAttribute("data-owl-key", vn.key);
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
    function getTimeout(delays, durations) {
        /* istanbul ignore next */
        while (delays.length < durations.length) {
            delays = delays.concat(delays);
        }
        return Math.max.apply(null, durations.map((d, i) => {
            return toMs(d) + toMs(delays[i]);
        }));
    }
    // Old versions of Chromium (below 61.0.3163.100) formats floating pointer numbers
    // in a locale-dependent way, using a comma instead of a dot.
    // If comma is not replaced with a dot, the input will be rounded down (i.e. acting
    // as a floor function) causing unexpected behaviors
    function toMs(s) {
        return Number(s.slice(0, -1).replace(",", ".")) * 1000;
    }
    function whenTransitionEnd(elm, cb) {
        const styles = window.getComputedStyle(elm);
        const delays = (styles.transitionDelay || "").split(", ");
        const durations = (styles.transitionDuration || "").split(", ");
        const timeout = getTimeout(delays, durations);
        if (timeout > 0) {
            elm.addEventListener("transitionend", cb, { once: true });
        }
        else {
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
     *   // _prepare is called, to basically call willStart, then render the
     *   // component
     *   def3 = w4._prepare();
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
     *         // the _mount method will patch the component vdom into the elm vn.elm,
     *         // then call the mounted hooks. However, suprisingly, the snabbdom
     *         // patch method actually replace the elm by a new elm, so we need
     *         // to synchronise the pvnode elm with the resulting elm
     *         let nvn = w4._mount(vnode, vn.elm);
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
     *   // the call to _updateProps is the actual component update
     *   // Note that we only update the props if we cannot reuse the previous
     *   // rendering work (in the case it was rendered with the same props)
     *   def3 = def3 || w4._updateProps(props4, extra.forceUpdate, extra.patchQueue);
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
        atNodeEncounter({ ctx, value, node, qweb }) {
            ctx.addLine("//COMPONENT");
            ctx.rootContext.shouldDefineOwner = true;
            ctx.rootContext.shouldDefineQWeb = true;
            ctx.rootContext.shouldDefineUtils = true;
            let keepAlive = node.getAttribute("t-keepalive") ? true : false;
            let async = node.getAttribute("t-asyncroot") ? true : false;
            // t-on- events and t-transition
            const events = [];
            let transition = "";
            const attributes = node.attributes;
            const props = {};
            for (let i = 0; i < attributes.length; i++) {
                const name = attributes[i].name;
                const value = attributes[i].textContent;
                if (name.startsWith("t-on-")) {
                    const [eventName, ...mods] = name.slice(5).split(".");
                    let extraArgs;
                    let handlerName = value.replace(/\(.*\)/, function (args) {
                        extraArgs = args.slice(1, -1);
                        return "";
                    });
                    events.push([eventName, mods, handlerName, extraArgs]);
                }
                else if (name === "t-transition") {
                    transition = value;
                }
                else if (!name.startsWith("t-")) {
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
            let ref = node.getAttribute("t-ref");
            let refExpr = "";
            let refKey = "";
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
            let updateClassCode = "";
            if (classAttr || tattClass || styleAttr || tattStyle || events.length) {
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
                    updateClassCode = `let cl=w${componentID}.el.classList;for (let k in ${attVar}) {if (${attVar}[k]) {cl.add(k)} else {cl.remove(k)}}`;
                }
                let eventsCode = events
                    .map(function ([eventName, mods, handlerName, extraArgs]) {
                    let params = "owner";
                    if (extraArgs) {
                        if (ctx.inLoop) {
                            let argId = ctx.generateID();
                            // we need to evaluate the arguments now, because the handler will
                            // be set asynchronously later when the widget is ready, and the
                            // context might be different.
                            ctx.addLine(`let arg${argId} = ${ctx.formatExpression(extraArgs)};`);
                            params = `owner, arg${argId}`;
                        }
                        else {
                            params = `owner, ${ctx.formatExpression(extraArgs)}`;
                        }
                    }
                    let handler;
                    if (mods.length > 0) {
                        handler = `function (e) {`;
                        handler += mods
                            .map(function (mod) {
                            return T_COMPONENT_MODS_CODE[mod];
                        })
                            .join("");
                        handler += `owner['${handlerName}'].call(${params}, e);}`;
                    }
                    else {
                        handler = `owner['${handlerName}'].bind(${params})`;
                    }
                    return `vn.elm.addEventListener('${eventName}', ${handler});`;
                })
                    .join("");
                const styleExpr = tattStyle || (styleAttr ? `'${styleAttr}'` : false);
                const styleCode = styleExpr ? `vn.elm.style = ${styleExpr};` : "";
                createHook = `vnode.data.hook = {create(_, vn){${classCode}${styleCode}${eventsCode}}};`;
            }
            ctx.addLine(`let w${componentID} = ${templateID} in context.__owl__.cmap ? context.__owl__.children[context.__owl__.cmap[${templateID}]] : false;`);
            ctx.addLine(`let _${dummyID}_index = c${ctx.parentNode}.length;`);
            if (async) {
                ctx.addLine(`const patchQueue${componentID} = [];`);
                ctx.addLine(`c${ctx.parentNode}.push(w${componentID} && w${componentID}.__owl__.pvnode || null);`);
            }
            else {
                ctx.addLine(`c${ctx.parentNode}.push(null);`);
            }
            ctx.addLine(`let props${componentID} = {${propStr}};`);
            ctx.addIf(`w${componentID} && w${componentID}.__owl__.renderPromise && !w${componentID}.__owl__.vnode`);
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
            ctx.addLine(`let W${componentID} = context.components && context.components[componentKey${componentID}] || QWeb.components[componentKey${componentID}];`);
            // maybe only do this in dev mode...
            ctx.addLine(`if (!W${componentID}) {throw new Error('Cannot find the definition of component "' + componentKey${componentID} + '"')}`);
            ctx.addLine(`w${componentID} = new W${componentID}(owner, props${componentID});`);
            ctx.addLine(`context.__owl__.cmap[${templateID}] = w${componentID}.__owl__.id;`);
            // SLOTS
            if (node.childElementCount) {
                const clone = node.cloneNode(true);
                const slotNodes = clone.querySelectorAll("[t-set]");
                const slotId = qweb.nextSlotId++;
                ctx.addLine(`w${componentID}.__owl__.slotId = ${slotId};`);
                if (slotNodes.length) {
                    for (let i = 0, length = slotNodes.length; i < length; i++) {
                        const slotNode = slotNodes[i];
                        slotNode.parentElement.removeChild(slotNode);
                        const key = slotNode.getAttribute("t-set");
                        slotNode.removeAttribute("t-set");
                        const slotFn = qweb._compile(`slot_${key}_template`, slotNode);
                        qweb.slots[`${slotId}_${key}`] = slotFn.bind(qweb);
                    }
                }
                if (clone.childElementCount) {
                    const content = clone.children[0];
                    const slotFn = qweb._compile(`slot_default_template`, content);
                    qweb.slots[`${slotId}_default`] = slotFn.bind(qweb);
                }
            }
            ctx.addLine(`def${defID} = w${componentID}._prepare();`);
            // hack: specify empty remove hook to prevent the node from being removed from the DOM
            ctx.addLine(`def${defID} = def${defID}.then(vnode=>{${createHook}let pvnode=h(vnode.sel, {key: ${templateID}, hook: {insert(vn) {let nvn=w${componentID}._mount(vnode, pvnode.elm);pvnode.elm=nvn.elm;${refExpr}${transitionsInsertCode}},remove() {},destroy(vn) {${finalizeComponentCode}}}});c${ctx.parentNode}[_${dummyID}_index]=pvnode;w${componentID}.__owl__.pvnode = pvnode;});`);
            ctx.addElse();
            // need to update component
            const patchQueueCode = async
                ? `patchQueue${componentID}`
                : "extra.patchQueue";
            ctx.addLine(`def${defID} = def${defID} || w${componentID}._updateProps(props${componentID}, extra.forceUpdate, ${patchQueueCode});`);
            let keepAliveCode = "";
            if (keepAlive) {
                keepAliveCode = `pvnode.data.hook.insert = vn => {vn.elm.parentNode.replaceChild(w${componentID}.el,vn.elm);vn.elm=w${componentID}.el;w${componentID}._remount();};`;
            }
            ctx.addLine(`def${defID} = def${defID}.then(()=>{if (w${componentID}.__owl__.isDestroyed) {return};${tattStyle ? `w${componentID}.el.style=${tattStyle};` : ""}${updateClassCode}let pvnode=w${componentID}.__owl__.pvnode;${keepAliveCode}c${ctx.parentNode}[_${dummyID}_index]=pvnode;});`);
            ctx.closeIf();
            if (async) {
                ctx.addLine(`def${defID}.then(w${componentID}._applyPatchQueue.bind(w${componentID}, patchQueue${componentID}));`);
            }
            else {
                ctx.addLine(`extra.promises.push(def${defID});`);
            }
            if (node.hasAttribute("t-if") ||
                node.hasAttribute("t-else") ||
                node.hasAttribute("t-elif")) {
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
            let handler = value.replace(/\(.*\)/, function (args) {
                extraArgs = args.slice(1, -1);
                return "";
            });
            let error = `(function () {throw new Error('Missing handler \\'' + '${handler}' + \`\\' when evaluating template '${ctx.templateName.replace(/`/g, "'")}'\`)})()`;
            if (extraArgs) {
                ctx.addLine(`extra.mountedHandlers[${nodeID}] = (context['${handler}'] || ${error}).bind(owner, ${ctx.formatExpression(extraArgs)});`);
            }
            else {
                ctx.addLine(`extra.mountedHandlers[${nodeID}] = extra.mountedHandlers[${nodeID}] || (context['${handler}'] || ${error}).bind(owner);`);
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
        atNodeEncounter({ ctx, value }) {
            const slotKey = ctx.generateID();
            ctx.addLine(`const slot${slotKey} = this.slots[context.__owl__.slotId + '_' + '${value}'];`);
            ctx.addLine(`c${ctx.parentNode}.push(slot${slotKey}(context.__owl__.parent, extra));`);
            return true;
        }
    });
    //------------------------------------------------------------------------------
    // t-model
    //------------------------------------------------------------------------------
    UTILS.toNumber = function (val) {
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
            }
            else if (type === "checkbox") {
                ctx.addLine(`p${nodeID}.props = {checked: context.state['${value}']};`);
                handler = `(ev) => {context.state['${value}'] = ev.target.checked}`;
            }
            else if (type === "radio") {
                const nodeValue = node.getAttribute("value");
                ctx.addLine(`p${nodeID}.props = {checked:context.state['${value}'] === '${nodeValue}'};`);
                handler = `(ev) => {context.state['${value}'] = ev.target.value}`;
                event = "click";
            }
            else {
                ctx.addLine(`p${nodeID}.props = {value: context.state['${value}']};`);
                const trimCode = fullName.includes(".trim") ? ".trim()" : "";
                let valueCode = `ev.target.value${trimCode}`;
                if (fullName.includes(".number")) {
                    ctx.rootContext.shouldDefineUtils = true;
                    valueCode = `utils.toNumber(${valueCode})`;
                }
                handler = `(ev) => {context.state['${value}'] = ${valueCode}}`;
            }
            ctx.addLine(`extra.handlers['${event}' + ${nodeID}] = extra.handlers['${event}' + ${nodeID}] || (${handler});`);
            ctx.addLine(`p${nodeID}.on['${event}'] = extra.handlers['${event}' + ${nodeID}];`);
        }
    });

    class Store extends EventBus {
        constructor(config, options = {}) {
            super();
            this._commitLevel = 0;
            this.history = [];
            this.debug = options.debug || false;
            this.state = config.state || {};
            this.actions = config.actions;
            this.mutations = config.mutations;
            this.env = config.env;
            this.observer = new Observer();
            this.observer.notifyCB = () => {
                this._gettersCache = {};
                this.trigger("update");
            };
            this.observer.allowMutations = false;
            this.observer.observe(this.state);
            this.getters = {};
            this._gettersCache = {};
            if (this.debug) {
                this.history.push({ state: this.state });
            }
            const cTypes = ["undefined", "number", "string"];
            for (let entry of Object.entries(config.getters || {})) {
                const name = entry[0];
                const func = entry[1];
                this.getters[name] = payload => {
                    if (this._commitLevel === 0 && cTypes.indexOf(typeof payload) >= 0) {
                        this._gettersCache[name] = this._gettersCache[name] || {};
                        this._gettersCache[name][payload] =
                            this._gettersCache[name][payload] ||
                                func({ state: this.state, getters: this.getters }, payload);
                        return this._gettersCache[name][payload];
                    }
                    return func({ state: this.state, getters: this.getters }, payload);
                };
            }
        }
        dispatch(action, payload) {
            if (!this.actions[action]) {
                throw new Error(`[Error] action ${action} is undefined`);
            }
            const result = this.actions[action]({
                commit: this.commit.bind(this),
                dispatch: this.dispatch.bind(this),
                env: this.env,
                state: this.state,
                getters: this.getters
            }, payload);
            if (result instanceof Promise) {
                return new Promise((resolve, reject) => {
                    result.then(() => resolve());
                    result.catch(reject);
                });
            }
        }
        commit(type, payload) {
            if (!this.mutations[type]) {
                throw new Error(`[Error] mutation ${type} is undefined`);
            }
            this._commitLevel++;
            this.observer.allowMutations = true;
            const res = this.mutations[type].call(null, {
                commit: this.commit.bind(this),
                state: this.state,
                getters: this.getters
            }, payload);
            if (this._commitLevel === 1) {
                this.observer.allowMutations = false;
                if (this.debug) {
                    this.history.push({
                        state: this.state,
                        mutation: type,
                        payload: payload
                    });
                }
            }
            this._commitLevel--;
            return res;
        }
    }
    //------------------------------------------------------------------------------
    // Connect function
    //------------------------------------------------------------------------------
    function revNumber(o) {
        if (o !== null && typeof o === "object" && o.__owl__) {
            return o.__owl__.rev;
        }
        return 0;
    }
    function deepRevNumber(o) {
        if (o !== null && typeof o === "object" && o.__owl__) {
            return o.__owl__.deepRev;
        }
        return 0;
    }
    function connect(Comp, mapStoreToProps, options = {}) {
        let hashFunction = options.hashFunction || null;
        const getStore = options.getStore || (env => env.store);
        if (!hashFunction) {
            let deep = "deep" in options ? options.deep : true;
            let defaultRevFunction = deep ? deepRevNumber : revNumber;
            hashFunction = function ({ storeProps }, options) {
                const { currentStoreProps } = options;
                if ("__owl__" in storeProps) {
                    return defaultRevFunction(storeProps);
                }
                let hash = 0;
                for (let key in storeProps) {
                    const val = storeProps[key];
                    const hashVal = defaultRevFunction(val);
                    if (hashVal === 0) {
                        if (val !== currentStoreProps[key]) {
                            options.didChange = true;
                        }
                    }
                    else {
                        hash += hashVal;
                    }
                }
                return hash;
            };
        }
        const Result = class extends Comp {
            constructor(parent, props) {
                const env = parent instanceof Component ? parent.env : parent;
                const store = getStore(env);
                const ownProps = Object.assign({}, props || {});
                const storeProps = mapStoreToProps(store.state, ownProps, store.getters);
                const mergedProps = Object.assign({}, props || {}, storeProps);
                super(parent, mergedProps);
                this.__owl__.ownProps = ownProps;
                this.__owl__.currentStoreProps = storeProps;
                this.__owl__.store = store;
                this.__owl__.storeHash = hashFunction({
                    state: store.state,
                    storeProps: storeProps,
                    revNumber,
                    deepRevNumber
                }, {
                    currentStoreProps: storeProps
                });
            }
            /**
             * We do not use the mounted hook here for a subtle reason: we want the
             * updates to be called for the parents before the children.  However,
             * if we use the mounted hook, this will be done in the reverse order.
             */
            _callMounted() {
                this.__owl__.store.on("update", this, this._checkUpdate);
                super._callMounted();
            }
            willUnmount() {
                this.__owl__.store.off("update", this);
                super.willUnmount();
            }
            _checkUpdate() {
                const ownProps = this.__owl__.ownProps;
                const storeProps = mapStoreToProps(this.__owl__.store.state, ownProps, this.__owl__.store.getters);
                const options = {
                    currentStoreProps: this.__owl__.currentStoreProps
                };
                const storeHash = hashFunction({
                    state: this.__owl__.store.state,
                    storeProps: storeProps,
                    revNumber,
                    deepRevNumber
                }, options);
                let didChange = options.didChange;
                if (storeHash !== this.__owl__.storeHash) {
                    didChange = true;
                    this.__owl__.storeHash = storeHash;
                }
                if (didChange) {
                    this.__owl__.currentStoreProps = storeProps;
                    this._updateProps(ownProps, false);
                }
            }
            _updateProps(nextProps, forceUpdate, patchQueue) {
                if (this.__owl__.ownProps !== nextProps) {
                    this.__owl__.currentStoreProps = mapStoreToProps(this.__owl__.store.state, nextProps, this.__owl__.store.getters);
                }
                this.__owl__.ownProps = nextProps;
                const mergedProps = Object.assign({}, nextProps, this.__owl__.currentStoreProps);
                return super._updateProps(mergedProps, forceUpdate, patchQueue);
            }
        };
        // we assign here a unique name to the resulting anonymous class.
        // this is necessary for Owl to be able to properly deduce templates.
        // Otherwise, all connected components would have the same name, and then
        // each component after the first will necessarily have the same template.
        let name = `Connected${Comp.name}`;
        Object.defineProperty(Result, "name", { value: name });
        return Result;
    }

    /**
     * Owl Utils
     *
     * We have here a small collection of utility functions:
     *
     * - whenReady
     * - loadJS
     * - loadTemplates
     * - escape
     * - debounce
     */
    function whenReady(fn) {
        return new Promise(function (resolve) {
            if (document.readyState !== "loading") {
                resolve();
            }
            else {
                document.addEventListener("DOMContentLoaded", resolve, false);
            }
        }).then(fn || function () { });
    }
    const loadedScripts = {};
    function loadJS(url) {
        if (url in loadedScripts) {
            return loadedScripts[url];
        }
        const promise = new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.type = "text/javascript";
            script.src = url;
            script.onload = function () {
                resolve();
            };
            script.onerror = function () {
                reject(`Error loading file '${url}'`);
            };
            const head = document.head || document.getElementsByTagName("head")[0];
            head.appendChild(script);
        });
        loadedScripts[url] = promise;
        return promise;
    }
    async function loadTemplates(url) {
        const result = await fetch(url);
        if (!result.ok) {
            throw new Error("Error while fetching xml templates");
        }
        let templates = await result.text();
        templates = templates.replace(/<!--[\s\S]*?-->/g, "");
        return templates;
    }
    function escape(str) {
        if (str === undefined) {
            return "";
        }
        if (typeof str === "number") {
            return String(str);
        }
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&#x27;")
            .replace(/`/g, "&#x60;");
    }
    /**
     * Returns a function, that, as long as it continues to be invoked, will not
     * be triggered. The function will be called after it stops being called for
     * N milliseconds. If `immediate` is passed, trigger the function on the
     * leading edge, instead of the trailing.
     *
     * Inspired by https://davidwalsh.name/javascript-debounce-function
     */
    function debounce(func, wait, immediate) {
        let timeout;
        return function () {
            const context = this;
            const args = arguments;
            function later() {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            }
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) {
                func.apply(context, args);
            }
        };
    }

    var _utils = /*#__PURE__*/Object.freeze({
        whenReady: whenReady,
        loadJS: loadJS,
        loadTemplates: loadTemplates,
        escape: escape,
        debounce: debounce
    });

    /**
     * This file is the main file packaged by rollup (see rollup.config.js).  From
     * this file, we export all public owl elements.
     *
     * Note that dynamic values, such as a date or a commit hash are added by rollup
     */
    const __info__ = {};
    Object.defineProperty(__info__, "mode", {
        get() {
            return QWeb.dev ? "dev" : "prod";
        },
        set(mode) {
            QWeb.dev = mode === "dev";
            if (QWeb.dev) {
                const url = `https://github.com/odoo/owl/blob/master/doc/tooling.md#development-mode`;
                console.warn(`Owl is running in 'dev' mode.  This is not suitable for production use. See ${url} for more information.`);
            }
            else {
                console.log(`Owl is now running in 'prod' mode.`);
            }
        }
    });
    const utils = _utils;

    exports.Component = Component;
    exports.EventBus = EventBus;
    exports.Observer = Observer;
    exports.QWeb = QWeb;
    exports.Store = Store;
    exports.__info__ = __info__;
    exports.connect = connect;
    exports.utils = utils;

    exports.__info__.version = '0.15.0';
    exports.__info__.date = '2019-06-21T19:47:14.131Z';
    exports.__info__.hash = '63a8fcd';
    exports.__info__.url = 'https://github.com/odoo/owl';

}(this.owl = this.owl || {}));
