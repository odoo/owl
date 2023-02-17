export class OwlDevtoolsGlobalHook {
  currentSelectedElement;
  root;
  fibersSet;
  recordEvents;
  patchFiber;
  iFrameObserver;

  constructor() {
    // The set of apps exposed by owl
    this.apps = window.__OWL_DEVTOOLS__.apps;
    // Class definition of an owl Fiber
    this.Fiber = window.__OWL_DEVTOOLS__.Fiber;
    // Same but for RootFiber
    this.RootFiber = window.__OWL_DEVTOOLS__.RootFiber;
    // Set to keep track of the bibers that are in the flush queue
    this.fibersSet = new WeakSet();
    // To keep track of the succession order of the render events
    this.eventId = 0;
    // Allows to launch a message each time an iframe html element is added to the page
    this.iFrameObserver = new MutationObserver(function (mutations_list) {
      mutations_list.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (added_node) {
          if (added_node.tagName == "IFRAME") {
            window.top.postMessage({ type: "owlDevtools__NewIFrame" });
          }
        });
      });
    });
    // Activates the observer defined above
    this.iFrameObserver.observe(document.body, { subtree: true, childList: true });
    const appsArray = Array.from(this.apps);
    appsArray.forEach((app) => this.patchAppMethods(app));
    this.patchSetMethods();
    this.recordEvents = false;
  }

  // Modify the methods of the apps set in order to send a message each time it is modified.
  patchSetMethods() {
    const originalAdd = this.apps.add;
    const originalDelete = this.apps.delete;
    const self = this;
    this.apps.add = function (app) {
      self.patchAppMethods(app);
      originalAdd.call(this, ...arguments);
      window.top.postMessage({ type: "owlDevtools__RefreshApps" });
    };
    this.apps.delete = function () {
      originalDelete.call(this, ...arguments);
      window.top.postMessage({ type: "owlDevtools__RefreshApps" });
    };
  }

  // Modify methods of each app so that it triggers messages on each flush and component render
  patchAppMethods(app) {
    const self = this;
    const originalFlush = app.scheduler.flush;
    let inFlush = false;
    let _render = false;
    app.scheduler.flush = function () {
      // Used to know when a render is triggered inside the flush method or not
      inFlush = true;
      [...this.tasks].map((fiber) => {
        if (fiber.counter === 0 && !self.fibersSet.has(fiber)) {
          self.fibersSet.add(fiber);
          const path = self.getComponentPath(fiber.node);
          /*
           * Add a functionnality to the flush function which sends a message to the window every time it is triggered.
           * This message is intercepted by the content script which informs the background script to ask the devtools app tree to be refreshed.
           * This process may be long but is necessary. More information in the docs:
           * https://developer.chrome.com/docs/extensions/mv3/devtools/#evaluated-scripts-to-devtools
           */
          window.top.postMessage({ type: "owlDevtools__Flush", data: path });
        }
      });
      originalFlush.call(this, ...arguments);
      inFlush = false;
    };
    const originalRender = self.Fiber.prototype.render;
    self.Fiber.prototype.render = function () {
      const id = self.eventId++;
      _render = false;
      let flushed = false;
      // We know if a render comes from flush before calling the render method
      if (this instanceof self.RootFiber && inFlush) {
        flushed = true;
      }
      originalRender.call(this, ...arguments);
      if (self.recordEvents) {
        const path = self.getComponentPath(this.node);
        // if the render comes from flush
        if (flushed) {
          window.top.postMessage({
            type: "owlDevtools__Event",
            data: {
              type: "root render (flushed)",
              component: this.node.name,
              key: this.node.parentKey,
              path: path,
              id: id,
            },
          });
          // if _render is called, it is a proper render (and not a delayed one)
        } else if (_render) {
          // A render on a RootFiber is a root render and can propagate other renders to its children
          if (this instanceof self.RootFiber) {
            window.top.postMessage({
              type: "owlDevtools__Event",
              data: {
                type: "root render",
                component: this.node.name,
                key: this.node.parentKey,
                path: path,
                id: id,
              },
            });
          // if the node status is NEW, the node has been created just before rendering
          } else if (this.node.status === 0) {
            window.top.postMessage({
              type: "owlDevtools__Event",
              data: {
                type: "create and render",
                component: this.node.name,
                key: this.node.parentKey,
                path: path,
                id: id,
              },
            });
          // else it is an update
          } else {
            window.top.postMessage({
              type: "owlDevtools__Event",
              data: {
                type: "update and render",
                component: this.node.name,
                key: this.node.parentKey,
                path: path,
                id: id,
              },
            });
          }
        // _render has not been called so it is a delayed render that could be flushed later on
        } else {
          window.top.postMessage({
            type: "owlDevtools__Event",
            data: {
              type: "root render (delayed)",
              component: this.node.name,
              key: this.node.parentKey,
              path: path,
              id: id,
            },
          });
        }
      }
    };
    const original_Render = self.Fiber.prototype._render;
    self.Fiber.prototype._render = function () {
      _render = true;
      original_Render.call(this, ...arguments);
    };
    // Signals when a component is destroyed
    if (app.root) {
      const originalDestroy = app.root.constructor.prototype._destroy;
      app.root.constructor.prototype._destroy = function () {
        if (self.recordEvents) {
          const path = self.getComponentPath(this);
          window.top.postMessage({
            type: "owlDevtools__Event",
            data: {
              type: "destroy",
              component: this.name,
              key: this.parentKey,
              path: path,
              id: self.eventId++,
            },
          });
        }
        originalDestroy.call(this, ...arguments);
      };
    }
  }

  // Enables/disables the recording of the render/destroy events based on value
  toggleEventsRecording(value, index) {
    this.recordEvents = value;
    this.eventId = index;
    return this.recordEvents;
  }

  // Reset the event ids (the events on devtools side will be cleared at the same time)
  resetEvents() {
    this.eventId = 0;
  }

  // Get the urls of all iframes present on the page
  getIFrameUrls() {
    let frames = [];
    for (const frame of document.getElementsByTagName("iframe")) {
      frames.push(frame.contentDocument.location.href);
    }
    return frames;
  }

  // Draws a highlighting rectangle on the specified html element and displays its dimensions and the specified name in a box
  highlightElements(elements, name) {
    this.removeHighlights();

    let minTop = Number.MAX_SAFE_INTEGER;
    let minLeft = Number.MAX_SAFE_INTEGER;
    let maxBottom = Number.MIN_SAFE_INTEGER;
    let maxRight = Number.MIN_SAFE_INTEGER;

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const top = rect.top + scrollTop;
      const left = rect.left + scrollLeft;
      const bottom = top + rect.height;
      const right = left + rect.width;

      const marginTop = parseInt(getComputedStyle(element).marginTop);
      const marginRight = parseInt(getComputedStyle(element).marginRight);
      const marginBottom = parseInt(getComputedStyle(element).marginBottom);
      const marginLeft = parseInt(getComputedStyle(element).marginLeft);

      const paddingTop = parseInt(getComputedStyle(element).paddingTop);
      const paddingRight = parseInt(getComputedStyle(element).paddingRight);
      const paddingBottom = parseInt(getComputedStyle(element).paddingBottom);
      const paddingLeft = parseInt(getComputedStyle(element).paddingLeft);

      minTop = Math.min(minTop, top);
      minLeft = Math.min(minLeft, left);
      maxBottom = Math.max(maxBottom, bottom);
      maxRight = Math.max(maxRight, right);

      const width = right - left;
      const height = bottom - top;

      const highlight = document.createElement("div");
      highlight.className = "owl-devtools-highlight";
      highlight.style.top = `${top}px`;
      highlight.style.left = `${left}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;
      highlight.style.position = "absolute";
      highlight.style.backgroundColor = "rgba(15, 139, 245, 0.4)";
      highlight.style.borderStyle = "solid";
      highlight.style.borderWidth = `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`;
      highlight.style.borderColor = "rgba(65, 196, 68, 0.4)";
      highlight.style.zIndex = "1000";
      highlight.style.pointerEvents = "none";
      document.body.appendChild(highlight);

      const highlightMargins = document.createElement("div");
      highlightMargins.className = "owl-devtools-highlight";
      highlightMargins.style.top = `${top - marginTop}px`;
      highlightMargins.style.left = `${left - marginLeft}px`;
      highlightMargins.style.width = `${width + marginLeft + marginRight}px`;
      highlightMargins.style.height = `${height + marginBottom + marginTop}px`;
      highlightMargins.style.position = "absolute";
      highlightMargins.style.borderStyle = "solid";
      highlightMargins.style.borderWidth = `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`;
      highlightMargins.style.borderColor = "rgba(241, 179, 121, 0.4)";
      highlightMargins.style.zIndex = "1000";
      highlightMargins.style.pointerEvents = "none";
      document.body.appendChild(highlightMargins);
    }

    const width = maxRight - minLeft;
    const height = maxBottom - minTop;

    const detailsBox = document.createElement("div");
    detailsBox.className = "owl-devtools-detailsBox";
    detailsBox.innerHTML = `
    <div style="color: #ffc107; display: inline;">${name} </div><div style="color: white; display: inline;">${width.toFixed(
      2
    )}px x ${height.toFixed(2)}px</div>
    `;
    detailsBox.style.position = "absolute";
    detailsBox.style.backgroundColor = "black";
    detailsBox.style.padding = "5px";
    detailsBox.style.zIndex = "1000";
    detailsBox.style.pointerEvents = "none";
    detailsBox.style.display = "inline";
    document.body.appendChild(detailsBox);

    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const detailsBoxRect = detailsBox.getBoundingClientRect();
    let detailsBoxTop = minTop + height + 5;
    let detailsBoxLeft = minLeft;
    if (detailsBoxTop + detailsBoxRect.height > viewportHeight) {
      detailsBoxTop = minTop - detailsBoxRect.height - 5;
      if (detailsBoxTop < 0) {
        detailsBoxTop = minTop;
      }
    }
    if (detailsBoxLeft + detailsBoxRect.width > viewportWidth) {
      detailsBoxLeft = minLeft - detailsBoxRect.width - 5;
    }
    detailsBox.style.top = `${detailsBoxTop}px`;
    detailsBox.style.left = `${detailsBoxLeft + 5}px`;
  }

  // Remove all elements drawn by the HighlightElement function
  removeHighlights() {
    const highlights = document.querySelectorAll(".owl-devtools-highlight");
    highlights.forEach((highlight) => highlight.remove());
    const details = document.querySelectorAll(".owl-devtools-detailsBox");
    details.forEach((detail) => detail.remove());
  }

  // Identify the hovered component based on the corresponding DOM element and send the Select message
  // when the target changes
  HTMLSelector = (ev) => {
    const target = ev.target;
    if (!this.currentSelectedElement || !target.isEqualNode(this.currentSelectedElement)) {
      const path = this.getElementPath(target);
      this.highlightComponent(path);
      this.currentSelectedElement = target;
      window.top.postMessage({ type: "owlDevtools__SelectElement", data: path });
    }
  };

  // Activate the HTML selector tool
  enableHTMLSelector() {
    document.addEventListener("mousemove", this.HTMLSelector);
    document.addEventListener("click", this.disableHTMLSelector, { capture: true });
    document.addEventListener("mouseout", this.removeHighlights);
  }

  // Diasble the HTML selector tool
  disableHTMLSelector = (ev = undefined) => {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    this.removeHighlights();
    document.removeEventListener("mousemove", this.HTMLSelector);
    document.removeEventListener("click", this.disableHTMLSelector, { capture: true });
    document.removeEventListener("mouseout", this.removeHighlights);
    window.top.postMessage({ type: "owlDevtools__StopSelector" });
  };

  // Defines how leaf object nodes should be displayed in the extension based on their type
  parseItem(value, asConstructorName = false) {
    if (typeof value === "array") {
      return "Array(" + value.length + ")";
    } else if (typeof value === "object") {
      if (value == null) return "null";
      if (asConstructorName) return value.constructor.name;
      return "{...}";
    } else if (typeof value === "undefined") return "undefined";
    else if (typeof value === "string") return '"' + value + '"';
    else if (typeof value === "function") {
      if (asConstructorName) return value.constructor.name;
      let functionString = value.toString();
      let index, offset;
      if (functionString.startsWith("class")) {
        index = functionString.indexOf("{");
        offset = 1;
      } else {
        let index1 = functionString.indexOf("){");
        let index2 = functionString.indexOf(") {");
        if (index1 === -1) {
          index = index2;
          offset = 3;
        } else if (index2 === -1) {
          index = index1;
          offset = 2;
        } else {
          index = min(index1, index2);
          offset = index1 < index2 ? 2 : 3;
        }
        if (index === -1)
          return functionString.length > 20
            ? functionString.substring(0, 18) + "..."
            : functionString;
      }
      functionString = functionString.substring(0, index + offset);
      return functionString + "...}";
    } else {
      let valueAsString = value.toString();
      if (asConstructorName && valueAsString.length > 10)
        valueAsString = valueAsString.substring(0, 8) + "...";
      return valueAsString;
    }
  }

  // Returns a shortened version of the property as a string
  parseContent(obj, type) {
    let result = "";
    let first = true;
    if (type === "array") {
      result += "[";
      for (const value of obj) {
        if (!first) result += ", ";
        else {
          first = false;
        }
        if (result.length > 30) {
          result += "...";
          break;
        }
        result += this.parseItem(value);
      }
      result += "]";
    } else if (type === "object") {
      result += "{";
      for (const [key, value] of Object.entries(obj)) {
        if (!first) result += ", " + key + ": ";
        else {
          first = false;
          result += key + ": ";
        }
        if (result.length > 30) {
          result += "...";
          break;
        }
        result += this.parseItem(value);
      }
      result += "}";
    } else if (type === "map") {
      result += "Map(" + obj.size + "){";
      for (const [key, value] of obj.entries()) {
        if (!first) result += ", " + this.parseItem(key, true) + " => ";
        else {
          first = false;
          result += this.parseItem(key, true) + " => ";
        }
        if (result.length > 30) {
          result += "...";
          break;
        }
        result += this.parseItem(value, true);
      }
      result += "}";
    } else if (type === "map entry") {
      result += "{" + this.parseItem(obj[0], true) + " => " + this.parseItem(obj[1], true) + "}";
    } else if (type === "set") {
      result += "Set(" + obj.size + "){";
      for (const value of obj) {
        if (!first) result += ", ";
        else {
          first = false;
        }
        if (result.length > 30) {
          result += "...";
          break;
        }
        result += this.parseItem(value);
      }
      result += "}";
    } else result += this.parseItem(obj);
    return result;
  }

  // Returns the object specified by the path given the top parent object
  getObject(topParent, path) {
    let obj = topParent;
    if (path.length === 0) return obj;
    for (const key of path) {
      if (typeof key === "object") {
        switch (key.type) {
          case "prototype":
            obj = Object.getPrototypeOf(obj);
            break;
          case "set entries":
          case "map entries":
            obj = Array.from(obj);
            break;
          case "set entry":
          case "map entry":
            obj = obj[key.index];
            break;
          case "set value":
            obj = obj[0];
            break;
          case "map key":
            obj = obj[0];
            break;
          case "map value":
            obj = obj[1];
            break;
          case "symbol":
            let symbol;
            Object.getOwnPropertySymbols(obj).forEach((sym) => {
              if (sym.toString() === key.key) {
                symbol = sym;
              }
            });
            if (symbol) obj = obj[symbol];
        }
      } else {
        if (
          Object.getOwnPropertyDescriptor(obj, key) &&
          Object.getOwnPropertyDescriptor(obj, key).hasOwnProperty("get")
        )
          obj = Object.getOwnPropertyDescriptor(obj, key).get;
        else obj = obj[key];
      }
      if (obj) obj = owl.toRaw(obj);
    }
    return obj;
  }

  // Returns the asked property given the component path and the property's path
  getPropertyObject(componentPath, objectPath) {
    const componentNode = this.getComponentNode(componentPath);
    let obj;
    if (objectPath[0] === "subscription") {
      const topParent = componentNode.subscriptions[objectPath[1]].target;
      obj = this.getObject(topParent, objectPath.slice(2));
    } else obj = this.getObject(componentNode.component, objectPath);
    return obj;
  }

  // Returns a parsed version of an object node that has compatible format with the devtools ObjectTreeElement component
  getParsedObjectChild(componentPath, parentObj, key, depth, type, path, oldBranch, oldTree) {
    let obj;
    let child = {
      depth: depth,
      toggled: false,
      objectType: type,
      hasChildren: false,
    };
    if (oldBranch?.toggled) child.toggled = true;
    child.path = path.concat([key]);
    if (typeof key === "object") {
      switch (key.type) {
        case "prototype":
          child.name = "[[Prototype]]";
          child.contentType = "object";
          child.content = this.parseItem(parentObj, true);
          child.hasChildren = true;
          break;
        case "set entries":
        case "map entries":
          child.name = "[[Entries]]";
          child.content = "";
          child.contentType = "array";
          child.hasChildren = true;
          break;
        case "set entry":
        case "map entry":
          child.name = key.index;
          child.contentType = "object";
          child.content = this.parseContent(parentObj[key.index], key.type);
          child.hasChildren = true;
          break;
        case "set value":
          child.name = "value";
          obj = parentObj[0];
          break;
        case "map key":
          child.name = "key";
          obj = parentObj[0];
          break;
        case "map value":
          child.name = "value";
          obj = parentObj[1];
          break;
      }
      if (child.contentType) {
        child.children = [];
        if (child.toggled)
          child.children = this.loadObjectChildren(
            componentPath,
            child.path,
            child.depth,
            child.contentType,
            child.objectType,
            oldTree
          );
        return child;
      }
    } else if (
      Object.getOwnPropertyDescriptor(parentObj, key) &&
      Object.getOwnPropertyDescriptor(parentObj, key).hasOwnProperty("get")
    ) {
      child.name = key;
      obj = Object.getOwnPropertyDescriptor(parentObj, key).get;
    } else {
      child.name = key;
      if (typeof key === "symbol") {
        child.name = key.toString();
        child.path = path.concat([{ type: "symbol", key: key.toString() }]);
      }
      try {
        obj = parentObj[key];
      } catch (e) {
        return null;
      }
    }
    if (obj == null) {
      if (typeof obj === "undefined") {
        child.content = "undefined";
        child.contentType = "undefined";
      } else {
        child.content = "null";
        child.contentType = "object";
      }
      child.hasChildren = false;
    } else {
      obj = owl.toRaw(obj);
      switch (true) {
        case obj instanceof Map:
          child.contentType = "map";
          child.hasChildren = true;
          break;
        case obj instanceof Set:
          child.contentType = "set";
          child.hasChildren = true;
          break;
        case obj instanceof Array:
          child.contentType = "array";
          child.hasChildren = true;
          break;
        case typeof obj === "function":
          child.contentType = "function";
          child.hasChildren = true;
          break;
        case obj instanceof Object:
          child.contentType = "object";
          child.hasChildren = true;
          break;
        default:
          child.contentType = typeof obj;
          child.hasChildren = false;
      }
      child.content = this.parseContent(obj, child.contentType);
    }
    child.children = [];
    if (child.toggled) {
      child.children = this.loadObjectChildren(
        componentPath,
        child.path,
        child.depth,
        child.contentType,
        child.objectType,
        oldTree
      );
    }
    return child;
  }

  // returns the parsed object in the parsed tree
  getObjectInOldTree(oldTree, objPath, objType) {
    let path = [...objPath];
    let obj;
    if (objType !== "instance") path.shift();
    if (typeof path[0] === "object") {
      if (path[0].type === "prototype") {
        path[0] = "[[Prototype]]";
      } else path[0] = path[0].key;
    }
    if (objType === "props") obj = oldTree.props[path[0]];
    else if (objType === "env") obj = oldTree.env[path[0]];
    else if (objType === "instance") obj = oldTree.instance[path[0]];
    else if (objType === "subscription") obj = oldTree.subscriptions[path[0]].target;
    for (let i = 1; i < path.length; i++) {
      const match = path[i];
      if (typeof match === "object") {
        switch (match.type) {
          case "map entries":
          case "set entries":
            obj = obj.children.filter((child) => child.name === "[[Entries]]")[0];
            break;
          case "map entry":
          case "set entry":
            obj = obj.children[match.index];
            break;
          case "map key":
          case "set value":
            obj = obj.children[0];
            break;
          case "map value":
            obj = obj.children[1];
            break;
          case "prototype":
            obj = obj.children.filter((child) => child.name === "[[Prototype]]")[0];
            break;
          case "symbol":
            obj = obj.children.filter((child) => child.name === match.key)[0];
        }
      } else if (obj.contentType === "array") obj = obj.children[match];
      else obj = obj.children.filter((child) => child.name === match)[0];
    }
    return obj;
  }
  // Returns a parsed version of the children properties of the specified component's property given its path.
  loadObjectChildren(componentPath, objPath, depth, type, objType, oldTree) {
    let children = [];
    depth = depth + 1;
    let obj = this.getPropertyObject(componentPath, objPath);
    let oldBranch = this.getObjectInOldTree(oldTree, objPath, objType);
    if (!obj) return [];
    let index = 0;
    const lastKey = objPath.at(-1);
    let prototype;
    switch (type) {
      case "array":
        if (typeof lastKey === "object" && lastKey.type.includes("entries")) {
          for (; index < obj.length; index++) {
            const child = this.getParsedObjectChild(
              componentPath,
              obj,
              { type: lastKey.type.replace("entries", "entry"), index: index },
              depth,
              objType,
              objPath,
              oldBranch.children[index],
              oldTree
            );
            if (child) children.push(child);
          }
        } else {
          for (; index < obj.length; index++) {
            const child = this.getParsedObjectChild(
              componentPath,
              obj,
              index.toString(),
              depth,
              objType,
              objPath,
              oldBranch.children[index],
              oldTree
            );
            if (child) children.push(child);
          }
        }
        break;
      case "set":
      case "map":
        const entries = this.getParsedObjectChild(
          componentPath,
          obj,
          { type: type + " entries" },
          depth,
          objType,
          objPath,
          oldBranch.children[index],
          oldTree
        );
        if (entries) {
          children.push(entries);
          index++;
        }
        const size = this.getParsedObjectChild(
          componentPath,
          obj,
          "size",
          depth,
          objType,
          objPath,
          oldBranch.children[index],
          oldTree
        );
        if (size) {
          children.push(size);
          index++;
        }
        Reflect.ownKeys(obj).forEach((key) => {
          const child = this.getParsedObjectChild(
            componentPath,
            obj,
            key,
            depth,
            objType,
            objPath,
            oldBranch.children[index],
            oldTree
          );
          if (child) children.push(child);
          index++;
        });
        prototype = this.getParsedObjectChild(
          componentPath,
          obj,
          { type: "prototype" },
          depth,
          objType,
          objPath,
          oldBranch.children.at(-1),
          oldTree
        );
        children.push(prototype);
        break;
      case "object":
      case "function":
        if (typeof lastKey === "object" && lastKey.type.includes("entry")) {
          if (lastKey.type === "map entry") {
            const mapKey = this.getParsedObjectChild(
              componentPath,
              obj,
              { type: "map key" },
              depth,
              objType,
              objPath,
              oldBranch.children[index],
              oldTree
            );
            children.push(mapKey);
            const mapValue = this.getParsedObjectChild(
              componentPath,
              obj,
              { type: "map value" },
              depth,
              objType,
              objPath,
              oldBranch.children[index],
              oldTree
            );
            children.push(mapValue);
          } else if (lastKey.type === "set entry") {
            const setValue = this.getParsedObjectChild(
              componentPath,
              obj,
              { type: "set value" },
              depth,
              objType,
              objPath,
              oldBranch.children[index],
              oldTree
            );
            children.push(setValue);
          }
        } else {
          Reflect.ownKeys(obj).forEach((key) => {
            const child = this.getParsedObjectChild(
              componentPath,
              obj,
              key,
              depth,
              objType,
              objPath,
              oldBranch.children[index],
              oldTree
            );
            if (child) children.push(child);
            index++;
          });
          prototype = this.getParsedObjectChild(
            componentPath,
            obj,
            { type: "prototype" },
            depth,
            objType,
            objPath,
            oldBranch.children.at(-1),
            oldTree
          );
          children.push(prototype);
        }
    }
    return children;
  }
  // Returns the Component node given its path and the root component node
  getComponentNode(path) {
    let componentNode = Array.from(this.apps)[path[0]].root;
    for (let i = 2; i < path.length; i++) {
      if (componentNode.children.hasOwnProperty(path[i]))
        componentNode = componentNode.children[path[i]];
      else return null;
    }
    return componentNode;
  }
  // Apply manual render to the specified component
  refreshComponent(path) {
    const componentNode = this.getComponentNode(path);
    componentNode.render(true);
  }
  // Returns the component's details given its path
  getComponentDetails(path = null, oldTree = null) {
    let component = {};
    if (!path) {
      path = this.getElementPath($0);
    }
    component.path = path;
    let node = this.getComponentNode(path);
    let i = 0;
    while (!node && i < Array.from(this.apps).length) node = Array.from(this.apps)[i++].root;
    if(!node) return null;
    // Load props of the component
    const props = node.component.props;
    component.props = {};
    component.name = node.component.constructor.name;
    Reflect.ownKeys(props).forEach((key) => {
      let oldBranch = oldTree?.props[key];
      if (typeof key === "symbol") oldBranch = oldTree?.props[key.toString()];
      const property = this.getParsedObjectChild(
        path,
        props,
        key,
        0,
        "props",
        ["props"],
        oldBranch,
        oldTree
      );
      if (property) {
        if (typeof key === "symbol") component.props[key.toString()] = property;
        else component.props[key] = property;
      }
    });
    // Load env of the component
    const env = node.component.env;
    component.env = {};
    Reflect.ownKeys(env).forEach((key) => {
      let oldBranch = oldTree?.env[key];
      if (typeof key === "symbol") oldBranch = oldTree?.env[key.toString()];
      const envElement = this.getParsedObjectChild(
        path,
        env,
        key,
        0,
        "env",
        ["env"],
        oldBranch,
        oldTree
      );
      if (envElement) {
        if (typeof key === "symbol") component.env[key.toString()] = envElement;
        else component.env[key] = envElement;
      }
    });
    const envPrototype = this.getParsedObjectChild(
      path,
      env,
      { type: "prototype" },
      0,
      "env",
      ["env"],
      oldTree?.env["[[Prototype]]"],
      oldTree
    );
    component.env["[[Prototype]]"] = envPrototype;
    // Load instance of the component
    const instance = node.component;
    component.instance = {};
    Reflect.ownKeys(instance).forEach((key) => {
      if (!["env", "props"].includes(key)) {
        let oldBranch = oldTree?.instance[key];
        if (typeof key === "symbol") oldBranch = oldTree?.instance[key.toString()];
        const instanceElement = this.getParsedObjectChild(
          path,
          instance,
          key,
          0,
          "instance",
          [],
          oldBranch,
          oldTree
        );
        if (instanceElement) {
          if (typeof key === "symbol") component.instance[key.toString()] = instanceElement;
          else component.instance[key] = instanceElement;
        }
      }
    });
    // Load instance getters
    let obj = Object.getPrototypeOf(instance);
    while (obj) {
      Reflect.ownKeys(obj).forEach((key) => {
        if (Object.getOwnPropertyDescriptor(obj, key).hasOwnProperty("get")) {
          let child = {
            name: key,
            depth: 0,
            toggled: false,
            objectType: "instance",
            path: [key],
            contentType: "getter",
            content: "(...)",
            hasChildren: false,
            children: [],
          };
          component.instance[key] = child;
        }
      });
      obj = Object.getPrototypeOf(obj);
    }
    const instancePrototype = this.getParsedObjectChild(
      path,
      instance,
      { type: "prototype" },
      0,
      "instance",
      [],
      oldTree?.instance["[[Prototype]]"],
      oldTree
    );
    component.instance["[[Prototype]]"] = instancePrototype;

    // Load subscriptions of the component
    const rawSubscriptions = node.subscriptions;
    component.subscriptions = [];
    rawSubscriptions.forEach((rawSubscription, index) => {
      let subscription = {
        keys: [],
        target: {
          name: "target",
          contentType:
            typeof rawSubscription.target === "object"
              ? Array.isArray(rawSubscription.target)
                ? "array"
                : "object"
              : rawSubscription.target,
          depth: 0,
          path: ["subscription", index.toString()],
          toggled: false,
          objectType: "subscription",
        },
        keysExpanded: false,
      };
      if (oldTree && oldTree.subscriptions[index] && oldTree.subscriptions[index].target.toggled) {
        subscription.target.toggled = true;
      }
      rawSubscription.keys.forEach((key) => {
        if (typeof key === "symbol") subscription.keys.push(key.toString());
        else subscription.keys.push(key);
      });
      if (rawSubscription.target == null) {
        if (subscription.target.contentType === "undefined")
          subscription.target.content = "undefined";
        else subscription.target.content = "null";
        subscription.target.hasChildren = false;
      } else {
        subscription.target.content = this.parseContent(
          rawSubscription.target,
          subscription.target.contentType
        );
        subscription.target.hasChildren =
          subscription.target.contentType === "object"
            ? Object.keys(rawSubscription.target).length > 0
            : subscription.target.contentType === "array"
            ? rawSubscription.target.length > 0
            : false;
      }
      subscription.target.children = [];
      if (subscription.target.toggled) {
        subscription.target.children = this.loadObjectChildren(
          component.path,
          subscription.target.path,
          subscription.target.depth,
          subscription.target.contentType,
          subscription.target.objectType,
          oldTree
        );
      }
      component.subscriptions.push(subscription);
    });
    return component;
  }
  // Replace the content of a parsed getter object with the result of the corresponding get method
  loadGetterContent(componentPath, getter) {
    let obj = this.getPropertyObject(componentPath, getter.path);
    if (obj == null) {
      if (typeof obj === "undefined") {
        getter.content = "undefined";
        getter.contentType = "undefined";
      } else {
        getter.content = "null";
        getter.contentType = "object";
      }
      getter.hasChildren = false;
    } else {
      obj = owl.toRaw(obj);
      switch (true) {
        case obj instanceof Map:
          getter.contentType = "map";
          getter.hasChildren = obj.size > 0;
          break;
        case obj instanceof Set:
          getter.contentType = "set";
          getter.hasChildren = obj.size > 0;
          break;
        case obj instanceof Array:
          getter.contentType = "array";
          getter.hasChildren = obj.length > 0;
          break;
        case typeof obj === "function":
          getter.contentType = "function";
          getter.hasChildren = Reflect.ownKeys(obj).length > 0;
          break;
        case obj instanceof Object:
          getter.contentType = "object";
          getter.hasChildren = Reflect.ownKeys(obj).length > 0;
          break;
        default:
          getter.contentType = typeof obj;
          getter.hasChildren = false;
      }
      getter.content = this.parseContent(obj, getter.contentType);
    }
    return getter;
  }
  // Gives the DOM elements which correspond to the given component node
  getDOMElementsRecursive(node) {
    if (node.hasOwnProperty("bdom")) return this.getDOMElementsRecursive(node.bdom);
    if (node.hasOwnProperty("content")) return this.getDOMElementsRecursive(node.content);
    if (node.hasOwnProperty("el")) return [node.el];
    if (node.hasOwnProperty("child")) return this.getDOMElementsRecursive(node.child);
    if (node.hasOwnProperty("children") && node.children.length > 0) {
      let elements = [];
      for (const child of node.children) {
        if (child) elements = elements.concat(this.getDOMElementsRecursive(child));
      }
      if (elements.length > 0) {
        return elements;
      }
    }
    if (node.hasOwnProperty("parentEl")) return [node.parentEl];
  }
  // Triggers the highlight effect around the specified component.
  highlightComponent(path) {
    let component = this.getComponentNode(path);
    if(!component)
      return;
    const elements = this.getDOMElementsRecursive(component);
    this.highlightElements(elements, component.component.constructor.name);
  }
  // Recursively fills the components tree as a parsed version
  fillTree(appNode, treeNode, inspectedPathString, oldBranch) {
    let children = [];
    for (const [key, appChild] of Object.entries(appNode.children)) {
      let child = {
        name: appChild.component.constructor.name,
        key: key,
        depth: treeNode.depth + 1,
        toggled: false,
        selected: false,
        highlighted: false,
      };
      child.path = treeNode.path.concat([child.key]);
      let oldChild = null;
      if (oldBranch) {
        const searchResult = oldBranch.children.filter((o) => o.key === key);
        if (searchResult.length > 0) {
          oldChild = searchResult[0];
          child.toggled = oldChild.toggled;
        }
      }
      const childPathString = child.path.join("/");
      if (childPathString === inspectedPathString) {
        child.selected = true;
      } else if (childPathString.includes(inspectedPathString)) {
        child.highlighted = true;
      }
      child.children = this.fillTree(appChild, child, inspectedPathString, oldChild);
      children.push(child);
    }
    return children;
  }
  // Edit a reactive state property with the provided value of the given component (path) and the subscription path
  editObject(componentPath, objectPath, value, objectType) {
    const componentNode = this.getComponentNode(componentPath);
    if (objectType === "subscription") {
      const target = owl.reactive(componentNode.subscriptions[objectPath[1]].target);
      objectPath.slice(2).reduce((acc, curr, idx, arr) => {
        if (idx === arr.length - 1) {
          acc[curr] = value;
        }
        return acc[curr];
      }, target);
    } else {
      const key = objectPath.pop();
      const obj = this.getObject(componentNode.component, objectPath);
      if (!obj) return;
      obj[key] = value;
      if (objectType === "props" || objectType === "instance") componentNode.render(true);
      else if (objectType === "env") Array.from(this.apps)[componentPath[0]].root.render(true);
    }
  }
  // Recursively checks if the given html element corresponds to a component in the components tree.
  // Immediatly returns the path of the first component which matches the element
  searchElement(node, path, element) {
    if (!node?.bdom) {
      return null;
    }
    const results = this.getDOMElementsRecursive(node);
    let hasElementInChilds = false;
    for (const result of results) {
      if (result.isEqualNode(element)) return path;
      if (result.contains(element)) hasElementInChilds = true;
    }
    if (hasElementInChilds) {
      for (const [key, child] of Object.entries(node.children)) {
        const result = this.searchElement(child, path.concat([key]), element);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }
  // Returns the path to the component which is currently being inspected
  getElementPath(element) {
    if (element) {
      // Create an array with the html element and all its successive parents
      let parentsList = [element];
      if (element.tagName !== "BODY") {
        while (element.parentElement.tagName !== "BODY") {
          element = element.parentElement;
          parentsList.push(element);
        }
      }
      const appsArray = Array.from(this.apps);
      for (const [index, app] of appsArray.entries()) {
        // Try to find a correspondance between the elements in the array and the owl component, stops at first result found
        for (const elem of parentsList) {
          const inspectedPath = this.searchElement(app.root, ["root"], elem);
          if (inspectedPath) {
            inspectedPath.unshift(index.toString());
            return inspectedPath;
          }
        }
      }
    }
    // If nothing was found, return the first app's root component path
    return ["0", "root"];
  }
  // Returns the tree of components of the inspected page in a parsed format
  // Use inspectedPath to specify the path of the selected component
  getComponentsTree(inspectedPath = null, oldTrees = null) {
    const appsArray = Array.from(this.apps);
    let trees = [];
    appsArray.forEach((app, index) => {
      let oldTree;
      if (oldTrees) oldTree = oldTrees[index];
      let root = {};
      root = {
        name: "App " + (index + 1),
        path: [index.toString()],
        key: "",
        depth: 0,
        toggled: false,
        selected: false,
        highlighted: false,
        children: [],
      };
      if (app.root) {
        const appRoot = {
          name: app.root.component.constructor.name,
          path: [index.toString(), "root"],
          key: "",
          depth: 1,
          toggled: false,
          selected: false,
          highlighted: false,
        };
        if (oldTree) {
          if (oldTree.toggled) root.toggled = true;
          oldTree = oldTree.children[0];
        }
        if (oldTree && oldTree.toggled) appRoot.toggled = true;
        // If no path is provided, it defaults to the target of the inspect element action
        if (!inspectedPath) {
          inspectedPath = this.getElementPath($0);
        }
        if (inspectedPath.join("/") === index.toString()) root.selected = true;
        else if (inspectedPath.join("/") === index.toString() + "/root") appRoot.selected = true;
        appRoot.children = this.fillTree(app.root, appRoot, inspectedPath.join("/"), oldTree);
        root.children = [appRoot];
      }
      trees.push(root);
    });
    return trees;
  }
  // Returns the path of the given component node
  getComponentPath(componentNode) {
    let path = [];
    if (componentNode.parentKey) {
      path = [componentNode.parentKey];
      while (componentNode.parent && componentNode.parent.parentKey) {
        componentNode = componentNode.parent;
        path.unshift(componentNode.parentKey);
      }
    }
    path.unshift("root");
    const appsArray = Array.from(this.apps);
    let index = 0;
    for (; index < appsArray.length; index++) {
      if (appsArray[index]?.Root?.name === componentNode.app.Root.name) break;
    }
    path.unshift(index.toString());
    return path;
  }
  // Store the object into a temp window variable and log it to the console
  sendObjectToConsole(componentPath, objectType) {
    const componentNode = this.getComponentNode(componentPath);
    let index = 1;
    while (window["temp" + index] !== undefined) index++;
    switch (objectType) {
      case "component":
        window["temp" + index] = componentNode;
        break;
      case "props":
        window["temp" + index] = componentNode.component.props;
        break;
      case "env":
        window["temp" + index] = componentNode.component.env;
        break;
      case "instance":
        window["temp" + index] = componentNode.component;
        break;
      case "subscription":
        window["temp" + index] = componentNode.subscriptions;
        break;
    }
    console.log("temp" + index + " = ", window["temp" + index]);
  }
  // Inspect the DOM of the component in the elements tab of the devtools
  inspectComponentDOM(componentPath) {
    const componentNode = this.getComponentNode(componentPath);
    const elements = this.getDOMElementsRecursive(componentNode);
    inspect(elements[0]);
  }
  // Inspect source code of the component (corresponds to inspecting its constructor)
  inspectComponentSource(componentPath) {
    const componentNode = this.getComponentNode(componentPath);
    inspect(componentNode.component.constructor);
  }
  // Inspect the DOM of the component in the elements tab of the devtools
  inspectComponentCompiledTemplate(componentPath) {
    const componentNode = this.getComponentNode(componentPath);
    const template = componentNode.component.constructor.template;
    inspect(componentNode.app.templates[template]);
  }
  // Inspect source code of the component (corresponds to inspecting its constructor)
  inspectComponentRawTemplate(componentPath) {
    const componentNode = this.getComponentNode(componentPath);
    const template = componentNode.component.constructor.template;
    const templateNode = componentNode.app.rawTemplates[template];
    console.log(templateNode);
  }
  // Inspect source code of the function given by its path and the component path
  inspectFunctionSource(componentPath, objectPath) {
    const componentNode = this.getComponentNode(componentPath);
    const topParent =
      objectPath[0] === "subscription" ? componentNode.subscriptions : componentNode.component;
    inspect(this.getObject(topParent, objectPath));
  }
  // Store the object given by its path and the component path as a global temp variable
  storeObjectAsGlobal(componentPath, objectPath) {
    let obj = this.getPropertyObject(componentPath, objectPath);
    let index = 1;
    while (window["temp" + index] !== undefined) index++;
    window["temp" + index] = obj;
    console.log("temp" + index + " = ", window["temp" + index]);
  }
}
