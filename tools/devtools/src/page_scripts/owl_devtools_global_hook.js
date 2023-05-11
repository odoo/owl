(function () {
  "use strict";

  const IS_FIREFOX = navigator.userAgent.indexOf("Firefox") !== -1;

  class OwlDevtoolsGlobalHook {
    constructor() {
      // The set of apps exposed by owl
      this.apps = window.__OWL_DEVTOOLS__.apps;
      // Class definition of an owl Fiber
      this.Fiber = window.__OWL_DEVTOOLS__.Fiber;
      // Same but for RootFiber
      this.RootFiber = window.__OWL_DEVTOOLS__.RootFiber;
      // Set to keep track of the fibers that are in the flush queue
      this.queuedFibers = new WeakSet();
      // Set to keep track of the HTML elements we added to the page
      this.addedElements = [];
      // To keep track of the succession order of the render events
      this.eventId = 0;
      // Set to keep track of the frame on which this script is loaded
      this.frame = "top";
      // Allows to launch a message each time an iframe html element is added to the page
      const self = this;
      const iFrameObserver = new MutationObserver(function (mutationsList) {
        mutationsList.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (addedNode) {
            if (addedNode.tagName == "IFRAME") {
              // Ensure it is not an empty iframe element
              if (addedNode.contentDocument) {
                /*
                 * This message is intercepted by the content script which relays it to the background script which relays it to the devtools app.
                 * This process may seem long and indirect but is necessary. This applies to all window.top.postMessage methods in this file.
                 * More information in the docs: https://developer.chrome.com/docs/extensions/mv3/devtools/#evaluated-scripts-to-devtools
                 */
                window.top.postMessage({
                  source: "owl-devtools",
                  type: "NewIFrame",
                  data: addedNode.contentDocument.location.href,
                });
              }
            }
          });
        });
      });
      iFrameObserver.observe(document.body, { subtree: true, childList: true });
      this.appsPatched = false;
      this.destroyPatched = false;
      this.patchAppsSetMethods();
      this.recordEvents = false;
      this.traceRenderings = false;
      this.traceSubscriptions = false;
      this.requestedFrame = false;
      this.eventsBatch = [];
      // Object which defines how different types of data should be displayed when passed to the devtools
      this.serializer = {
        // Defines how leaf object nodes should be displayed in the extension when inside a bigger structure
        // This is also used by default when it is a standalone item (like functions, numbers, strings, etc)
        // The asConstructorName parameter can be passed to change the display of objects and functions to
        // be their constructor name (useful for prototype, map and set display)
        serializeItem(value, asConstructorName = false) {
          if (typeof value === "array") {
            return "Array(" + value.length + ")";
          } else if (typeof value === "object") {
            if (value == null) {
              return "null";
            }
            if (asConstructorName) {
              return value.constructor.name;
            }
            return "{...}";
          } else if (typeof value === "undefined") {
            return "undefined";
          } else if (typeof value === "string") {
            return JSON.stringify(value);
          } else if (typeof value === "function") {
            if (asConstructorName) {
              return value.constructor.name;
            }
            let functionString = value.toString();
            if (functionString.startsWith("class")) {
              return "class " + value.name;
            } else {
              // This replaces the body of any function with curly braces by ...
              const regex = /\{(?![^()]*\))(.*?)\}(?![^{}]*\})/s;
              return functionString.replace(regex, "{...}");
            }
          } else {
            let valueAsString = value.toString();
            if (asConstructorName && valueAsString.length > 10) {
              valueAsString = valueAsString.substring(0, 8) + "...";
            }
            return valueAsString;
          }
        },
        array(arr) {
          const result = [];
          let length = 0;
          for (const item of arr) {
            if (length > 25) {
              result.push("...");
              break;
            }
            const element = this.serializeItem(item);
            length += element.length;
            result.push(element);
          }
          return "[" + result.join(", ") + "]";
        },
        object(obj) {
          const result = [];
          let length = 0;
          for (const [key, value] of Object.entries(obj)) {
            if (length > 25) {
              result.push("...");
              break;
            }
            const element = key + ": " + this.serializeItem(value);
            length += element.length;
            result.push(element);
          }
          return "{" + result.join(", ") + "}";
        },
        map(obj) {
          const result = [];
          let length = 0;
          for (const [key, value] of obj.entries()) {
            if (length > 25) {
              result.push("...");
              break;
            }
            const element =
              this.serializeItem(key, true) + " => " + this.serializeItem(value, true);
            length += element.length;
            result.push(element);
          }
          return "Map(" + obj.size + "){" + result.join(", ") + "}";
        },
        ["map entry"](obj) {
          return (
            "{" + this.serializeItem(obj[0], true) + " => " + this.serializeItem(obj[1], true) + "}"
          );
        },
        set(obj) {
          const result = [];
          let length = 0;
          for (const value of obj) {
            if (length > 25) {
              result.push("...");
              break;
            }
            const element = this.serializeItem(value, false);
            length += element.length;
            result.push(element);
          }
          return "Set(" + obj.size + "){" + result.join(", ") + "}";
        },
        // Returns a shortened string version of a collection of properties for display purposes
        // Shortcut for serializeItem when it is a standalone item
        serializeContent(item, type) {
          if (this[type]) {
            return this[type](item);
          }
          return this.serializeItem(item);
        },
      };
    }

    // Modify the methods of the apps set in order to send a message each time it is modified.
    patchAppsSetMethods() {
      const originalAdd = this.apps.add;
      const originalDelete = this.apps.delete;
      const self = this;
      this.apps.add = function () {
        originalAdd.call(this, ...arguments);
        if (!self.destroyPatched) {
          const newApp = arguments[0];
          // It is not a given that apps have a root node at creation so we need to wait
          if (newApp.root) {
            self.patchDestroyMethod(newApp.root);
          } else {
            let root = null;
            Object.defineProperty(newApp, "root", {
              get() {
                return root;
              },
              set(value) {
                root = value;
                if (!self.destroyPatched) {
                  self.patchDestroyMethod(root);
                }
              },
            });
          }
        }
        self.patchAppMethods();
        window.top.postMessage({
          source: "owl-devtools",
          type: "RefreshApps",
        });
      };
      this.apps.delete = function () {
        originalDelete.call(this, ...arguments);
        window.top.postMessage({
          source: "owl-devtools",
          type: "RefreshApps",
        });
      };
    }

    patchDestroyMethod(root) {
      if (!this.destroyPatched) {
        // Signals when a component is destroyed
        const originalDestroy = root.constructor.prototype._destroy;
        const self = this;
        root.constructor.prototype._destroy = function () {
          if (self.recordEvents) {
            const path = self.getComponentPath(this);
            const event = {
              type: "destroy",
              component: this.name,
              key: this.parentKey,
              path: path,
              time: 0,
              id: self.eventId++,
            };
            self.eventsBatch.push(event);
            const before = performance.now();
            originalDestroy.call(this, ...arguments);
            event.time = performance.now() - before;
          } else {
            originalDestroy.call(this, ...arguments);
          }
        };
        this.destroyPatched = true;
      }
    }

    // Modify methods of each app so that it triggers messages on each flush and component render
    patchAppMethods() {
      if (this.appsPatched) {
        return;
      }
      let app = this.apps.values().next().value;
      if (!app) {
        return;
      }
      const originalFlush = app.scheduler.constructor.prototype.flush;
      let inFlush = false;
      let _render = false;
      const self = this;
      app.scheduler.constructor.prototype.flush = function () {
        // Used to know when a render is triggered inside the flush method or not
        inFlush = true;
        [...this.tasks].map((fiber) => {
          if (fiber.counter === 0 && !self.queuedFibers.has(fiber)) {
            self.queuedFibers.add(fiber);
            const path = self.getComponentPath(fiber.node);
            //Add a functionnality to the flush function which sends a message to the window every time it is triggered.
            window.top.postMessage({
              source: "owl-devtools",
              type: "Flush",
              data: path,
              origin: { frame: self.frame },
            });
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

        // patch the renderFn function from the node to only measure the time
        // spent in the template, not in additional work, such as flushing scheduler
        const node = this.node;
        const nodeRenderFn = node.renderFn;
        let time = 0;
        this.node.renderFn = function () {
          const before = performance.now();
          const result = nodeRenderFn.call(this);
          time = performance.now() - before;
          // unpatch the node render function
          node.renderFn = nodeRenderFn;
          return result;
        };

        originalRender.call(this, ...arguments);
        if (_render && self.traceRenderings && this instanceof self.RootFiber) {
          console.groupCollapsed(`Rendering <${this.node.name}>`);
          console.trace();
          console.groupEnd();
        }
        if (self.recordEvents) {
          const path = self.getComponentPath(this.node);
          // if the render comes from flush
          if (flushed) {
            self.eventsBatch.push({
              type: "render (flushed)",
              component: this.node.name,
              key: this.node.parentKey ? this.node.parentKey : "",
              path: path,
              time: time,
              id: id,
            });
            // if _render is called, it is a proper render (and not a delayed one)
          } else if (_render) {
            // A render on a RootFiber is a root render and can propagate other renders to its children
            if (this instanceof self.RootFiber) {
              self.eventsBatch.push({
                type: this.deep ? "render (deep)" : "render",
                component: this.node.name,
                key: this.node.parentKey ? this.node.parentKey : "",
                path: path,
                time: time,
                id: id,
              });
              // if the node status is NEW, the node has been created just before rendering
            } else if (this.node.status === 0) {
              self.eventsBatch.push({
                type: "create",
                component: this.node.name,
                key: this.node.parentKey ? this.node.parentKey : "",
                path: path,
                time: time,
                id: id,
              });
              // else it is an update
            } else {
              self.eventsBatch.push({
                type: "update",
                component: this.node.name,
                key: this.node.parentKey ? this.node.parentKey : "",
                path: path,
                time: time,
                id: id,
              });
            }
            // _render has not been called so it is a delayed render that could be flushed later on
          } else {
            self.eventsBatch.push({
              type: "render (delayed)",
              component: this.node.name,
              key: this.node.parentKey ? this.node.parentKey : "",
              path: path,
              time: time,
              id: id,
            });
          }
        }
      };
      const original_Render = self.Fiber.prototype._render;
      self.Fiber.prototype._render = function () {
        _render = true;
        original_Render.call(this, ...arguments);
      };
      // Flush the events batcher when a root render is completed
      const original_Complete = self.RootFiber.prototype.complete;
      self.RootFiber.prototype.complete = function () {
        original_Complete.call(this, ...arguments);
        if (self.recordEvents) {
          window.top.postMessage({
            source: "owl-devtools",
            type: "Event",
            data: self.eventsBatch,
          });
          self.eventsBatch = [];
        }
      };
      this.appsPatched = true;
    }

    // patch reactivity system to activate subscription tracing
    patchReactivity() {
      // i am simultaneously proud and ashamed of this code...
      const WeakMapGet = WeakMap.prototype.get;
      const MapGet = Map.prototype.get;
      const SetAdd = Set.prototype.add;
      const self = this;

      let callbacksToTargets;
      let targetToKeysToCallbacks;

      // Step 1: extract internal values from owl
      const obj = owl.reactive({}, () => {});
      let count = 0;
      WeakMap.prototype.get = function () {
        count++;
        if (count === 1) {
          targetToKeysToCallbacks = this;
        }
        if (count === 3) {
          callbacksToTargets = this;
          WeakMap.prototype.get = WeakMapGet;
        }
        return WeakMapGet.call(this, ...arguments);
      };
      obj.a;

      // Step 2: patch these objects
      let key;
      function getKey(_key) {
        key = _key;
        return MapGet.call(this, _key);
      }

      targetToKeysToCallbacks.get = function (target) {
        const keyToCallbacks = WeakMapGet.call(this, target);
        if (keyToCallbacks) {
          keyToCallbacks.get = getKey;
        }
        return keyToCallbacks;
      };

      function addTarget(target) {
        // HERE
        if (self.traceSubscriptions && !this.has(target)) {
          console.groupCollapsed(`Observing:`, key, target);
          console.trace();
          console.groupEnd();
        }
        return SetAdd.call(this, target);
      }
      callbacksToTargets.get = function (callback) {
        const targets = WeakMapGet.call(this, callback);
        if (targets) {
          targets.add = addTarget;
        }
        return targets;
      };
    }

    toggleTracing(value) {
      this.traceRenderings = value;
      return this.traceRenderings;
    }
    toggleSubscriptionTracing(value) {
      if (value) {
        this.patchReactivity();
        this.patchReactivity = () => {}; // to only patch once
      }
      this.traceSubscriptions = value;
      return value;
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
      for (const frame of document.querySelectorAll("iframe")) {
        frames.push(frame.contentDocument.location.href);
      }
      return frames;
    }

    // Draws a highlighting rectangle on the specified html element and displays its dimensions and the specified name in a box
    highlightElements(elements, name) {
      this.removeHighlights();

      if (elements.length === 0) {
        return;
      }

      let minTop = Number.MAX_SAFE_INTEGER;
      let minLeft = Number.MAX_SAFE_INTEGER;
      let maxBottom = Number.MIN_SAFE_INTEGER;
      let maxRight = Number.MIN_SAFE_INTEGER;

      for (const element of elements) {
        let rect;
        // Since this function accepts text nodes, we need to create a range to get the position and dimensions
        if (element instanceof Text) {
          const range = document.createRange();
          range.selectNode(element);
          rect = range.getBoundingClientRect();
        } else {
          rect = element.getBoundingClientRect();
        }

        const top = rect.top;
        const left = rect.left;
        const bottom = top + rect.height;
        const right = left + rect.width;

        minTop = Math.min(minTop, top);
        minLeft = Math.min(minLeft, left);
        maxBottom = Math.max(maxBottom, bottom);
        maxRight = Math.max(maxRight, right);

        const width = right - left;
        const height = bottom - top;

        if (element instanceof HTMLElement) {
          const marginTop = parseInt(getComputedStyle(element).marginTop);
          const marginRight = parseInt(getComputedStyle(element).marginRight);
          const marginBottom = parseInt(getComputedStyle(element).marginBottom);
          const marginLeft = parseInt(getComputedStyle(element).marginLeft);

          const paddingTop = parseInt(getComputedStyle(element).paddingTop);
          const paddingRight = parseInt(getComputedStyle(element).paddingRight);
          const paddingBottom = parseInt(getComputedStyle(element).paddingBottom);
          const paddingLeft = parseInt(getComputedStyle(element).paddingLeft);

          const highlight = document.createElement("div");
          highlight.style.top = `${top}px`;
          highlight.style.left = `${left}px`;
          highlight.style.width = `${width}px`;
          highlight.style.height = `${height}px`;
          highlight.style.boxSizing = "border-box";
          highlight.style.position = "fixed";
          highlight.style.backgroundColor = "rgba(15, 139, 245, 0.4)";
          highlight.style.borderStyle = "solid";
          highlight.style.borderWidth = `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`;
          highlight.style.borderColor = "rgba(65, 196, 68, 0.4)";
          highlight.style.zIndex = "10000";
          highlight.style.pointerEvents = "none";
          document.body.appendChild(highlight);
          this.addedElements.push(highlight);

          const highlightMargins = document.createElement("div");
          highlightMargins.style.top = `${top - marginTop}px`;
          highlightMargins.style.left = `${left - marginLeft}px`;
          highlightMargins.style.width = `${width + marginLeft + marginRight}px`;
          highlightMargins.style.height = `${height + marginBottom + marginTop}px`;
          highlightMargins.style.position = "fixed";
          highlightMargins.style.borderStyle = "solid";
          highlightMargins.style.boxSizing = "border-box";
          highlightMargins.style.borderWidth = `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`;
          highlightMargins.style.borderColor = "rgba(241, 179, 121, 0.4)";
          highlightMargins.style.zIndex = "10000";
          highlightMargins.style.pointerEvents = "none";
          document.body.appendChild(highlightMargins);
          this.addedElements.push(highlightMargins);
          // In case the element is a range because a text node was passed
        } else {
          const highlight = document.createElement("div");
          highlight.style.top = `${top}px`;
          highlight.style.left = `${left}px`;
          highlight.style.width = `${width}px`;
          highlight.style.height = `${height}px`;
          highlight.style.boxSizing = "border-box";
          highlight.style.position = "fixed";
          highlight.style.backgroundColor = "rgba(15, 139, 245, 0.4)";
          highlight.style.zIndex = "10000";
          highlight.style.pointerEvents = "none";
          document.body.appendChild(highlight);
          this.addedElements.push(highlight);
        }
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
      detailsBox.style.position = "fixed";
      detailsBox.style.backgroundColor = "black";
      detailsBox.style.padding = "5px";
      detailsBox.style.zIndex = "10000";
      detailsBox.style.pointerEvents = "none";
      detailsBox.style.display = "inline";
      document.body.appendChild(detailsBox);
      this.addedElements.push(detailsBox);

      const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const viewportHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight || 0
      );
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
    removeHighlights = () => {
      for (const el of this.addedElements) {
        el.remove();
      }
      this.addedElements = [];
    };

    // Identify the hovered component based on the corresponding DOM element and send the Select message
    // when the target changes
    HTMLSelector = (ev) => {
      const target = ev.target;
      if (!this.currentSelectedElement || !target.isEqualNode(this.currentSelectedElement)) {
        const path = this.getElementPath(target);
        this.highlightComponent(path);
        this.currentSelectedElement = target;
        window.top.postMessage({
          source: "owl-devtools",
          type: "SelectElement",
          data: path,
        });
      }
    };

    // Activate the HTML selector tool
    enableHTMLSelector() {
      document.addEventListener("mouseover", this.HTMLSelector, { capture: true });
      document.addEventListener("click", this.disableHTMLSelector, { capture: true });
      document.addEventListener("mouseout", this.removeHighlights, { capture: true });
    }

    // Diasble the HTML selector tool
    disableHTMLSelector = (ev = undefined) => {
      if (ev) {
        if (!ev.isTrusted) {
          return;
        }
        ev.stopPropagation();
        ev.preventDefault();
      }
      this.removeHighlights();
      document.removeEventListener("mouseover", this.HTMLSelector, { capture: true });
      document.removeEventListener("click", this.disableHTMLSelector, { capture: true });
      document.removeEventListener("mouseout", this.removeHighlights, { capture: true });
      window.top.postMessage({
        source: "owl-devtools",
        type: "StopSelector",
      });
    };

    // Returns the object specified by the path starting from the topParent object
    getObject(topParent, path) {
      let obj = topParent;
      if (path.length === 0) {
        return obj;
      }
      for (const key of path) {
        switch (key.type) {
          case "prototype":
            obj = Object.getPrototypeOf(obj);
            break;
          // We will be handling maps and sets entries as arrays to keep things stable
          case "set entries":
          case "map entries":
            obj = [...obj];
            break;
          // Kind of tricky structure-wise but the set entry already is the object itself so this is
          // only useful for display purpose in the devtools.
          case "set value":
            obj = obj;
            break;
          // A map entry is a two items array with the key and the value so indexes 0 and 1
          case "map key":
            obj = obj[0];
            break;
          case "map value":
            obj = obj[1];
            break;
          case "getter":
            // When the item is a getter, get its value.
            try {
              obj = Object.getOwnPropertyDescriptor(obj, key.value).get.call(obj);
            } catch (e) {
              obj = e.toString();
            }
            break;
          case "prototype getter":
          case "set entry":
          case "map entry":
          case "item":
            // When the item is a symbol, we make sure it is the right one by using the index on the
            // Object.getOwnPropertySymbols array.
            if (key.hasOwnProperty("symbolIndex") && key.symbolIndex >= 0) {
              const symbol = Object.getOwnPropertySymbols(obj)[key.symbolIndex];
              if (symbol) {
                obj = obj[symbol];
              }
            } else if (Object.getOwnPropertyDescriptor(obj, key.value)?.hasOwnProperty("get")) {
              try {
                obj = Object.getOwnPropertyDescriptor(obj, key.value).get;
              } catch (e) {
                obj = e.toString();
              }
            } else {
              try {
                obj = obj[key.value];
              } catch (e) {
                obj = e.toString();
              }
            }
        }
        if (obj) {
          obj = owl.toRaw(obj);
        }
      }
      return obj;
    }

    // Returns the asked property given its global path
    getObjectProperty(path) {
      // Just return the corresponding app if path is of length 1
      if (path.length === 1) {
        return [...this.apps][path[0]];
      }
      // Path to the component node is only strings, becomes objects for properties
      const index = path.findIndex((key) => typeof key !== "string");
      const componentNode = this.getComponentNode(path.slice(0, index));
      const obj = this.getObject(componentNode, path.slice(index));
      return obj;
    }

    // Returns a modified version of an object node that has compatible format with the devtools ObjectTreeElement component
    // parentObj is the parent of the node, key is the path key of the node, type is where the object belongs to (props, env, instance, ...),
    // oldBranch is supposedly the same final node in the previous version of the tree and oldTree is the complete old component details
    serializeObjectChild(parentObj, key, depth, type, path, oldBranch, oldTree) {
      let obj;
      let child = {
        depth: depth,
        toggled: false,
        objectType: type,
        hasChildren: false,
      };
      if (oldBranch?.toggled) {
        child.toggled = true;
      }
      child.path = path.concat([key]);
      child.children = [];
      switch (key.type) {
        case "prototype":
          child.name = "[[Prototype]]";
          child.contentType = "object";
          child.content = this.serializer.serializeItem(Object.getPrototypeOf(parentObj), true);
          child.hasChildren = true;
          break;
        case "set entries":
        case "map entries":
          child.name = "[[Entries]]";
          child.content = "";
          child.contentType = "array";
          child.hasChildren = true;
          break;
        case "set value":
          child.name = "value";
          obj = parentObj;
          break;
        case "map key":
          child.name = "key";
          obj = parentObj[0];
          break;
        case "map value":
          child.name = "value";
          obj = parentObj[1];
          break;
        case "set entry":
        case "map entry":
        case "item":
          if (Object.getOwnPropertyDescriptor(parentObj, key.value)?.hasOwnProperty("get")) {
            child.name = "get " + key.value;
            obj = Object.getOwnPropertyDescriptor(parentObj, key.value).get;
          } else {
            child.name = key.value;
            if (typeof key.value === "symbol") {
              child.name = key.value.toString();
              obj = parentObj[key.value];
              child.path[child.path.length - 1].symbolIndex = Object.getOwnPropertySymbols(
                parentObj
              ).findIndex((sym) => sym === key.value);
              child.path[child.path.length - 1].value = key.value.toString();
            } else {
              obj = parentObj[key.value];
            }
          }
          if (key.type === "map entry") {
            child.contentType = "array";
            child.hasChildren = obj.length > 0;
            child.content = this.serializer.serializeContent(obj, key.type);
          }
          break;
      }
      if (child.contentType) {
        if (child.toggled) {
          child.children = this.loadObjectChildren(
            child.path,
            child.depth,
            child.contentType,
            child.objectType,
            oldTree
          );
        }
        return child;
      }
      if (obj === null) {
        child.content = "null";
        child.contentType = "object";
        child.hasChildren = false;
      } else if (obj === undefined) {
        child.content = "undefined";
        child.contentType = "undefined";
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
            child.hasChildren = obj.length > 0;
            break;
          case typeof obj === "function":
            child.contentType = "function";
            child.hasChildren = true;
            break;
          case obj instanceof Object:
            child.contentType = "object";
            child.hasChildren = Object.keys(obj).length > 0;
            break;
          default:
            child.contentType = typeof obj;
            child.hasChildren = false;
        }
        if (key.type === "set entry") {
          child.content = this.serializer.serializeItem(obj, true);
        } else {
          child.content = this.serializer.serializeContent(obj, child.contentType);
        }
      }
      if (child.toggled) {
        child.children = this.loadObjectChildren(
          child.path,
          child.depth,
          child.contentType,
          child.objectType,
          oldTree
        );
      }
      return child;
    }

    // returns the serialized node corresponding to its path in the serialized tree
    getObjectInOldTree(oldTree, completePath, objType) {
      const objPathIndex = completePath.findIndex((key) => typeof key !== "string");
      let path = completePath.slice(objPathIndex);
      let obj;
      if (objType === "subscription") {
        obj = oldTree.subscriptions.children[path[1].value].target;
        path = path.slice(3);
      } else {
        // Everything here is in component if it is not an app so remove this key of the path in the former case
        if (objPathIndex > 1) {
          path.shift();
        }
        // the value is either "props" or "env" here
        if (objType !== "instance") {
          obj = oldTree[path[0].value].children;
          path.shift();
          // there is nothing otherwise but extension side it is in instance
        } else {
          obj = oldTree.instance.children;
        }
        // the first element here is directly in an array instead of a children array
        obj = obj[path[0].childIndex];
        path.shift();
      }
      // just follow the indexes in the rest of the path
      for (const key of path) {
        obj = obj.children[key.childIndex];
      }
      return obj;
    }
    // Returns a serialized version of the children properties of the specified component's property given its path.
    loadObjectChildren(path, depth, contentType, objType, oldTree) {
      const children = [];
      depth = depth + 1;
      let obj = this.getObjectProperty(path);
      let oldBranch = this.getObjectInOldTree(oldTree, path, objType);
      if (!obj) {
        return [];
      }
      let index = 0;
      const lastKey = path.at(-1);
      let prototype;
      if (lastKey.type.includes("entry")) {
        if (lastKey.type === "map entry") {
          const mapKey = this.serializeObjectChild(
            obj,
            { type: "map key", childIndex: 0 },
            depth,
            objType,
            path,
            oldBranch.children[0],
            oldTree
          );
          children.push(mapKey);
          const mapValue = this.serializeObjectChild(
            obj,
            { type: "map value", childIndex: 1 },
            depth,
            objType,
            path,
            oldBranch.children[1],
            oldTree
          );
          children.push(mapValue);
        } else if (lastKey.type === "set entry") {
          const setValue = this.serializeObjectChild(
            obj,
            { type: "set value", childIndex: 0 },
            depth,
            objType,
            path,
            oldBranch.children[0],
            oldTree
          );
          children.push(setValue);
        }
        return children;
      }
      switch (contentType) {
        case "array":
          if (lastKey.type.includes("entries")) {
            for (; index < obj.length; index++) {
              const child = this.serializeObjectChild(
                obj,
                {
                  type: lastKey.type.replace("entries", "entry"),
                  value: index,
                  childIndex: children.length,
                },
                depth,
                objType,
                path,
                oldBranch.children[index],
                oldTree
              );
              if (child) {
                children.push(child);
              }
            }
          } else {
            for (; index < obj.length; index++) {
              const child = this.serializeObjectChild(
                obj,
                { type: "item", value: index, childIndex: children.length },
                depth,
                objType,
                path,
                oldBranch.children[index],
                oldTree
              );
              if (child) {
                children.push(child);
              }
            }
          }
          break;
        case "set":
        case "map":
          const entries = this.serializeObjectChild(
            obj,
            { type: contentType + " entries", value: "[[Entries]]", childIndex: children.length },
            depth,
            objType,
            path,
            oldBranch.children[index],
            oldTree
          );
          if (entries) {
            children.push(entries);
            index++;
          }
          Reflect.ownKeys(obj).forEach((key) => {
            const child = this.serializeObjectChild(
              obj,
              { type: "item", value: key, childIndex: children.length },
              depth,
              objType,
              path,
              oldBranch.children[index],
              oldTree
            );
            if (child) {
              children.push(child);
            }
            index++;
          });
          break;
        case "object":
        case "function":
          Reflect.ownKeys(obj).forEach((key) => {
            if (
              key !== "__proto__" &&
              Object.getOwnPropertyDescriptor(obj, key).hasOwnProperty("get")
            ) {
              let child = {
                name: key,
                depth: depth,
                toggled: false,
                objectType: objType,
                path: [...path, { type: "getter", value: key, childIndex: children.length }],
                contentType: "getter",
                content: "(...)",
                hasChildren: false,
                children: [],
              };
              children.push(child);
            }
            const child = this.serializeObjectChild(
              obj,
              { type: "item", value: key, childIndex: children.length },
              depth,
              objType,
              path,
              oldBranch.children[index],
              oldTree
            );
            if (child) children.push(child);
            index++;
          });
      }
      let proto = Object.getPrototypeOf(obj);
      while (proto) {
        Reflect.ownKeys(proto).forEach((key) => {
          if (
            key !== "__proto__" &&
            Object.getOwnPropertyDescriptor(proto, key).hasOwnProperty("get")
          ) {
            let child = {
              name: key,
              depth: depth,
              toggled: false,
              objectType: objType,
              path: [
                ...path,
                { type: "prototype getter", value: key, childIndex: children.length },
              ],
              contentType: "getter",
              content: "(...)",
              hasChildren: false,
              children: [],
            };
            children.push(child);
          }
        });
        proto = Object.getPrototypeOf(proto);
      }
      if (!(obj.constructor.name === "Object")) {
        prototype = this.serializeObjectChild(
          obj,
          { type: "prototype", childIndex: children.length },
          depth,
          objType,
          path,
          oldBranch.children.at(-1),
          oldTree
        );
        children.push(prototype);
      }
      return children;
    }
    // Returns the Component node given its path and the root component node
    getComponentNode(path) {
      // The node is an app and not a component
      if (path.length === 1) {
        return [...this.apps][path[0]];
      }
      // The second element in the path will always be the root of the app
      let node = [...this.apps][path[0]]?.root;
      if (!node) {
        return null;
      }
      for (let i = 2; i < path.length; i++) {
        // From this point onwards, it is an object path inside the component node
        if (typeof path[i] !== "string") {
          break;
        }
        if (node.children.hasOwnProperty(path[i])) {
          node = node.children[path[i]];
        } else {
          return null;
        }
      }
      return node;
    }
    // Apply manual render to the specified component
    refreshComponent(path) {
      const componentNode = this.getComponentNode(path);
      componentNode.render();
    }
    // Returns the component's details given its path
    getComponentDetails(path = null, oldTree = null) {
      let component = {};
      if (!path) {
        path = this.getElementPath($0);
      }
      component.path = path;
      let node = this.getComponentNode(path) || [...this.apps].find((app) => app.root)?.root;
      if (!node) {
        return null;
      }
      // A path with only the app index indicates that the component is an App instead
      const isApp = path.length === 1;
      if (isApp) {
        component.version = node.__proto__.constructor?.version
          ? node.__proto__.constructor.version
          : "<2.0.8";
      }
      // Load props of the component
      const props = isApp ? node.props : node.component.props;
      component.props = { toggled: oldTree ? oldTree.props.toggled : true, children: [] };
      component.name = isApp
        ? node?.name
          ? `App (${node.name})`
          : "App " + (Number(path[0]) + 1)
        : node.component.constructor.name;
      const propsPath = isApp
        ? [...path, { type: "item", value: "props" }]
        : [...path, { type: "item", value: "component" }, { type: "item", value: "props" }];
      Reflect.ownKeys(props).forEach((key) => {
        let oldBranch = oldTree?.props.children[component.props.children.length];
        const property = this.serializeObjectChild(
          props,
          { type: "item", value: key, childIndex: component.props.children.length },
          0,
          "props",
          propsPath,
          oldBranch,
          oldTree
        );
        if (property) {
          component.props.children.push(property);
        }
      });
      // Load env of the component
      const env = isApp ? node.env : node.component.env;
      component.env = { toggled: oldTree ? oldTree.env.toggled : false, children: [] };
      const envPath = isApp
        ? [...path, { type: "item", value: "env" }]
        : [...path, { type: "item", value: "component" }, { type: "item", value: "env" }];
      Reflect.ownKeys(env).forEach((key) => {
        let oldBranch = oldTree?.env.children[component.env.children.length];
        const envElement = this.serializeObjectChild(
          env,
          { type: "item", value: key, childIndex: component.env.children.length },
          0,
          "env",
          envPath,
          oldBranch,
          oldTree
        );
        if (envElement) {
          component.env.children.push(envElement);
        }
      });
      // Load env getters
      let obj = Object.getPrototypeOf(env);
      Reflect.ownKeys(obj).forEach((key) => {
        if (
          key !== "__proto__" &&
          Object.getOwnPropertyDescriptor(obj, key).hasOwnProperty("get")
        ) {
          let child = {
            name: key,
            depth: 0,
            toggled: false,
            objectType: "env",
            path: [
              ...envPath,
              { type: "prototype getter", value: key, childIndex: component.env.children.length },
            ],
            contentType: "getter",
            content: "(...)",
            hasChildren: false,
            children: [],
          };
          component.env.children.push(child);
        }
      });
      const envPrototype = this.serializeObjectChild(
        env,
        { type: "prototype", childIndex: component.env.children.length },
        0,
        "env",
        envPath,
        oldTree?.env[component.env.children.length],
        oldTree
      );
      component.env.children.push(envPrototype);
      // Load instance of the component
      const instance = isApp ? node : node.component;
      component.instance = { toggled: oldTree ? oldTree.instance.toggled : true, children: [] };
      const instancePath = isApp ? path : [...path, { type: "item", value: "component" }];
      Reflect.ownKeys(instance).forEach((key) => {
        if (!["env", "props"].includes(key)) {
          let oldBranch = oldTree?.instance.children[component.instance.children.length];
          const instanceElement = this.serializeObjectChild(
            instance,
            { type: "item", value: key, childIndex: component.instance.children.length },
            0,
            "instance",
            instancePath,
            oldBranch,
            oldTree
          );
          if (instanceElement) {
            component.instance.children.push(instanceElement);
          }
        }
      });
      // Load instance getters
      obj = Object.getPrototypeOf(instance);
      while (obj) {
        Reflect.ownKeys(obj).forEach((key) => {
          if (
            key !== "__proto__" &&
            Object.getOwnPropertyDescriptor(obj, key).hasOwnProperty("get")
          ) {
            let child = {
              name: key,
              depth: 0,
              toggled: false,
              objectType: "instance",
              path: [
                ...instancePath,
                {
                  type: "prototype getter",
                  value: key,
                  childIndex: component.instance.children.length,
                },
              ],
              contentType: "getter",
              content: "(...)",
              hasChildren: false,
              children: [],
            };
            component.instance.children.push(child);
          }
        });
        obj = Object.getPrototypeOf(obj);
      }
      const instancePrototype = this.serializeObjectChild(
        instance,
        { type: "prototype", childIndex: component.instance.children.length },
        0,
        "instance",
        instancePath,
        oldTree?.instance[component.instance.children.length],
        oldTree
      );
      component.instance.children.push(instancePrototype);

      // Load subscriptions of the component
      if (isApp) {
        component.subscriptions = {
          toggled: oldTree ? oldTree.subscriptions.toggled : true,
          children: [],
        };
      } else {
        const rawSubscriptions = node.subscriptions;
        component.subscriptions = {
          toggled: oldTree ? oldTree.subscriptions.toggled : true,
          children: [],
        };
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
              path: [
                ...path,
                { type: "item", value: "subscriptions" },
                { type: "item", value: index },
                { type: "item", value: "target" },
              ],
              toggled: false,
              objectType: "subscription",
            },
            keysExpanded: false,
          };
          if (
            oldTree &&
            oldTree.subscriptions.children[index] &&
            oldTree.subscriptions.children[index].target.toggled
          ) {
            subscription.target.toggled = true;
          }
          rawSubscription.keys.forEach((key) => {
            if (typeof key === "symbol") {
              subscription.keys.push(key.toString());
            } else {
              subscription.keys.push(key);
            }
          });
          if (rawSubscription.target == null) {
            if (subscription.target.contentType === "undefined") {
              subscription.target.content = "undefined";
            } else {
              subscription.target.content = "null";
            }
            subscription.target.hasChildren = false;
          } else {
            subscription.target.content = this.serializer.serializeContent(
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
              subscription.target.path,
              subscription.target.depth,
              subscription.target.contentType,
              subscription.target.objectType,
              oldTree
            );
          }
          component.subscriptions.children.push(subscription);
        });
      }
      return component;
    }
    // Replace the content of a parsed getter object with the result of the corresponding get method
    loadGetterContent(getter) {
      let obj = this.getObjectProperty(getter.path);
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
        getter.content = this.serializer.serializeContent(obj, getter.contentType);
      }
      return getter;
    }
    // Gives the DOM elements which correspond to the given component node
    getDOMElementsRecursive(node) {
      if (node.hasOwnProperty("bdom")) {
        return this.getDOMElementsRecursive(node.bdom);
      }
      if (node.hasOwnProperty("content")) {
        return this.getDOMElementsRecursive(node.content);
      }
      if (node.hasOwnProperty("el")) {
        if (node.el instanceof HTMLElement || node.el instanceof Text) {
          return [node.el];
        }
      }
      if (node.hasOwnProperty("child")) {
        return this.getDOMElementsRecursive(node.child);
      }
      if (node.hasOwnProperty("children") && node.children.length > 0) {
        let elements = [];
        for (const child of node.children) {
          if (child) {
            elements = elements.concat(this.getDOMElementsRecursive(child));
          }
        }
        if (elements.length > 0) {
          return elements;
        }
      }
      if (node.hasOwnProperty("parentEl")) {
        if (node.parentEl instanceof HTMLElement) {
          return [node.parentEl];
        }
      }
      return [];
    }
    // Triggers the highlight effect around the specified component.
    highlightComponent(path) {
      // Try to highlight the root component of the app if function called on an app
      if (path.length === 1) {
        path.push("root");
      }
      let component = this.getComponentNode(path);
      if (!component) {
        return;
      }
      const elements = this.getDOMElementsRecursive(component);
      this.highlightElements(elements, component.component.constructor.name);
    }
    // Edit a reactive state property with the provided value of the given component (path) and the subscription path
    editObject(path, value, objectType) {
      if (value === "undefined") {
        value = undefined;
      } else {
        try {
          value = JSON.parse(value);
        } catch (e) {
          console.warn("Could not evaluate user property\n", e);
          return;
        }
      }
      const key = path.pop().value;
      const obj = this.getObjectProperty(path);
      if (!obj) {
        return;
      }
      if (objectType === "subscription") {
        owl.reactive(obj)[key] = value;
      } else {
        obj[key] = value;
        if (objectType === "props" || objectType === "instance") {
          const component = this.getComponentNode(path);
          if (component.__proto__.hasOwnProperty("render")) {
            this.getComponentNode(path).render();
          } else {
            component.root.render();
          }
        } else if (objectType === "env") {
          [...this.apps][path[0]].root.render(true);
        }
      }
    }
    // Recursively checks if the given html element corresponds to a component in the components tree.
    // Immediatly returns the path of the first component which matches the element
    searchElement(node, path, element) {
      if (!node?.bdom) {
        return null;
      }
      const results = this.getDOMElementsRecursive(node);
      let hasElementInChildren = false;
      for (const result of results) {
        if (result.isEqualNode(element)) {
          return path;
        }
        if (result.contains(element)) {
          hasElementInChildren = true;
        }
      }
      if (hasElementInChildren) {
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
        const parentsList = [element];
        if (element.tagName !== "BODY") {
          while (element && element?.parentElement?.tagName !== "BODY") {
            element = element.parentElement;
            parentsList.push(element);
          }
        }
        const appsArray = [...this.apps];
        // Try to find a correspondance between the elements in the array and the owl component, stops at first result found
        for (const elem of parentsList) {
          for (const [index, app] of appsArray.entries()) {
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
      const appsArray = [...this.apps];
      const trees = appsArray.map((app, index) => {
        let oldTree;
        if (oldTrees) {
          oldTree = oldTrees[index];
        }
        let appNode = {};
        appNode = {
          name: app?.name ? `App (${app.name})` : "App " + (index + 1),
          path: [index.toString()],
          key: "",
          depth: 0,
          toggled: true,
          selected: false,
          highlighted: false,
          version: app.__proto__.constructor?.version
            ? app.__proto__.constructor.version
            : "<2.0.8",
          children: [],
        };
        if (app.root) {
          const root = {
            name: app.root.component.constructor.name,
            path: [index.toString(), "root"],
            key: "",
            depth: 1,
            toggled: true,
            selected: false,
            highlighted: false,
          };
          if (oldTree) {
            appNode.toggled = oldTree.toggled;
            oldTree = oldTree.children[0];
          }
          if (oldTree) {
            root.toggled = oldTree.toggled;
          }
          // If no path is provided, it defaults to the target of the inspect element action
          if (!inspectedPath) {
            inspectedPath = this.getElementPath($0);
          }
          if (inspectedPath.join("/") === index.toString()) {
            appNode.selected = true;
            root.highlighted = true;
          } else if (inspectedPath.join("/") === index.toString() + "/root") {
            root.selected = true;
          }
          root.children = this.fillTree(app.root, root, inspectedPath.join("/"), oldTree);
          appNode.children.push(root);
        }
        return appNode;
      });
      return trees ? trees : [];
    }
    // Recursively fills the components tree as a parsed version
    fillTree(appNode, treeNode, inspectedPathString, oldBranch) {
      const children = [];
      for (const [key, appChild] of Object.entries(appNode.children)) {
        let child = {
          name: appChild.component.constructor.name,
          key: key,
          depth: treeNode.depth + 1,
          toggled: true,
          selected: false,
          highlighted: false,
        };
        child.path = treeNode.path.concat([child.key]);
        let oldChild = null;
        if (oldBranch) {
          const searchResult = oldBranch.children.find((o) => o.key === key);
          if (searchResult) {
            oldChild = searchResult;
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
      const appsArray = [...this.apps];
      let index = appsArray.findIndex((app) => app === componentNode.app);
      path.unshift(index.toString());
      return path;
    }
    // Store the object into a temp window variable and log it to the console
    sendObjectToConsole(path) {
      const obj = this.getObjectProperty(path);
      let index = 1;
      while (window["temp" + index] !== undefined) {
        index++;
      }
      window["temp" + index] = obj;
      console.log("temp" + index + " = ", window["temp" + index]);
    }
    // Inspect the DOM of the component in the elements tab of the devtools
    inspectComponentDOM(path) {
      const componentNode = this.getComponentNode(path);
      const elements = this.getDOMElementsRecursive(componentNode);
      if (IS_FIREFOX) {
        window.$temp = elements[0];
      } else {
        inspect(elements[0]);
      }
    }
    // Inspect the DOM of the component in the elements tab of the devtools
    inspectComponentCompiledTemplate(path) {
      const componentNode = this.getComponentNode(path);
      const template = componentNode.component.constructor.template;
      if (IS_FIREFOX) {
        window.$temp = componentNode.app.templates[template];
      } else {
        inspect(componentNode.app.templates[template]);
      }
    }
    // Inspect source code of the component (corresponds to inspecting its constructor)
    inspectComponentRawTemplate(path) {
      const componentNode = this.getComponentNode(path);
      const template = componentNode.component.constructor.template;
      const templateNode = componentNode.app.rawTemplates[template];
      console.log(templateNode);
    }
    // Inspect source code of the function given by its path
    inspectFunctionSource(path) {
      const obj = this.getObjectProperty(path);
      if (IS_FIREFOX) {
        window.$temp = obj;
      } else {
        inspect(obj);
      }
    }
  }

  function checkOwlStatus() {
    let owlStatus = 2;
    if (!window.__OWL__DEVTOOLS_GLOBAL_HOOK__) {
      if (window.__OWL_DEVTOOLS__ || window.owl?.App) {
        owlStatus = 1;
      } else {
        // It seems that sending a 0 results in undefined at the other end for some reason
        owlStatus = -1;
      }
    }
    window.postMessage({ source: "owl-devtools", type: "owlStatus", data: owlStatus });
  }

  if (!window.__OWL_DEVTOOLS__) {
    let val;
    const descriptor = Object.getOwnPropertyDescriptor(window, "__OWL_DEVTOOLS__") || {
      get() {
        return val;
      },
      set(value) {
        val = value;
      },
    };
    Object.defineProperty(window, "__OWL_DEVTOOLS__", {
      get() {
        return descriptor.get.call(this);
      },
      set(value) {
        descriptor.set.call(this, value);
        if (value?.Fiber !== undefined) {
          window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
        }
        window.top.postMessage({ source: "owl-devtools", type: "FrameReady" });
        checkOwlStatus();
      },
    });
    // Do note that the reload message is not sent on the top window so that it is not intercepted when originating
    // from an iframe
    window.postMessage({ source: "owl-devtools", type: "Reload" });
  } else if (
    window.__OWL_DEVTOOLS__?.Fiber !== undefined &&
    !window.__OWL__DEVTOOLS_GLOBAL_HOOK__
  ) {
    window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
    window.postMessage({ source: "owl-devtools", type: "Reload" });
  }
  // Listener that checks whether owl is available on the page and if it has the right version
  window.addEventListener(
    "message",
    function (event) {
      if (event.data.source === "owl-devtools-background" && event.data.type === "checkOwlStatus") {
        checkOwlStatus();
      }
    },
    false
  );
  checkOwlStatus();
  // Indicates whether the scripts loaded successfully or not (only useful when loaded with eval in iframes)
  return window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;
})();
