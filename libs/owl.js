(function (exports) {
    'use strict';

    function vnode(sel, data, children, text, elm) {
        let key = data === undefined ? undefined : data.key;
        return { sel: sel, data: data, children: children,
            text: text, elm: elm, key: key };
    }

    const array = Array.isArray;
    function primitive(s) {
        return typeof s === 'string' || typeof s === 'number';
    }

    function addNS(data, children, sel) {
        data.ns = 'http://www.w3.org/2000/svg';
        if (sel !== 'foreignObject' && children !== undefined) {
            for (let i = 0; i < children.length; ++i) {
                let childData = children[i].data;
                if (childData !== undefined) {
                    addNS(childData, children[i].children, children[i].sel);
                }
            }
        }
    }
    function h(sel, b, c) {
        var data = {}, children, text, i;
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
            for (i = 0; i < children.length; ++i) {
                if (primitive(children[i]))
                    children[i] = vnode(undefined, undefined, undefined, children[i], undefined);
            }
        }
        if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
            (sel.length === 3 || sel[3] === '.' || sel[3] === '#')) {
            addNS(data, children, sel);
        }
        return vnode(sel, data, children, text, undefined);
    }

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
    const attributesModule = {
        create: updateAttrs,
        update: updateAttrs
    };

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
            if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
                elm[key] = cur;
            }
        }
    }
    const propsModule = { create: updateProps, update: updateProps };

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
                for (var i = 0; i < handler.length; i++) {
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
            var listener = vnode.listener = oldVnode.listener || createListener();
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
        isComment,
    };

    function isUndef(s) { return s === undefined; }
    function isDef(s) { return s !== undefined; }
    const emptyNode = vnode('', {}, [], undefined, undefined);
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
    const hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];
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
            const id = elm.id ? '#' + elm.id : '';
            const c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
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
            let i, data = vnode.data;
            if (data !== undefined) {
                if (isDef(i = data.hook) && isDef(i = i.init)) {
                    i(vnode);
                    data = vnode.data;
                }
            }
            let children = vnode.children, sel = vnode.sel;
            if (sel === '!') {
                if (isUndef(vnode.text)) {
                    vnode.text = '';
                }
                vnode.elm = api.createComment(vnode.text);
            }
            else if (sel !== undefined) {
                // Parse selector
                const hashIdx = sel.indexOf('#');
                const dotIdx = sel.indexOf('.', hashIdx);
                const hash = hashIdx > 0 ? hashIdx : sel.length;
                const dot = dotIdx > 0 ? dotIdx : sel.length;
                const tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
                const elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                    : api.createElement(tag);
                if (hash < dot)
                    elm.setAttribute('id', sel.slice(hash + 1, dot));
                if (dotIdx > 0)
                    elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
                for (i = 0; i < cbs.create.length; ++i)
                    cbs.create[i](emptyNode, vnode);
                if (array(children)) {
                    for (i = 0; i < children.length; ++i) {
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
            let i, j, data = vnode.data;
            if (data !== undefined) {
                if (isDef(i = data.hook) && isDef(i = i.destroy))
                    i(vnode);
                for (i = 0; i < cbs.destroy.length; ++i)
                    cbs.destroy[i](vnode);
                if (vnode.children !== undefined) {
                    for (j = 0; j < vnode.children.length; ++j) {
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
                let i, listeners, rm, ch = vnodes[startIdx];
                if (ch != null) {
                    if (isDef(ch.sel)) {
                        invokeDestroyHook(ch);
                        listeners = cbs.remove.length + 1;
                        rm = createRmCb(ch.elm, listeners);
                        for (i = 0; i < cbs.remove.length; ++i)
                            cbs.remove[i](ch, rm);
                        if (isDef(i = ch.data) && isDef(i = i.hook) && isDef(i = i.remove)) {
                            i(ch, rm);
                        }
                        else {
                            rm();
                        }
                    }
                    else { // Text node
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
                else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
                    patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
                    api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
                    oldStartVnode = oldCh[++oldStartIdx];
                    newEndVnode = newCh[--newEndIdx];
                }
                else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
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
                    if (isUndef(idxInOld)) { // New element
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
            let i, hook;
            if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
                i(oldVnode, vnode);
            }
            const elm = vnode.elm = oldVnode.elm;
            let oldCh = oldVnode.children;
            let ch = vnode.children;
            if (oldVnode === vnode)
                return;
            if (vnode.data !== undefined) {
                for (i = 0; i < cbs.update.length; ++i)
                    cbs.update[i](oldVnode, vnode);
                i = vnode.data.hook;
                if (isDef(i) && isDef(i = i.update))
                    i(oldVnode, vnode);
            }
            if (isUndef(vnode.text)) {
                if (isDef(oldCh) && isDef(ch)) {
                    if (oldCh !== ch)
                        updateChildren(elm, oldCh, ch, insertedVnodeQueue);
                }
                else if (isDef(ch)) {
                    if (isDef(oldVnode.text))
                        api.setTextContent(elm, '');
                    addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
                }
                else if (isDef(oldCh)) {
                    removeVnodes(elm, oldCh, 0, oldCh.length - 1);
                }
                else if (isDef(oldVnode.text)) {
                    api.setTextContent(elm, '');
                }
            }
            else if (oldVnode.text !== vnode.text) {
                if (isDef(oldCh)) {
                    removeVnodes(elm, oldCh, 0, oldCh.length - 1);
                }
                api.setTextContent(elm, vnode.text);
            }
            if (isDef(hook) && isDef(i = hook.postpatch)) {
                i(oldVnode, vnode);
            }
        }
        return function patch(oldVnode, vnode) {
            let i, elm, parent;
            const insertedVnodeQueue = [];
            for (i = 0; i < cbs.pre.length; ++i)
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
            for (i = 0; i < insertedVnodeQueue.length; ++i) {
                insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
            }
            for (i = 0; i < cbs.post.length; ++i)
                cbs.post[i]();
            return vnode;
        };
    }

    /**
     * We define here a simple event bus: it can
     * - emit events
     * - add/remove listeners.
     *
     * This is a useful pattern of communication in some cases.
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
         * be a widget or a class. The idea is that the callback will be called with
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
            for (let sub of subs) {
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
     * Remove trailing and leading spaces
     */
    function htmlTrim(s) {
        let result = s.replace(/(^\s+|\s+$)/g, "");
        if (s[0] === " ") {
            result = " " + result;
        }
        if (result !== " " && s[s.length - 1] === " ") {
            result = result + " ";
        }
        return result;
    }
    /**
     * Create a function that will generate unique id numbers
     */
    function idGenerator() {
        let nextID = 1;
        return () => nextID++;
    }
    function memoize(f, hash) {
        if (!hash) {
            hash = args => args.map(a => String(a)).join(",");
        }
        let cache = {};
        function memoizedFunction(...args) {
            let hashValue = hash(args);
            if (!(hashValue in cache)) {
                cache[hashValue] = f(...args);
            }
            return cache[hashValue];
        }
        return memoizedFunction;
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
    /**
     * Find a node in a tree.
     *
     * This will traverse the tree (depth first) and return the first child that
     * matches the predicate, if any
     */
    function findInTree(tree, predicate) {
        if (predicate(tree)) {
            return tree;
        }
        for (let child of tree.children) {
            let match = findInTree(child, predicate);
            if (match) {
                return match;
            }
        }
        return null;
    }
    function patch(C, patchName, patch) {
        const proto = C.prototype;
        if (!proto.__patches) {
            proto.__patches = {
                origMethods: {},
                patches: {},
                current: []
            };
        }
        if (proto.__patches.patches[patchName]) {
            throw new Error(`Patch [${patchName}] already exists`);
        }
        proto.__patches.patches[patchName] = patch;
        applyPatch(proto, patch);
        proto.__patches.current.push(patchName);
        function applyPatch(proto, patch) {
            Object.keys(patch).forEach(function (methodName) {
                const method = patch[methodName];
                if (typeof method === "function") {
                    const original = proto[methodName];
                    if (!(methodName in proto.__patches.origMethods)) {
                        proto.__patches.origMethods[methodName] = original;
                    }
                    proto[methodName] = function (...args) {
                        this._super = original;
                        return method.call(this, ...args);
                    };
                }
            });
        }
    }
    function unpatch(C, patchName) {
        const proto = C.prototype;
        const patchInfo = proto.__patches;
        delete proto.__patches;
        // reset to original
        for (let k in patchInfo.origMethods) {
            proto[k] = patchInfo.origMethods[k];
        }
        // apply other patches
        for (let name of patchInfo.current) {
            if (name !== patchName) {
                patch(C, name, patchInfo.patches[name]);
            }
        }
    }

    var _utils = /*#__PURE__*/Object.freeze({
        escape: escape,
        htmlTrim: htmlTrim,
        idGenerator: idGenerator,
        memoize: memoize,
        debounce: debounce,
        findInTree: findInTree,
        patch: patch,
        unpatch: unpatch
    });

    let getId = idGenerator();
    const patch$1 = init([eventListenersModule, attributesModule, propsModule]);
    //------------------------------------------------------------------------------
    // Widget
    //------------------------------------------------------------------------------
    class Component extends EventBus {
        //--------------------------------------------------------------------------
        // Lifecycle
        //--------------------------------------------------------------------------
        /**
         * Creates an instance of Component.
         *
         * The root widget of a component tree needs an environment:
         *
         * ```javascript
         *   const root = new RootWidget(env, props);
         * ```
         *
         * Every other widget simply needs a reference to its parent:
         *
         * ```javascript
         *   const child = new SomeWidget(parent, props);
         * ```
         *
         * Note that most of the time, only the root widget needs to be created by
         * hand.  Other widgets should be created automatically by the framework (with
         * the t-widget directive in a template)
         */
        constructor(parent, props) {
            super();
            this.template = "default";
            this.inlineTemplate = null;
            this.state = {};
            this.refs = {};
            // is this a good idea?
            //   Pro: if props is empty, we can create easily a widget
            //   Con: this is not really safe
            //   Pro: but creating widget (by a template) is always unsafe anyway
            this.props = props || {};
            let id = getId();
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
                isStarted: false,
                isMounted: false,
                isDestroyed: false,
                parent: p,
                children: {},
                cmap: {},
                renderId: 1,
                renderPromise: null,
                renderProps: props || null,
                boundHandlers: {}
            };
        }
        get el() {
            return this.__owl__.vnode ? this.__owl__.vnode.elm : null;
        }
        /**
         * willStart is an asynchronous hook that can be implemented to perform some
         * action before the initial rendering of a component.
         *
         * It will be called exactly once before the initial rendering. It is useful
         * in some cases, for example, to load external assets (such as a JS library)
         * before the widget is rendered.
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
         * Note that at this point, it is not safe to rerender the widget. In
         * particular, updateState calls should be avoided.
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
         * Updating the widget state in this hook is possible, but not encouraged.
         * One need to be careful, because updates here will cause rerender, which in
         * turn will cause other calls to updated. So, we need to be particularly
         * careful at avoiding endless cycles.
         */
        patched() { }
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
         * Attach a child widget to a given html element
         *
         * This is most of the time not necessary, since widgets should primarily be
         * created/managed with the t-widget directive in a qweb template.  However,
         * for the cases where we need more control, this method will do what is
         * necessary to make sure all the proper hooks are called (for example,
         * mounted/willUnmount)
         *
         * Note that this method makes a few assumptions:
         * - the child widget is indeed a child of the current widget
         * - the target is inside the dom of the current widget (typically a ref)
         */
        attachChild(child, target) {
            target.appendChild(child.el);
            child.__mount();
        }
        async mount(target) {
            const vnode = await this._prepare();
            if (this.__owl__.isDestroyed) {
                // widget was destroyed before we get here...
                return;
            }
            this._patch(vnode);
            target.appendChild(this.el);
            if (document.body.contains(target)) {
                this._visitSubTree(w => {
                    if (!w.__owl__.isMounted && this.el.contains(w.el)) {
                        w.__owl__.isMounted = true;
                        w.mounted();
                        return true;
                    }
                    return false;
                });
            }
        }
        unmount() {
            if (this.el) {
                this._visitSubTree(w => {
                    if (w.__owl__.isMounted) {
                        w.willUnmount();
                        w.__owl__.isMounted = false;
                        return true;
                    }
                    return false;
                });
                this.el.remove();
            }
        }
        async render(force = false) {
            if (this.__owl__.isDestroyed) {
                return;
            }
            const renderVDom = this._render(force);
            const renderId = this.__owl__.renderId;
            const vnode = await renderVDom;
            if (renderId === this.__owl__.renderId) {
                // we only update the vnode and the actual DOM if no other rendering
                // occurred between now and when the render method was initially called.
                this._patch(vnode);
            }
        }
        destroy() {
            if (!this.__owl__.isDestroyed) {
                for (let id in this.__owl__.children) {
                    this.__owl__.children[id].destroy();
                }
                if (this.__owl__.isMounted) {
                    this.willUnmount();
                }
                if (this.el) {
                    this.el.remove();
                    this.__owl__.isMounted = false;
                    delete this.__owl__.vnode;
                }
                if (this.__owl__.parent) {
                    let id = this.__owl__.id;
                    delete this.__owl__.parent.__owl__.children[id];
                    this.__owl__.parent = null;
                }
                this.clear();
                this.__owl__.isDestroyed = true;
            }
        }
        shouldUpdate(nextProps) {
            return true;
        }
        /**
         * This method is the correct way to update the environment of a widget. Doing
         * this will cause a full rerender of the widget and its children, so this is
         * an operation that should not be done frequently.
         *
         * A good usecase for updating the environment would be to update some mostly
         * static config keys, such as a boolean to determine if we are in mobile
         * mode or not.
         */
        async updateEnv(nextEnv) {
            if (this.__owl__.parent && this.__owl__.parent.env === this.env) {
                this.env = Object.create(this.env);
            }
            Object.assign(this.env, nextEnv);
            if (this.__owl__.isMounted) {
                await this.render(true);
            }
            this.patched();
        }
        async updateProps(nextProps, forceUpdate = false) {
            const shouldUpdate = forceUpdate || this.shouldUpdate(nextProps);
            return shouldUpdate ? this._updateProps(nextProps) : Promise.resolve();
        }
        /**
         * This is the safest update method for widget: its job is to update the state
         * and rerender (if widget is mounted).
         *
         * Notes:
         * - it checks if we do not add extra keys to the state.
         * - it is ok to call updateState before the widget is started. In that
         * case, it will simply update the state and will not rerender
         */
        async updateState(nextState) {
            if (Object.keys(nextState).length === 0) {
                return;
            }
            Object.assign(this.state, nextState);
            if (this.__owl__.isStarted) {
                await this.render();
            }
            this.patched();
        }
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        async _updateProps(nextProps) {
            await this.willUpdateProps(nextProps);
            this.props = nextProps;
            await this.render();
            this.patched();
        }
        _patch(vnode) {
            this.__owl__.renderPromise = null;
            if (this.__owl__.vnode) {
                this.willPatch();
                this.__owl__.vnode = patch$1(this.__owl__.vnode, vnode);
            }
            else {
                this.__owl__.vnode = patch$1(document.createElement(vnode.sel), vnode);
            }
        }
        async _prepare() {
            this.__owl__.renderProps = this.props;
            this.__owl__.renderPromise = this.willStart().then(() => {
                if (this.__owl__.isDestroyed) {
                    return Promise.resolve(h("div"));
                }
                this.__owl__.isStarted = true;
                if (this.inlineTemplate) {
                    this.env.qweb.addTemplate(this.inlineTemplate, this.inlineTemplate, true);
                }
                return this._render();
            });
            return this.__owl__.renderPromise;
        }
        async _render(force = false) {
            this.__owl__.renderId++;
            const promises = [];
            const template = this.inlineTemplate || this.template;
            let vnode = this.env.qweb.render(template, this, {
                promises,
                handlers: this.__owl__.boundHandlers,
                forceUpdate: force
            });
            // this part is critical for the patching process to be done correctly. The
            // tricky part is that a child widget can be rerendered on its own, which
            // will update its own vnode representation without the knowledge of the
            // parent widget.  With this, we make sure that the parent widget will be
            // able to patch itself properly after
            vnode.key = this.__owl__.id;
            this.__owl__.renderProps = this.props;
            this.__owl__.renderPromise = Promise.all(promises).then(() => vnode);
            return this.__owl__.renderPromise;
        }
        /**
         * Only called by qweb t-widget directive
         */
        _mount(vnode, elm) {
            this.__owl__.vnode = patch$1(elm, vnode);
            this.__mount();
            return this.__owl__.vnode;
        }
        __mount() {
            if (this.__owl__.isMounted) {
                return;
            }
            if (this.__owl__.parent) {
                if (this.__owl__.parent.__owl__.isMounted) {
                    this.__owl__.isMounted = true;
                    this.mounted();
                    const children = this.__owl__.children;
                    for (let id in children) {
                        children[id].__mount();
                    }
                }
            }
        }
        _visitSubTree(callback) {
            const shouldVisitChildren = callback(this);
            if (shouldVisitChildren) {
                const children = this.__owl__.children;
                for (let id in children) {
                    children[id]._visitSubTree(callback);
                }
            }
        }
    }

    const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(",");
    const WORD_REPLACEMENT = {
        and: "&&",
        or: "||",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<="
    };
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
    //------------------------------------------------------------------------------
    // Compilation Context
    //------------------------------------------------------------------------------
    class Context {
        constructor(name) {
            this.nextID = 1;
            this.code = [];
            this.variables = {};
            this.definedVariables = {};
            this.escaping = false;
            this.parentNode = null;
            this.rootNode = null;
            this.indentLevel = 0;
            this.shouldDefineOwner = false;
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
            if (this === this.rootContext && this.parentNode) {
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
        formatExpression(e) {
            e = e.trim();
            if (e[0] === "{" && e[e.length - 1] === "}") {
                const innerExpr = e
                    .slice(1, -1)
                    .split(",")
                    .map(p => {
                    let [key, val] = p.trim().split(":");
                    if (key === "") {
                        return "";
                    }
                    if (!val) {
                        val = key;
                    }
                    return `${key}: ${this.formatExpression(val)}`;
                })
                    .join(",");
                return "{" + innerExpr + "}";
            }
            // Thanks CHM for this code...
            const chars = e.split("");
            let instring = "";
            let invar = "";
            let invarPos = 0;
            let r = "";
            chars.push(" ");
            for (var i = 0, ilen = chars.length; i < ilen; i++) {
                var c = chars[i];
                if (instring.length) {
                    if (c === instring && chars[i - 1] !== "\\") {
                        instring = "";
                    }
                }
                else if (c === '"' || c === "'") {
                    instring = c;
                }
                else if (c.match(/[a-zA-Z_\$]/) && !invar.length) {
                    invar = c;
                    invarPos = i;
                    continue;
                }
                else if (c.match(/\W/) && invar.length) {
                    // TODO: Should check for possible spaces before dot
                    if (chars[invarPos - 1] !== "." && RESERVED_WORDS.indexOf(invar) < 0) {
                        if (!(invar in this.definedVariables)) {
                            invar =
                                WORD_REPLACEMENT[invar] ||
                                    (invar in this.variables &&
                                        this.formatExpression(this.variables[invar])) ||
                                    "context['" + invar + "']";
                        }
                    }
                    r += invar;
                    invar = "";
                }
                else if (invar.length) {
                    invar += c;
                    continue;
                }
                r += c;
            }
            const result = r.slice(0, -1);
            return result;
        }
    }
    //------------------------------------------------------------------------------
    // QWeb rendering engine
    //------------------------------------------------------------------------------
    class QWeb {
        constructor(data) {
            this.processedTemplates = {};
            this.templates = {};
            this.directives = [];
            this.utils = {
                h: h,
                getFragment(str) {
                    const temp = document.createElement("template");
                    temp.innerHTML = str;
                    return temp.content;
                },
                objectToAttrString(obj) {
                    let classes = [];
                    for (let k in obj) {
                        if (obj[k]) {
                            classes.push(k);
                        }
                    }
                    return classes.join(" ");
                }
            };
            this.directiveNames = {
                as: 1,
                name: 1,
                value: 1,
                att: 1,
                attf: 1,
                props: 1,
                key: 1,
                keepalive: 1,
                debug: 1
            };
            [
                forEachDirective,
                escDirective,
                rawDirective,
                setDirective,
                elseDirective,
                elifDirective,
                ifDirective,
                callDirective,
                onDirective,
                refDirective,
                widgetDirective
            ].forEach(d => this.addDirective(d));
            if (data) {
                this.loadTemplates(data);
            }
        }
        addDirective(dir) {
            this.directives.push(dir);
            this.directiveNames[dir.name] = 1;
            this.directives.sort((d1, d2) => d1.priority - d2.priority);
        }
        /**
         * Add a template to the internal template map.  Note that it is not
         * immediately compiled.
         */
        addTemplate(name, template, allowDuplicates = false) {
            if (name in this.processedTemplates) {
                if (allowDuplicates) {
                    return;
                }
                else {
                    throw new Error(`Template ${name} already defined`);
                }
            }
            const parser = new DOMParser();
            const doc = parser.parseFromString(template, "text/xml");
            if (!doc.firstChild) {
                throw new Error("Invalid template (should not be empty)");
            }
            if (doc.getElementsByTagName("parsererror").length) {
                throw new Error("Invalid XML in template");
            }
            let elem = doc.firstChild;
            this._processTemplate(elem);
            this.processedTemplates[name] = elem;
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
         * Load templates from a xml (as a string).  This will look up for the first
         * <templates> tag, and will consider each child of this as a template, with
         * the name given by the t-name attribute.
         */
        loadTemplates(xmlstr) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlstr, "text/xml");
            if (doc.getElementsByTagName("parsererror").length) {
                throw new Error("Invalid XML in template");
            }
            const templates = doc.getElementsByTagName("templates")[0];
            if (!templates) {
                return;
            }
            for (let elem of templates.children) {
                const name = elem.getAttribute("t-name");
                this._processTemplate(elem);
                this.processedTemplates[name] = elem;
            }
        }
        /**
         * Render a template
         *
         * @param {string} name the template should already have been added
         */
        render(name, context = {}, extra = null) {
            if (!(name in this.processedTemplates)) {
                throw new Error(`Template ${name} does not exist`);
            }
            const template = this.templates[name] || this._compile(name);
            return template.call(this, context, extra);
        }
        _compile(name) {
            if (name in this.templates) {
                return this.templates[name];
            }
            const mainNode = this.processedTemplates[name];
            const isDebug = mainNode.attributes.hasOwnProperty("t-debug");
            const ctx = new Context(name);
            this._compileNode(mainNode, ctx);
            if (ctx.shouldProtectContext) {
                ctx.code.unshift("    context = Object.create(context);");
            }
            if (ctx.shouldDefineOwner) {
                // this is necessary to prevent some directives (t-forach for ex) to
                // pollute the rendering context by adding some keys in it.
                ctx.code.unshift("    let owner = context;");
            }
            if (!ctx.rootNode) {
                throw new Error("A template should have one root node");
            }
            ctx.addLine(`return vn${ctx.rootNode};`);
            if (isDebug) {
                ctx.code.unshift("    debugger");
            }
            let template;
            try {
                template = new Function("context", "extra", ctx.code.join("\n"));
            }
            catch (e) {
                throw new Error(`Invalid generated code while compiling template '${ctx.templateName.replace(/`/g, "'")}': ${e.message}`);
            }
            if (isDebug) {
                console.log(`Template: ${this.processedTemplates[name].outerHTML}\nCompiled code:\n` + template.toString());
            }
            this.templates[name] = template;
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
                else {
                    // this is an unusual situation: this text node is the result of the
                    // template rendering.
                    let nodeID = ctx.generateID();
                    ctx.addLine(`var vn${nodeID} = {text: \`${text}\`};`);
                    ctx.rootContext.rootNode = nodeID;
                    ctx.rootContext.parentNode = nodeID;
                }
                return;
            }
            const attributes = node.attributes;
            const validDirectives = [];
            let withHandlers = false;
            // maybe this is not optimal: we iterate on all attributes here, and again
            // just after for each directive.
            for (let i = 0; i < attributes.length; i++) {
                let attrName = attributes[i].name;
                if (attrName.startsWith("t-")) {
                    let dName = attrName.slice(2).split("-")[0];
                    if (!(dName in this.directiveNames)) {
                        throw new Error(`Unknown QWeb directive: '${attrName}'`);
                    }
                }
            }
            for (let directive of this.directives) {
                let fullName;
                let value;
                for (let i = 0; i < attributes.length; i++) {
                    const name = attributes[i].name;
                    if (name === "t-" + directive.name ||
                        name.startsWith("t-" + directive.name + "-")) {
                        fullName = name;
                        value = attributes[i].textContent;
                        validDirectives.push({ directive, value, fullName });
                        if (directive.name === "on") {
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
                for (let { directive, value, fullName } of validDirectives) {
                    if (directive.atNodeCreation) {
                        directive.atNodeCreation({
                            node,
                            qweb: this,
                            ctx,
                            fullName,
                            value,
                            nodeID
                        });
                    }
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
                    let formattedValue = ctx.formatExpression(ctx.getValue(value));
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
                    const formattedExpr = value.replace(/\{\{.*?\}\}/g, s => "${" + ctx.formatExpression(s.slice(2, -2)) + "}");
                    const attID = ctx.generateID();
                    let staticVal = node.getAttribute(attName);
                    if (staticVal) {
                        ctx.addLine(`var _${attID} = '${staticVal} ' + \`${formattedExpr}\`;`);
                    }
                    else {
                        ctx.addLine(`var _${attID} = \`${formattedExpr}\`;`);
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
            ctx.addLine(`var c${nodeID} = [], p${nodeID} = {${parts.join(",")}};`);
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
    function compileValueNode(value, node, qweb, ctx) {
        if (value === "0" && ctx.caller) {
            qweb._compileNode(ctx.caller, ctx);
            return;
        }
        if (typeof value === "string") {
            let exprID = value;
            if (!(value in ctx.definedVariables)) {
                exprID = `_${ctx.generateID()}`;
                ctx.addLine(`var ${exprID} = ${ctx.formatExpression(value)};`);
            }
            ctx.addIf(`${exprID} || ${exprID} === 0`);
            if (!ctx.parentNode) {
                throw new Error("Should not have a text node without a parent");
            }
            if (ctx.escaping) {
                ctx.addLine(`c${ctx.parentNode}.push({text: ${exprID}});`);
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
            return;
        }
        if (value instanceof NodeList) {
            for (let node of Array.from(value)) {
                qweb._compileNode(node, ctx);
            }
        }
    }
    const escDirective = {
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
    };
    const rawDirective = {
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
    };
    const setDirective = {
        name: "set",
        priority: 60,
        atNodeEncounter({ node, ctx }) {
            const variable = node.getAttribute("t-set");
            let value = node.getAttribute("t-value");
            if (value) {
                const formattedValue = ctx.formatExpression(value);
                if (ctx.variables.hasOwnProperty(variable)) {
                    ctx.addLine(`${ctx.variables[variable]} = ${formattedValue}`);
                }
                else {
                    const varName = `_${ctx.generateID()}`;
                    ctx.addLine(`var ${varName} = ${formattedValue};`);
                    ctx.definedVariables[varName] = formattedValue;
                    ctx.variables[variable] = varName;
                }
            }
            else {
                ctx.variables[variable] = node.childNodes;
            }
            return true;
        }
    };
    const ifDirective = {
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
    };
    const elifDirective = {
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
    };
    const elseDirective = {
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
    };
    const callDirective = {
        name: "call",
        priority: 50,
        atNodeEncounter({ node, qweb, ctx }) {
            if (node.nodeName !== "t") {
                throw new Error("Invalid tag for t-call directive (should be 't')");
            }
            const subTemplate = node.getAttribute("t-call");
            const nodeTemplate = qweb.processedTemplates[subTemplate];
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
            var definedVariables = Object.assign({}, ctx.definedVariables, tempCtx.definedVariables);
            ctx.rootContext.nextID = tempCtx.nextID;
            // open new scope, if necessary
            const hasNewVariables = Object.keys(definedVariables).length > 0;
            if (hasNewVariables) {
                ctx.addLine("{");
                ctx.indent();
            }
            // add new variables, if any
            for (let key in definedVariables) {
                ctx.addLine(`let ${key} = ${definedVariables[key]}`);
            }
            // compile sub template
            const subCtx = ctx
                .subContext("caller", nodeCopy)
                .subContext("variables", Object.create(vars))
                .subContext("definedVariables", Object.create(definedVariables));
            qweb._compileNode(nodeTemplate, subCtx);
            // close new scope
            if (hasNewVariables) {
                ctx.dedent();
                ctx.addLine("}");
            }
            return true;
        }
    };
    const forEachDirective = {
        name: "foreach",
        priority: 10,
        atNodeEncounter({ node, qweb, ctx }) {
            ctx.rootContext.shouldProtectContext = true;
            ctx = ctx.subContext("inLoop", true);
            const elems = node.getAttribute("t-foreach");
            const name = node.getAttribute("t-as");
            let arrayID = ctx.generateID();
            ctx.addLine(`var _${arrayID} = ${ctx.formatExpression(elems)};`);
            ctx.addLine(`if (!_${arrayID}) { throw new Error('QWeb error: Invalid loop expression')}`);
            ctx.addLine(`if (typeof _${arrayID} === 'number') { _${arrayID} = Array.from(Array(_${arrayID}).keys())}`);
            let keysID = ctx.generateID();
            ctx.addLine(`var _${keysID} = _${arrayID} instanceof Array ? _${arrayID} : Object.keys(_${arrayID});`);
            let valuesID = ctx.generateID();
            ctx.addLine(`var _${valuesID} = _${arrayID} instanceof Array ? _${arrayID} : Object.values(_${arrayID});`);
            ctx.addLine(`for (let i = 0; i < _${keysID}.length; i++) {`);
            ctx.indent();
            ctx.addLine(`context.${name}_first = i === 0;`);
            ctx.addLine(`context.${name}_last = i === _${keysID}.length - 1;`);
            ctx.addLine(`context.${name}_parity = i % 2 === 0 ? 'even' : 'odd';`);
            ctx.addLine(`context.${name}_index = i;`);
            ctx.addLine(`context.${name} = _${keysID}[i];`);
            ctx.addLine(`context.${name}_value = _${valuesID}[i];`);
            const nodeCopy = node.cloneNode(true);
            nodeCopy.removeAttribute("t-foreach");
            qweb._compileNode(nodeCopy, ctx);
            ctx.dedent();
            ctx.addLine("}");
            return true;
        }
    };
    const onDirective = {
        name: "on",
        priority: 90,
        atNodeCreation({ ctx, fullName, value, nodeID }) {
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
                ctx.addLine(`p${nodeID}.on['${eventName}'] = (context['${handler}'] || ${error}).bind(owner, ${ctx.formatExpression(extraArgs)});`);
            }
            else {
                ctx.addLine(`extra.handlers['${eventName}' + ${nodeID}] = extra.handlers['${eventName}' + ${nodeID}] || (context['${handler}'] || ${error}).bind(owner);`);
                ctx.addLine(`p${nodeID}.on['${eventName}'] = extra.handlers['${eventName}' + ${nodeID}];`);
            }
        }
    };
    const refDirective = {
        name: "ref",
        priority: 95,
        atNodeCreation({ ctx, node }) {
            let ref = node.getAttribute("t-ref");
            ctx.addLine(`p${ctx.parentNode}.hook = {
            create: (_, n) => context.refs[${ctx.formatExpression(ref)}] = n.elm,
        };`);
        }
    };
    const widgetDirective = {
        name: "widget",
        priority: 100,
        atNodeEncounter({ ctx, value, node }) {
            ctx.addLine("//WIDGET");
            ctx.rootContext.shouldDefineOwner = true;
            let props = node.getAttribute("t-props");
            let keepAlive = node.getAttribute("t-keepalive") ? true : false;
            // t-on- events...
            const events = [];
            const attributes = node.attributes;
            for (let i = 0; i < attributes.length; i++) {
                const name = attributes[i].name;
                if (name.startsWith("t-on-")) {
                    events.push([name.slice(5), attributes[i].textContent]);
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
            ctx.addLine(`let w${widgetID} = ${templateID} in context.__owl__.cmap ? context.__owl__.children[context.__owl__.cmap[${templateID}]] : false;`);
            ctx.addLine(`let props${widgetID} = ${props || "{}"};`);
            ctx.addLine(`let isNew${widgetID} = !w${widgetID};`);
            // check if we can reuse current rendering promise
            ctx.addIf(`w${widgetID} && w${widgetID}.__owl__.renderPromise`);
            ctx.addIf(`w${widgetID}.__owl__.isStarted`);
            ctx.addLine(`def${defID} = w${widgetID}.updateProps(props${widgetID}, extra.forceUpdate);`);
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
            ctx.addLine(`def${defID} = w${widgetID}.updateProps(props${widgetID}, extra.forceUpdate);`);
            ctx.addElse();
            ctx.addLine(`w${widgetID} = new context.widgets['${value}'](owner, props${widgetID});`);
            ctx.addLine(`context.__owl__.cmap[${templateID}] = w${widgetID}.__owl__.id;`);
            for (let [event, method] of events) {
                ctx.addLine(`w${widgetID}.on('${event}', owner, owner['${method}'])`);
            }
            let ref = node.getAttribute("t-ref");
            if (ref) {
                ctx.addLine(`context.refs[${ctx.formatExpression(ref)}] = w${widgetID};`);
            }
            ctx.addLine(`def${defID} = w${widgetID}._prepare();`);
            ctx.closeIf();
            ctx.closeIf();
            ctx.addIf(`isNew${widgetID}`);
            ctx.addLine(`def${defID} = def${defID}.then(vnode=>{let pvnode=h(vnode.sel, {key: ${templateID}});c${ctx.parentNode}[_${dummyID}_index]=pvnode;pvnode.data.hook = {insert(vn){let nvn=w${widgetID}._mount(vnode, vn.elm);pvnode.elm=nvn.elm},remove(){w${widgetID}.${keepAlive ? "unmount" : "destroy"}()},destroy(){w${widgetID}.${keepAlive ? "unmount" : "destroy"}()}}; w${widgetID}.__owl__.pvnode = pvnode;});`);
            ctx.addElse();
            ctx.addLine(`def${defID} = def${defID}.then(()=>{if (w${widgetID}.__owl__.isDestroyed) {return};let vnode;if (!w${widgetID}.__owl__.vnode){vnode=w${widgetID}.__owl__.pvnode} else { vnode=h(w${widgetID}.__owl__.vnode.sel, {key: ${templateID}});vnode.elm=w${widgetID}.el;vnode.data.hook = {insert(a){a.elm.parentNode.replaceChild(w${widgetID}.el,a.elm);a.elm=w${widgetID}.el;w${widgetID}.__mount();},remove(){w${widgetID}.${keepAlive ? "unmount" : "destroy"}()}, destroy() {w${widgetID}.${keepAlive ? "unmount" : "destroy"}()}}}c${ctx.parentNode}[_${dummyID}_index]=vnode;});`);
            ctx.closeIf();
            ctx.addLine(`extra.promises.push(def${defID});`);
            if (node.hasAttribute("t-if") || node.hasAttribute("t-else")) {
                ctx.closeIf();
            }
            return true;
        }
    };

    const methodsToPatch = [
        "push",
        "pop",
        "shift",
        "unshift",
        "splice",
        "sort",
        "reverse"
    ];
    const ArrayProto = Array.prototype;
    const ModifiedArrayProto = Object.create(ArrayProto);
    for (let method of methodsToPatch) {
        const initialMethod = ArrayProto[method];
        ModifiedArrayProto[method] = function (...args) {
            this.__observer__.rev++;
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
                for (let elem of inserted) {
                    this.__observer__.observe(elem, this);
                }
            }
            return initialMethod.call(this, ...args);
        };
    }
    function makeObserver() {
        const observer = {
            rev: 1,
            allowMutations: true,
            observe: observe,
            set: set
        };
        function set(target, key, value) {
            addProp(target, key, value);
            target.__owl__.rev++;
            observer.rev++;
        }
        function addProp(obj, key, value) {
            Object.defineProperty(obj, key, {
                enumerable: true,
                get() {
                    return value;
                },
                set(newVal) {
                    if (!observer.allowMutations) {
                        throw new Error(`State cannot be changed outside a mutation! (key: "${key}", val: "${newVal}")`);
                    }
                    if (newVal !== value) {
                        unobserve(value);
                        value = newVal;
                        observe(newVal, obj);
                        obj.__owl__.rev++;
                        observer.rev++;
                        let parent = obj;
                        do {
                            parent.__owl__.deepRev++;
                        } while ((parent = parent.__owl__.parent));
                    }
                }
            });
            observe(value, obj);
        }
        function observeObj(obj, parent) {
            const keys = Object.keys(obj);
            obj.__owl__ = { rev: 1, deepRev: 1, parent };
            Object.defineProperty(obj, "__owl__", { enumerable: false });
            for (let key of keys) {
                addProp(obj, key, obj[key]);
            }
        }
        function observeArr(arr, parent) {
            arr.__owl__ = { rev: 1, deepRev: 1, parent };
            Object.defineProperty(arr, "__owl__", { enumerable: false });
            arr.__proto__ = Object.create(ModifiedArrayProto);
            arr.__proto__.__observer__ = observer;
            for (let i = 0; i < arr.length; i++) {
                observe(arr[i], arr);
            }
        }
        function observe(value, parent) {
            if (value === null) {
                // fun fact: typeof null === 'object'
                return;
            }
            if (typeof value !== "object") {
                return;
            }
            if ("__owl__" in value) {
                // already observed
                return;
            }
            if (Array.isArray(value)) {
                observeArr(value, parent);
            }
            else {
                observeObj(value, parent);
            }
        }
        function unobserve(target) {
            if (target !== null && typeof target === "object") {
                delete target.__owl__;
            }
        }
        return observer;
    }

    class Store extends EventBus {
        constructor(config, options = {}) {
            super();
            this._commitLevel = 0;
            this._isMutating = false;
            this.history = [];
            this.debug = options.debug || false;
            this.state = config.state || {};
            this.actions = config.actions;
            this.mutations = config.mutations;
            this.env = config.env;
            this.observer = makeObserver();
            this.observer.allowMutations = false;
            this.observer.observe(this.state);
            if (this.debug) {
                this.history.push({ state: this.state });
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
                state: this.state
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
            const currentRev = this.observer.rev;
            this._isMutating = true;
            this.observer.allowMutations = true;
            const res = this.mutations[type].call(null, {
                commit: this.commit.bind(this),
                state: this.state,
                set: this.observer.set
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
                Promise.resolve().then(() => {
                    if (this._isMutating) {
                        this._isMutating = false;
                        if (currentRev !== this.observer.rev) {
                            this.trigger("update", this.state);
                        }
                    }
                });
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
    function connect(mapStateToProps, options = {}) {
        let hashFunction = options.hashFunction || null;
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
        return function (Comp) {
            return class extends Comp {
                constructor(parent, props) {
                    const env = parent instanceof Component ? parent.env : parent;
                    const ownProps = Object.assign({}, props || {});
                    const storeProps = mapStateToProps(env.store.state, ownProps);
                    const mergedProps = Object.assign({}, props || {}, storeProps);
                    super(parent, mergedProps);
                    this.__owl__.ownProps = ownProps;
                    this.__owl__.currentStoreProps = storeProps;
                    this.__owl__.storeHash = hashFunction({
                        state: env.store.state,
                        storeProps: storeProps,
                        revNumber,
                        deepRevNumber
                    }, {
                        currentStoreProps: storeProps
                    });
                }
                mounted() {
                    this.env.store.on("update", this, () => {
                        const ownProps = this.__owl__.ownProps;
                        const storeProps = mapStateToProps(this.env.store.state, ownProps);
                        const options = {
                            currentStoreProps: this.__owl__.currentStoreProps
                        };
                        const storeHash = hashFunction({
                            state: this.env.store.state,
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
                            this.updateProps(ownProps, false);
                        }
                    });
                    super.mounted();
                }
                willUnmount() {
                    this.env.store.off("update", this);
                    super.willUnmount();
                }
                updateProps(nextProps, forceUpdate) {
                    if (this.__owl__.ownProps !== nextProps) {
                        this.__owl__.currentStoreProps = mapStateToProps(this.env.store.state, nextProps);
                    }
                    this.__owl__.ownProps = nextProps;
                    const mergedProps = Object.assign({}, nextProps, this.__owl__.currentStoreProps);
                    return super.updateProps(mergedProps, forceUpdate);
                }
            };
        };
    }

    const utils = _utils;

    exports.utils = utils;
    exports.Component = Component;
    exports.EventBus = EventBus;
    exports.QWeb = QWeb;
    exports.connect = connect;
    exports.Store = Store;

    exports._version = '0.6.0';
    exports._date = '2019-04-16T15:27:25.412Z';
    exports._hash = 'e19540f';
    exports._url = 'https://github.com/odoo/owl';

}(this.owl = this.owl || {}));
