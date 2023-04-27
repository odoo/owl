const { reactive, useState, toRaw } = owl;
import { fuzzySearch, IS_FIREFOX, getActiveTabURL } from "../../utils";
import globalHook from "../../page_scripts/owl_devtools_global_hook";

const browserInstance = IS_FIREFOX ? browser : chrome;

// Main store which contains all states that needs to be maintained throughout all components in the devtools app
export const store = reactive({
  devtoolsId: 0,
  settings: {
    expandByDefault: true,
    toggleOnSelected: false,
    darkmode: false,
  },
  contextMenu: {
    top: 0,
    left: 0,
    id: 0,
    activeMenu: -1,
    // Opens the context menu corresponding with the given menu html element
    open(event, menu) {
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      let x = event.clientX;
      let y = event.clientY;
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight;
      }
      this.left = x + "px";
      // Need 25px offset because of the main navbar from the browser devtools
      this.top = y - 25 + "px";
    },
    // Close the currently displayed context menu
    close() {
      this.activeMenu = -1;
    },
  },
  isFirefox: IS_FIREFOX,
  frameUrls: ["top"],
  activeFrame: "top",
  page: "ComponentsTab",
  events: [],
  eventsTreeView: true,
  eventsTree: [],
  activeRecorder: false,
  owlStatus: true,
  extensionContextStatus: true,
  splitPosition: window.innerWidth > window.innerHeight ? 45 : 60,
  apps: [],
  traceRenderings: false,
  traceSubscriptions: false,
  activeComponent: {
    path: ["0"],
    name: "App",
    subscriptions: { toggled: true, children: [] },
    props: { toggled: true, children: [] },
    env: { toggled: false, children: [] },
    instance: { toggled: true, children: [] },
    version: "1.0",
  },
  selectedElement: null,
  componentSearch: {
    search: "",
    searchResults: [],
    searchIndex: 0,
    activeSelector: false,
    getNextSearch() {
      if (this.searchIndex > -1 && this.searchIndex < this.searchResults.length - 1) {
        store.setSearchIndex(this.searchIndex + 1);
      } else if (this.searchIndex === this.searchResults.length - 1) {
        store.setSearchIndex(0);
      }
    },
    getPrevSearch() {
      if (this.searchIndex > 0) {
        store.setSearchIndex(this.searchIndex - 1);
      } else if (this.searchIndex === 0) {
        store.setSearchIndex(this.searchResults.length - 1);
      }
    },
  },
  // eventSearch: {
  //   search: "",
  //   searchResults: [],
  //   filters: [],
  // },
  renderPaths: new Set(),

  // Used to navigate between the Components tab and the Events tab
  switchTab(componentName) {
    this.page = componentName;
    this.componentSearch.activeSelector = false;
    evalFunctionInWindow("disableHTMLSelector", [], this.activeFrame);
  },

  // Load all data related to the components tree using the global hook loaded on the page
  // Use fromOld to specify if we want to keep most of the toggled/selected data of the old tree
  // when generating the new one
  async loadComponentsTree(fromOld) {
    if (IS_FIREFOX) {
      await evalInWindow("window.$0 = $0;", this.activeFrame);
    }
    const apps = await evalFunctionInWindow(
      "getComponentsTree",
      fromOld && this.activeComponent ? [this.activeComponent.path, this.apps] : [],
      this.activeFrame
    );
    this.apps = apps ? apps : [];
    if (!fromOld && this.settings.expandByDefault) {
      this.apps.forEach((tree) => expandNodes(tree));
    }
    const component = await evalFunctionInWindow(
      "getComponentDetails",
      fromOld && this.activeComponent ? [this.activeComponent.path, this.activeComponent] : [],
      this.activeFrame
    );
    this.activeComponent = component;
  },

  // Select a component by retrieving its details from the page based on its path
  async selectComponent(path) {
    // Deselect all components
    this.apps.forEach((app) => {
      app.selected = false;
      app.highlighted = false;
      app.children.forEach((child) => {
        deselectComponent(child);
      });
    });
    let component;
    // element is the app here
    if (path.length === 1) {
      component = this.apps[path[0]];
      // the second element in the path is always the root of the app so no need to check
    } else {
      component = this.apps[path[0]].children[0];
    }
    for (let i = 2; i < path.length; i++) {
      component.toggled = true;
      const result = component.children.find((child) => child.key === path[i]);
      if (result) {
        component = result;
      } else {
        break;
      }
    }
    component.selected = true;
    highlightChildren(component);
    const details = await evalFunctionInWindow(
      "getComponentDetails",
      [component.path],
      this.activeFrame
    );
    this.activeComponent = details;
    if (!this.activeComponent) {
      await this.loadComponentsTree(false);
    }
    if (this.page !== "ComponentsTab") {
      this.switchTab("ComponentsTab");
    }
  },

  // Update the search state value with the current search string and trigger the search
  updateSearch(search) {
    this.componentSearch.search = search;
    this.componentSearch.searchResults = [];
    this.apps.forEach((app) => this.getComponentSearchResults(search, app));
    if (this.componentSearch.searchResults.length > 0) {
      this.componentSearch.searchIndex = 0;
      this.selectComponent(this.componentSearch.searchResults[0]);
      this.apps.forEach((app) => foldNodes(app));
      for (const result of this.componentSearch.searchResults) {
        this.toggleComponentParents(result);
      }
    } else {
      this.componentSearch.searchIndex = -1;
    }
  },

  // Search for results in the components tree given the current search string (in a fuzzy way)
  getComponentSearchResults(search, node) {
    if (search.length < 1) {
      return;
    }
    if (fuzzySearch(node.name, search)) {
      this.componentSearch.searchResults.push(node.path);
    }
    if (node.children) {
      node.children.forEach((child) => this.getComponentSearchResults(search, child));
    }
  },

  // Same but only record the component names for events
  // getComponentNameSearchResults(search, node) {
  //   if (search.length < 1) return;
  //   if (fuzzySearch(node.name, search)) {
  //     if(!this.eventSearch.searchResults.includes(node.name))
  //       this.eventSearch.searchResults.push(node.name);
  //   }
  //   if (node.children) {
  //     node.children.forEach((child) => this.getComponentNameSearchResults(search, child));
  //   }
  // },

  // updateEventSearch(search){
  //   this.eventSearch.search = search;
  //   this.eventSearch.searchResults = [];
  //   this.apps.forEach((app) => this.getComponentNameSearchResults(search, app));
  //   [""]
  // },

  // Toggle all parent components of the specified one to make sure it is visible in the tree
  toggleComponentParents(path) {
    let cp = path.slice(2);
    this.apps[path[0]].toggled = true;
    let component = this.apps[path[0]].children[0];
    for (const key of cp) {
      component.toggled = true;
      component = component.children.find((child) => child.key === key);
    }
  },

  // Returns access to the specified component in the tree
  getComponentByPath(path) {
    let component;
    if (path.length < 2) {
      component = this.apps[path[0]];
    } else {
      component = this.apps[path[0]].children[0];
    }
    let cp = path.slice(2);
    for (const key of cp) {
      component = component.children.find((child) => child.key === key);
    }
    return component;
  },

  // expand/fold the component and its children based on toggle
  toggleComponentAndChildren(component, toggle) {
    if (toggle) {
      expandNodes(component);
    } else {
      foldNodes(component);
    }
  },

  foldDirectChildren(element) {
    for (const child of element.children) {
      child.toggled = false;
    }
  },

  // Action related to the left(toggle)/up(not toggle) arrow keys for navigation purpose
  // The resulting behaviour is the same as in the Elements tab of the chrome devtools
  toggleOrSelectPrevElement(toggle) {
    if (toggle) {
      const component = this.getComponentByPath(this.activeComponent.path);
      if (component.children.length > 0 && component.toggled) {
        component.toggled = false;
      } else if (this.activeComponent.path.length > 1) {
        this.selectComponent(this.activeComponent.path.slice(0, -1));
      }
      return;
    }
    const parentPath = [...this.activeComponent.path];
    const key = parentPath.pop();
    // If component is an app, find descendant with the highest successive children indexes of the app above
    // or do nothing if there is no app above
    if (parentPath.length === 0) {
      const parent = this.apps;
      const index = Number(key);
      if (index > 0) {
        let sibling = parent[index - 1];
        while (sibling.toggled && sibling.children.length) {
          sibling = sibling.children[sibling.children.length - 1];
        }
        this.selectComponent(sibling.path);
      }
    } else {
      const parent = this.getComponentByPath(parentPath);
      const index = parent.children.findIndex((child) => child.key === key);
      if (index > 0) {
        let sibling = parent.children[index - 1];
        while (sibling.toggled && sibling.children.length) {
          sibling = sibling.children[sibling.children.length - 1];
        }
        this.selectComponent(sibling.path);
      } else {
        this.selectComponent(parent.path);
      }
    }
  },

  // Action related to the right(toggle)/down(not toggle) arrow keys for navigation purpose
  // The resulting behaviour is the same as in the Elements tab of the chrome devtools
  toggleOrSelectNextElement(toggle) {
    let component = this.getComponentByPath(this.activeComponent.path);
    if (toggle) {
      if (!component.children.length) {
        return;
      } else if (!component.toggled) {
        component.toggled = true;
        return;
      }
    }
    // If component has children and is toggled, select its first child
    if (component.toggled && component.children.length) {
      this.selectComponent(component.children[0].path);
    } else {
      const parentPath = [...this.activeComponent.path];
      while (true) {
        const key = parentPath.pop();
        if (parentPath.length === 0) {
          const index = Number(key);
          if (index < this.apps.length - 1) {
            this.selectComponent(this.apps[index + 1].path);
          }
          return;
        }
        const parent = this.getComponentByPath(parentPath);
        const index = parent.children.findIndex((child) => child.key === key);
        if (index < parent.children.length - 1 && index > -1) {
          this.selectComponent(parent.children[index + 1].path);
          return;
        }
      }
    }
  },

  // Set the search index to the provided one in order to select the current searched component
  setSearchIndex(index) {
    this.componentSearch.searchIndex = index;
    this.selectComponent(this.componentSearch.searchResults[index]);
  },

  // Replace the (...) content of a getter with the value returned by the corresponding get method
  async loadGetterContent(obj) {
    const result = await evalFunctionInWindow("loadGetterContent", [obj], this.activeFrame);
    Object.keys(obj).forEach((key) => {
      obj[key] = result[key];
    });
    obj.children = [];
  },

  // Expand the children of the input object property and load it from page if necessary
  async toggleObjectTreeElementsDisplay(obj) {
    if (!obj.hasChildren) {
      return;
    }
    // Since it is sometimes impossible (and always ineffective) to load all descendants of a property
    // when the component details are loaded, we need to populate the children of a property only when
    // it is first expanded. Do note that it has a limit to how deep we can expand (when reaching a circular dependancy)
    if (obj.hasChildren && obj.children.length === 0) {
      const children = await evalFunctionInWindow(
        "loadObjectChildren",
        [obj.path, obj.depth, obj.contentType, obj.objectType, this.activeComponent],
        this.activeFrame
      );
      obj.children = children;
    }
    obj.toggled = !obj.toggled;
  },

  // Toggle the selector tool which is used to select a component based on the hovered Dom element
  toggleSelector() {
    this.componentSearch.activeSelector = !this.componentSearch.activeSelector;
    evalFunctionInWindow(
      this.componentSearch.activeSelector ? "enableHTMLSelector" : "disableHTMLSelector",
      [],
      this.activeFrame
    );
  },

  // Update the value of the given object with the new provided one
  editObjectTreeElement(path, value, objectType) {
    evalFunctionInWindow("editObject", [path, value, objectType], this.activeFrame);
  },

  // toggle the tracing mode which will record all root render events and send their trace in the console
  async toggleTracing() {
    this.traceRenderings = await evalFunctionInWindow(
      "toggleTracing",
      [!this.traceRenderings],
      this.activeFrame
    );
  },

  // toggle subscriptions tracing mode which will record all new subscriptions
  async toggleSubscriptionTracing() {
    this.traceSubscriptions = await evalFunctionInWindow(
      "toggleSubscriptionTracing",
      [!this.traceSubscriptions],
      this.activeFrame
    );
  },

  // Checks for all iframes in the page, register it and load the scripts inside if not already done
  async updateIFrameList() {
    const frames = await evalFunctionInWindow("getIFrameUrls");
    this.frameUrls = ["top"];
    if (this.activeFrame !== "top") {
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
        evalInWindow(
          `__OWL__DEVTOOLS_GLOBAL_HOOK__.devtoolsId = ${
            store.devtoolsId
          }; __OWL__DEVTOOLS_GLOBAL_HOOK__.frame = ${JSON.stringify(frame)};`,
          frame
        );
        if (!this.frameUrls.includes(frame)) {
          this.frameUrls = [...this.frameUrls, frame];
        }
      }
    }
  },

  // Remove all the highlight boxes created above the html elements in the page to show components
  removeHighlights() {
    if (this.owlStatus && !this.invalidContext) {
      evalFunctionInWindow("removeHighlights", [], this.activeFrame);
    }
  },

  // Reset the context of all values in the devtools tab and load the one from the given frame
  selectFrame(frame) {
    this.removeHighlights();
    evalFunctionInWindow("toggleEventsRecording", [false, 0], this.activeFrame);
    evalFunctionInWindow("toggleTracing", [false], this.activeFrame);
    evalFunctionInWindow("toggleSubscriptionTracing", [false], this.activeFrame);
    this.events = [];
    this.eventsTree = [];
    this.activeFrame = frame;
    store.loadComponentsTree(false);
    evalFunctionInWindow(
      "toggleEventsRecording",
      [this.activeRecorder, this.events.length],
      this.activeFrame
    );
    evalFunctionInWindow("toggleTracing", [this.traceRenderings], this.activeFrame);
    evalFunctionInWindow("toggleSubscriptionTracing", [this.traceSubscriptions], this.activeFrame);
  },

  // Constructs the tree that represents the currently recorded events to see them as a tree instead of a temporally accurate list
  buildEventsTree() {
    let tree = [];
    for (const event of this.events) {
      let eventNode = Object.assign({}, event);
      eventNode.children = [];
      eventNode.toggled = true;
      if (!eventNode.origin) {
        eventNode.depth = 0;
        tree.push(eventNode);
      } else {
        // This is litteraly an array.find but which starts searching from the end of the array
        for (let i = tree.length - 1; i >= 0; i--) {
          if (arraysEqual(eventNode.origin.path, tree[i].path)) {
            // path from the origin event (root render) to the direct parent of the current event
            const relativePath = eventNode.path.slice(
              tree[i].path.length,
              eventNode.path.length - 1
            );
            let parent = tree[i];
            // find the direct parent in the tree
            for (const key of relativePath) {
              parent = parent.children.find((child) => child.key === key);
            }
            eventNode.depth = parent.depth + 1;
            parent.children.push(eventNode);
            break;
          }
        }
      }
    }
    this.eventsTree = tree;
  },

  // expand/fold the event tree node based on toggle
  toggleEventAndChildren(event, toggle) {
    if (toggle) {
      expandNodes(event);
    } else {
      foldNodes(event);
    }
  },

  collapseAll() {
    for (let event of this.eventsTree) {
      event.toggled = false;
    }
  },

  // Reset all the relevant data about the page currently stored
  resetData() {
    this.loadComponentsTree(false);
    this.events = [];
    this.eventsTree = [];
    this.activeRecorder = false;
    evalFunctionInWindow("toggleEventsRecording", [false, 0]);
    this.traceRenderings = false;
    evalFunctionInWindow("toggleTracing", [false]);
    this.traceSubscriptions = false;
    evalFunctionInWindow("toggleSubscriptionTracing", [false]);
  },

  // Triggers manually the rendering of the selected component
  refreshComponent(path = this.activeComponent.path) {
    evalFunctionInWindow("refreshComponent", [path], this.activeFrame);
  },

  // Allows to log any object in the console, defaults to the active component (or app)
  logObjectInConsole(path) {
    if (!path) {
      if (this.activeComponent.path.length > 1) {
        path = [...this.activeComponent.path, { type: "item", value: "component" }];
      } else {
        path = this.activeComponent.path;
      }
    }
    evalFunctionInWindow("sendObjectToConsole", [path], this.activeFrame);
  },

  // inspect the source code of the object given by its path
  async inspectFunctionSource(path) {
    await evalFunctionInWindow("inspectFunctionSource", [path], this.activeFrame);
    if (IS_FIREFOX) {
      await evalInWindow("inspect(window.$temp);", this.activeFrame);
    }
  },

  // Inspect the given component's data based on the given type
  async inspectComponent(type, path = this.activeComponent.path) {
    switch (type) {
      case "DOM":
        await evalFunctionInWindow("inspectComponentDOM", [path], this.activeFrame);
        break;
      case "source":
        if (path.length > 1) {
          await evalFunctionInWindow(
            "inspectFunctionSource",
            [
              [
                ...path,
                { type: "item", value: "component" },
                { type: "item", value: "constructor" },
              ],
            ],
            this.activeFrame
          );
        } else {
          await evalFunctionInWindow(
            "inspectFunctionSource",
            [[...path, { type: "item", value: "constructor" }]],
            this.activeFrame
          );
        }
        break;
      case "compiled template":
        await evalFunctionInWindow("inspectComponentCompiledTemplate", [path], this.activeFrame);
        break;
      case "raw template":
        await evalFunctionInWindow("inspectComponentRawTemplate", [path], this.activeFrame);
        break;
    }
    if (IS_FIREFOX && type !== "raw template") {
      await evalInWindow("inspect(window.$temp);", this.activeFrame);
    }
  },

  // Trigger the highlight on the component in the page
  highlightComponent(path) {
    evalFunctionInWindow("highlightComponent", [path], this.activeFrame);
  },

  // Center the view around the currently selected component
  focusSelectedComponent() {
    this.selectedElement.scrollIntoView({ block: "center", behavior: "smooth" });
  },

  // Toggle the recording of events in the page
  async toggleRecording() {
    this.activeRecorder = await evalFunctionInWindow(
      "toggleEventsRecording",
      [!this.activeRecorder, this.events.length],
      this.activeFrame
    );
  },

  // Reset all events data
  clearEventsConsole() {
    this.events = [];
    this.eventsTree = [];
    evalFunctionInWindow("resetEvents", [], this.activeFrame);
  },

  // Refresh the whole extension
  async refreshExtension() {
    await loadScripts();
    this.resetData();
  },

  // Toggle dark mode in the extension and store result in the storage
  toggleDarkMode() {
    this.settings.darkMode = !this.settings.darkMode;
    if (this.settings.darkMode) {
      document.querySelector("html").classList.add("dark-mode");
    } else {
      document.querySelector("html").classList.remove("dark-mode");
    }
    browserInstance.storage.local.set({ owl_devtools_dark_mode: this.settings.darkMode });
  },

  openDocumentation() {
    browserInstance.runtime.sendMessage({ type: "openDoc" });
  },
});

// Instantiate the store
export function useStore() {
  return useState(store);
}

init();

async function init() {
  store.devtoolsId = await getTabURL();

  evalInWindow("__OWL__DEVTOOLS_GLOBAL_HOOK__.devtoolsId = " + store.devtoolsId + ";");

  // We want to load the base components tree when the devtools tab is first opened
  store.loadComponentsTree(false);

  // We also want to detect the different iframes at first loading of the devtools tab
  store.updateIFrameList();

  // Global listeners to close the currently shown context menu when the user clicks or opens another
  document.addEventListener("click", () => store.contextMenu.close(), { capture: true });
  document.addEventListener("contextmenu", () => store.contextMenu.close(), { capture: true });

  // Make sure the events recorder is at its initial state in every frame
  for (const frame of store.frameUrls) {
    evalFunctionInWindow("toggleEventsRecording", [false, 0], frame);
  }

  loadSettings();

  browserInstance.runtime.sendMessage({ type: "newDevtoolsPanel", id: store.devtoolsId });

  // Heartbeat message to test whether the extension context is still valid or not
  setInterval(() => {
    if (store.extensionContextStatus) {
      try {
        browserInstance.runtime.sendMessage({ type: "keepAlive", id: store.devtoolsId });
      } catch (e) {
        store.extensionContextStatus = false;
      }
    }
  }, 500);
}

let flushRendersTimeout = false;
// Connect to the port to communicate to the background script
browserInstance.runtime.onConnect.addListener((port) => {
  if (port.name === "OwlDevtoolsPort_" + store.devtoolsId) {
    port.onMessage.addListener(async (msg) => {
      // Reload the tree after checking if the scripts are loaded when this message is received
      if (msg.type === "Reload") {
        store.owlStatus = await evalInWindow("window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;");
        if (store.owlStatus) {
          evalInWindow("__OWL__DEVTOOLS_GLOBAL_HOOK__.devtoolsId = " + store.devtoolsId + ";");
          store.resetData();
        }
      }
      // Received when a frame has been delayed when loading the scripts due to owl being lazy loaded
      if (msg.type === "FrameReady") {
        store.updateIFrameList();
        store.owlStatus = true;
        store.resetData();
      }
      // We need to reload the components tree when the set of apps in the page is modified
      if (msg.type === "RefreshApps") {
        store.loadComponentsTree(true);
      }
      // When message of type Flush is received, overwrite the component tree with the new one from page
      // A flush message is sent everytime a component is rendered on the page
      if (msg.type === "Flush") {
        if (msg.origin.frame !== store.activeFrame) {
          return;
        }
        if (!(Array.isArray(msg.data) && msg.data.every((val) => typeof val === "string"))) {
          return;
        }
        // This determines which components will have a short highlight effect in the tree to indicate they have been rendered
        store.renderPaths.add(JSON.stringify(msg.data));
        clearTimeout(flushRendersTimeout);
        flushRendersTimeout = setTimeout(() => {
          store.renderPaths.clear();
        }, 100);
        store.loadComponentsTree(true);
      }
      // Select the component based on the path received with the SelectElement message
      if (msg.type === "SelectElement") {
        if (!(Array.isArray(msg.data) && msg.data.every((val) => typeof val === "string"))) {
          return;
        }
        store.selectComponent(msg.data);
      }
      // Stop the DOM element selector tool upon receiving the StopSelector message
      if (msg.type === "StopSelector") {
        store.componentSearch.activeSelector = false;
      }

      // Logic for recording an event when the event message is received
      if (msg.type === "Event") {
        let events = msg.data;
        loadEvents(events);
      }

      // If we know a new iframe has been added to the page, load scripts into it and update the
      // frames list if it has been directly loaded.
      if (msg.type === "NewIFrame") {
        const isLoaded = await loadScripts(msg.data);
        if (isLoaded) {
          store.updateIFrameList();
        }
      }
    });
  }
});

// Load all settings from the chrome sync storage
async function loadSettings() {
  let storage = await browserInstance.storage.local.get();
  if (storage.owl_devtools_dark_mode === undefined) {
    // Load dark mode based on the global settings of the chrome devtools
    darkMode = browserInstance.devtools.panels.themeName === "dark";
  } else {
    darkMode = storage.owl_devtools_dark_mode;
  }
  store.settings.darkMode = darkMode;
  if (darkMode) {
    document.querySelector("html").classList.add("dark-mode");
  } else {
    document.querySelector("html").classList.remove("dark-mode");
  }
}

// Function to handle and store a batch of events coming from the page
function loadEvents(events) {
  if (!Array.isArray(events)) {
    return;
  }
  for (const event of events) {
    // Check if the event data has the right shape for security purpose
    if (
      !isObjectWithShape(event, {
        type: "string",
        component: "string",
        key: "string",
        path: "object",
        time: "number",
        id: "number",
      }) ||
      !(Array.isArray(event.path) && event.path.every((val) => typeof val === "string"))
    ) {
      return;
    }
    event.origin = null;
    event.toggled = false;
    // Logic to retrace the origin of the event if it is not a root render event
    if (!event.type.includes("render")) {
      for (let i = store.events.length - 1; i >= 0; i--) {
        if (
          !store.events[i].origin &&
          event.path.join("/").includes(store.events[i].path.join("/"))
        ) {
          event.origin = toRaw(store.events[i]);
          break;
        }
        if (
          store.events[i].origin &&
          event.path.join("/").includes(store.events[i].origin.path.join("/"))
        ) {
          event.origin = toRaw(store.events[i].origin);
          break;
        }
      }
    }
    // Add the event to the events tree immediatly when the events view is in tree mode
    if (store.eventsTreeView) {
      let eventNode = Object.assign({}, event);
      eventNode.children = [];
      eventNode.toggled = true;
      if (!eventNode.origin) {
        eventNode.depth = 0;
        store.eventsTree.push(eventNode);
      } else {
        // Similar to when we're constructing the whole tree
        for (let i = store.eventsTree.length - 1; i >= 0; i--) {
          if (eventNode.origin.path.join("/") === store.eventsTree[i].path.join("/")) {
            const relativePath = eventNode.path.slice(
              store.eventsTree[i].path.length,
              eventNode.path.length - 1
            );
            let parent = store.eventsTree[i];
            for (const key of relativePath) {
              parent = parent.children.find((child) => child.key === key);
            }
            eventNode.depth = parent.depth + 1;
            parent.children.push(eventNode);
            break;
          }
        }
      }
    }
    // Make sure we add the event while keeping the whole list ordered by id
    addEventSorted(event);
  }
}

// Deselect component and remove highlight on all children
function deselectComponent(component) {
  component.selected = false;
  component.highlighted = false;
  for (const child of component.children) {
    deselectComponent(child);
  }
}

// Used to check if the given object has the right shape
function isObjectWithShape(obj, shape) {
  if (typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }

  return Object.keys(shape).every(
    (key) => obj.hasOwnProperty(key) && typeof obj[key] === shape[key]
  );
}

// A binary search algorith to efficiently add an event in the events array while keeping it sorted
function addEventSorted(item) {
  let low = 0;
  let high = store.events.length;
  while (low < high) {
    let mid = Math.floor((low + high) / 2);
    if (store.events[mid].id < item.id) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  store.events.splice(low, 0, item);
}

// Apply highlight recursively to all children of a selected component
function highlightChildren(component) {
  component.children.forEach((child) => {
    child.highlighted = true;
    highlightChildren(child);
  });
}

// Expand the node given in entry and all of its children
function expandNodes(node) {
  node.toggled = true;
  for (const child of node.children) {
    expandNodes(child);
  }
}

// Fold the node given in entry and all of its children
function foldNodes(node) {
  node.toggled = false;
  for (const child of node.children) {
    foldNodes(child);
  }
}

// Load the scripts in the specified frame
async function loadScripts(frameUrl) {
  return await evalInWindow(globalHook, frameUrl);
}

// Shallow array equality
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    // Check if the arrays are of the same length
    return false;
  }
  return arr1.every((val, i) => val === arr2[i]); // Compare each element of the arrays
}

async function getTabURL() {
  if (IS_FIREFOX) {
    // This happens in firefox when the method is called inside devtools so we ask the background to execute it instead
    browserInstance.runtime.sendMessage({ type: "getActiveTabURL" }).then((response) => {
      return response.result;
    });
  } else {
    return await getActiveTabURL();
  }
}

// General method for executing functions from the loaded scripts in the right frame of the page
// using the __OWL__DEVTOOLS_GLOBAL_HOOK__. Take the function's args as an array.
async function evalFunctionInWindow(fn, args = [], frameUrl = "top") {
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

// General method for executing code in the window using chrome.devtools.inspectedWindow.eval.
async function evalInWindow(code, frameUrl = "top") {
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
