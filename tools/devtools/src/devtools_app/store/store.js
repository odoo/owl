const { Plugin, signal, proxy, plugin } = owl;
import { IS_FIREFOX, getActiveTabURL, browserInstance } from "../../utils";
import globalHook from "../../page_scripts/owl_devtools_global_hook";
import { ComponentsPlugin } from "./components_plugin";
import { ProfilerPlugin } from "./profiler_plugin";

// Core plugin: initialization, port listener, settings, frame management,
// context menu, tab navigation, and shared UI state.
export class StorePlugin extends Plugin {
  // --- Primitive state ---
  devtoolsId = signal(0);
  contextMenu = signal(null);
  page = signal("ComponentsTab");
  activeFrame = signal("top");
  frameUrls = signal(["top"]);
  owlStatus = signal(true);
  extensionContextStatus = signal(true);
  splitPosition = signal(window.innerWidth > window.innerHeight ? 45 : 60);

  // --- Settings ---
  expandByDefault = signal(true);
  toggleOnSelected = signal(false);
  darkMode = signal(false);
  componentsToggleBlacklist = signal.Set(new Set());

  // --- Non-reactive ---
  isFirefox = IS_FIREFOX;

  setup() {
    this._components = plugin(ComponentsPlugin);
    this._profiler = plugin(ProfilerPlugin);
    this._init();
    this._setupPortListener();
  }

  // -------------------------------------------------------------------------
  // Tab / context menu
  // -------------------------------------------------------------------------

  switchTab(componentName) {
    this.page.set(componentName);
    this._components.activeSelector.set(false);
    evalFunctionInWindow("disableHTMLSelector", [], this.activeFrame());
  }

  openContextMenu(event, items) {
    this.contextMenu.set({
      position: { x: event.clientX, y: event.clientY },
      items,
    });
  }

  // -------------------------------------------------------------------------
  // Shared tree utility
  // -------------------------------------------------------------------------

  // Fold the immediate children of a tree element (works for both component and event trees)
  foldDirectChildren(element) {
    for (const child of element.children) {
      child.toggled = false;
    }
  }

  // -------------------------------------------------------------------------
  // Frames
  // -------------------------------------------------------------------------

  async updateIFrameList() {
    const frames = await evalFunctionInWindow("getIFrameUrls");
    this.frameUrls.set(["top"]);
    if (this.activeFrame() !== "top") {
      this.selectFrame("top");
    }
    for (const frame of frames) {
      const hasOwl = await evalInWindow("window.__OWL_DEVTOOLS__?.Fiber !== undefined;", frame);
      if (hasOwl) {
        const scriptsLoaded = await evalInWindow(
          "window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;",
          frame
        );
        if (!scriptsLoaded) {
          await loadScripts(frame);
        }
        evalFunctionInWindow("initDevtools", [frame], frame);
        if (!this.frameUrls().includes(frame)) {
          this.frameUrls.set([...this.frameUrls(), frame]);
        }
      }
    }
  }

  selectFrame(frame) {
    this._components.removeHighlights();
    evalFunctionInWindow("toggleEventsRecording", [false, 0], this.activeFrame());
    evalFunctionInWindow("toggleTracing", [false], this.activeFrame());
    evalFunctionInWindow("toggleSubscriptionTracing", [false], this.activeFrame());
    this._profiler.events.set(proxy([]));
    this._profiler.eventsTree.set(proxy([]));
    this.activeFrame.set(frame);
    this._components.loadComponentsTree(false);
    this._profiler.refreshSubscriptionTracingSupport(frame);
    evalFunctionInWindow(
      "toggleEventsRecording",
      [this._profiler.activeRecorder(), this._profiler.events().length],
      this.activeFrame()
    );
    evalFunctionInWindow("toggleTracing", [this._profiler.traceRenderings()], this.activeFrame());
    evalFunctionInWindow(
      "toggleSubscriptionTracing",
      [this._profiler.traceSubscriptions()],
      this.activeFrame()
    );
  }

  // -------------------------------------------------------------------------
  // Settings / UI
  // -------------------------------------------------------------------------

  toggleDarkMode() {
    this.darkMode.set(!this.darkMode());
    if (this.darkMode()) {
      document.querySelector("html").classList.add("dark-mode");
    } else {
      document.querySelector("html").classList.remove("dark-mode");
    }
    browserInstance.storage.local.set({ owlDevtoolsDarkMode: this.darkMode() });
  }

  openDocumentation() {
    browserInstance.runtime.sendMessage({ type: "openDoc" });
  }

  async refreshExtension() {
    await loadScripts();
    await this._resetData();
  }

  // -------------------------------------------------------------------------
  // Initialization (private)
  // -------------------------------------------------------------------------

  async _resetData() {
    await this._loadSettings();
    this._components.loadComponentsTree(false);
    this._profiler.events.set(proxy([]));
    this._profiler.eventsTree.set(proxy([]));
    this._profiler.activeRecorder.set(false);
    evalFunctionInWindow("toggleEventsRecording", [false, 0]);
    this._profiler.traceRenderings.set(false);
    evalFunctionInWindow("toggleTracing", [false]);
    this._profiler.traceSubscriptions.set(false);
    evalFunctionInWindow("toggleSubscriptionTracing", [false]);
    this._profiler.refreshSubscriptionTracingSupport();
    this.updateIFrameList();
  }

  async _init() {
    this.devtoolsId.set(await getTabURL());

    evalFunctionInWindow("initDevtools", []);

    await this._loadSettings();

    this._components.loadComponentsTree(false);
    this.updateIFrameList();
    this._profiler.refreshSubscriptionTracingSupport();

    document.addEventListener("click", () => this.contextMenu.set(null), { capture: true });
    document.addEventListener("contextmenu", () => this.contextMenu.set(null), { capture: true });
    window.addEventListener("blur", () => this.contextMenu.set(null), { capture: true });

    for (const frame of this.frameUrls()) {
      evalFunctionInWindow("toggleEventsRecording", [false, 0], frame);
    }

    browserInstance.runtime.sendMessage({ type: "newDevtoolsPanel", id: this.devtoolsId() });

    setInterval(() => {
      if (this.extensionContextStatus()) {
        try {
          browserInstance.runtime.sendMessage({ type: "keepAlive", id: this.devtoolsId() });
        } catch (e) {
          this.extensionContextStatus.set(false);
        }
      }
    }, 500);

    // Refresh observed variables values every 200 ms
    setInterval(async () => {
      if (this.owlStatus()) {
        const result = await evalFunctionInWindow(
          "getObservedVariables",
          [[...this._components.observedVariables()]],
          this.activeFrame()
        );
        this._components.observedVariables.set(proxy(result));
      }
    }, 200);
  }

  _setupPortListener() {
    let rootRendersTimeout = null;
    browserInstance.runtime.onConnect.addListener((port) => {
      if (port.name === "OwlDevtoolsPort_" + this.devtoolsId()) {
        port.onMessage.addListener(async (msg) => {
          // Reload the tree after checking if the scripts are loaded when this message is received
          if (msg.type === "Reload") {
            this.owlStatus.set(
              await evalInWindow("window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;")
            );
            if (this.owlStatus()) {
              evalFunctionInWindow("initDevtools", []);
              await this._resetData();
            }
          }
          // Received when a frame has been delayed when loading the scripts due to owl being lazy loaded
          if (msg.type === "FrameReady") {
            this.updateIFrameList();
            this.owlStatus.set(true);
            await this._resetData();
          }
          // We need to reload the components tree when the set of apps in the page is modified
          if (msg.type === "RefreshApps") {
            this._components.loadComponentsTree(true);
          }
          // When message of type Complete is received, overwrite the component tree with the new one from page.
          // A Complete message is sent everytime a root render is triggered on the page.
          if (msg.type === "Complete") {
            if (msg.origin.frame !== this.activeFrame()) {
              return;
            }
            if (!(Array.isArray(msg.data) && msg.data.every((val) => typeof val === "string"))) {
              return;
            }
            // This determines which components will have a short highlight effect in the tree
            // to indicate they have been rendered
            this._components.renderPaths.add(JSON.stringify(msg.data));
            if (!rootRendersTimeout) {
              this._components.loadComponentsTree(true);
            }
            clearTimeout(rootRendersTimeout);
            rootRendersTimeout = setTimeout(() => {
              rootRendersTimeout = null;
              this._components.renderPaths.clear();
              this._components.loadComponentsTree(true);
            }, 100);
          }
          // Select the component based on the path received with the SelectElement message
          if (msg.type === "SelectElement") {
            if (!(Array.isArray(msg.data) && msg.data.every((val) => typeof val === "string"))) {
              return;
            }
            this._components.selectComponent(msg.data);
          }
          // Stop the DOM element selector tool upon receiving the StopSelector message
          if (msg.type === "StopSelector") {
            this._components.activeSelector.set(false);
          }
          // Logic for recording an event when the event message is received
          if (msg.type === "Event") {
            this._profiler._loadEvents(msg.data);
          }
          // If we know a new iframe has been added to the page, load scripts into it and update the
          // frames list if it has been directly loaded.
          if (msg.type === "NewIFrame") {
            const isLoaded = await loadScripts(msg.data);
            if (isLoaded) {
              this.updateIFrameList();
            }
          }
        });
      }
    });
  }

  async _loadSettings() {
    let storage = await browserInstance.storage.local.get();
    let dm;
    if (storage.owlDevtoolsDarkMode === undefined) {
      dm = browserInstance.devtools.panels.themeName === "dark";
    } else {
      dm = storage.owlDevtoolsDarkMode;
    }
    this.darkMode.set(dm);
    if (dm) {
      document.querySelector("html").classList.add("dark-mode");
    } else {
      document.querySelector("html").classList.remove("dark-mode");
    }
    if (storage.owlDevtoolsComponentsToggleBlacklist !== undefined) {
      this.componentsToggleBlacklist.set(new Set(storage.owlDevtoolsComponentsToggleBlacklist));
    }
    if (storage.observedVariables) {
      const vars = [];
      for (const path of storage.observedVariables) {
        vars.push({ path: [...path], visible: false });
      }
      this._components.observedVariables.set(proxy(vars));
    }
  }
}

// -------------------------------------------------------------------------
// Standalone helper functions (exported for use by sub-plugins)
// -------------------------------------------------------------------------

export async function evalFunctionInWindow(fn, args = [], frameUrl = "top") {
  const stringifiedArgs = [...args].map((arg) => {
    arg = JSON.stringify(arg);
    return arg;
  });
  const argsString = "(" + stringifiedArgs.join(", ") + ");";
  let script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.${fn}${argsString}`;
  return await new Promise((resolve, reject) => {
    if (frameUrl !== "top") {
      browserInstance.devtools.inspectedWindow.eval(
        script,
        { frameURL: frameUrl },
        (result, isException) => {
          if (!isException) {
            resolve(result);
          } else {
            reject(script);
          }
        }
      );
    } else {
      browserInstance.devtools.inspectedWindow.eval(script, (result, isException) => {
        if (!isException) {
          resolve(result);
        } else {
          reject(script);
        }
      });
    }
  });
}

export async function evalInWindow(code, frameUrl = "top") {
  return await new Promise((resolve, reject) => {
    if (frameUrl !== "top") {
      browserInstance.devtools.inspectedWindow.eval(
        code,
        { frameURL: frameUrl },
        (result, isException) => {
          if (!isException) {
            resolve(result);
          } else {
            reject(code);
          }
        }
      );
    } else {
      browserInstance.devtools.inspectedWindow.eval(code, (result, isException) => {
        if (!isException) {
          resolve(result);
        } else {
          reject(code);
        }
      });
    }
  });
}

async function loadScripts(frameUrl) {
  return await evalInWindow(globalHook, frameUrl);
}

async function getTabURL() {
  if (IS_FIREFOX) {
    const response = await browserInstance.runtime.sendMessage({ type: "getActiveTabURL" });
    return response.result;
  } else {
    return await getActiveTabURL();
  }
}
