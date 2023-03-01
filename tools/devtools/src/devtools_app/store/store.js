const { reactive, useState, toRaw } = owl;
import { evalInWindow, fuzzySearch } from "../../utils";

// Main store which contains all states that needs to be maintained throughout all components in the devtools app
export const store = reactive({
  settings: {
    expandByDefault: true,
    toggleOnSelected: false,
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
    close(){
      this.activeMenu = -1;
    }
  },
  frameUrls: ["top"],
  activeFrame: "top",
  page: "ComponentsTab",
  events: [],
  eventsTreeView: true,
  eventsTree: [],
  activeRecorder: false,
  owlStatus: true,
  splitPosition: 60,
  leftWidth: 0,
  rightWidth: 0,
  apps: [],
  activeComponent: {
    path: ["0"],
    name: "App",
    subscriptions: [],
    props: {},
    env: {},
    instance: {},
  },
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
  renderPaths: [],

  // Used to navigate between the Components tab and the Events tab
  switchTab(componentName) {
    this.page = componentName;
    this.componentSearch.activeSelector = false;
    evalInWindow("disableHTMLSelector", [], this.activeFrame);
  },

  // Load all data related to the components tree using the global hook loaded on the page
  // Use fromOld to specify if we want to keep most of the toggled/selected data of the old tree
  // when generating the new one
  async loadComponentsTree(fromOld) {
    const apps = await evalInWindow(
      "getComponentsTree",
      fromOld ? [this.activeComponent.path, this.apps] : [],
      this.activeFrame
    );
    if (apps.length === 0) {
      this.owlStatus = false;
      return;
    }
    this.apps = apps;
    if (!fromOld && this.settings.expandByDefault) {
      this.apps.forEach((tree) => expandNodes(tree));
    }
    const component = await evalInWindow(
      "getComponentDetails",
      fromOld ? [this.activeComponent.path, this.activeComponent] : [],
      this.activeFrame
    );
    if (component) {
      this.activeComponent = component;
    }
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
    let element;
    if (path.length < 2) {
      element = this.apps[path[0]];
    } else {
      element = this.apps[path[0]].children[0];
    }
    for (let i = 2; i < path.length; i++) {
      element.toggled = true;
      const result = element.children.find((child) => child.key === path[i]);
      if (result) {
        element = result;
      } else {
        break;
      }
    }
    element.selected = true;
    highlightChildren(element);
    const component = await evalInWindow("getComponentDetails", [element.path], this.activeFrame);
    this.activeComponent = component;
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
    let cp = path.slice(2);
    let component;
    if (path.length < 2) {
      component = this.apps[path[0]];
    } else {
      component = this.apps[path[0]].children[0];
    }
    for (const key of cp) {
      component = component.children.find((child) => child.key === key);
    }
    return component;
  },

  // Search the component given its path and expand/fold itself and its children based on toggle
  toggleComponentAndChildren(path, toggle) {
    let component = this.getComponentByPath(path);
    toggle ? expandNodes(component) : foldNodes(component);
  },

  // Action related to the left(toggle)/up(not toggle) arrow keys for navigation purpose
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
        console.log(key, parentPath);
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

  // Toggle expansion of the component tree element given by the path
  toggleComponentTreeElementDisplay(path) {
    let component = this.getComponentByPath(path);
    component.toggled = !component.toggled;
  },

  // Returns the specified object in the right objects tree
  findObjectInTree(inputObj) {
    let path = [...inputObj.path];
    let obj;
    if (inputObj.objectType !== "instance") {
      path.shift();
    }
    if (typeof path[0] === "object") {
      if (path[0].type === "prototype") {
        path[0] = "[[Prototype]]";
      } else {
        path[0] = path[0].key;
      }
    }
    if (inputObj.objectType === "props") {
      obj = this.activeComponent.props[path[0]];
    } else if (inputObj.objectType === "env") {
      obj = this.activeComponent.env[path[0]];
    } else if (inputObj.objectType === "instance") {
      obj = this.activeComponent.instance[path[0]];
    } else if (inputObj.objectType === "subscription") {
      obj = this.activeComponent.subscriptions[path[0]].target;
    }
    for (let i = 1; i < path.length; i++) {
      const match = path[i];
      if (typeof match === "object") {
        switch (match.type) {
          case "map entries":
          case "set entries":
            obj = obj.children.find((child) => child.name === "[[Entries]]");
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
            obj = obj.children.find((child) => child.name === "[[Prototype]]");
            break;
          case "symbol":
            obj = obj.children.find((child) => child.name === match.key);
        }
      } else if (obj.contentType === "array") {
        obj = obj.children[match];
      } else {
        obj = obj.children.find((child) => child.name === match);
      }
    }
    return obj;
  },

  // Replace the (...) content of a getter with the value returned by the corresponding get method
  async loadGetterContent(inputObj) {
    let obj = this.findObjectInTree(inputObj);
    const result = await evalInWindow(
      "loadGetterContent",
      [this.activeComponent.path, obj],
      this.activeFrame
    );
    Object.keys(obj).forEach((key) => {
      obj[key] = result[key];
    });
    obj.children = [];
  },

  // Expand the children of the input object property and load it from page if necessary
  async toggleObjectTreeElementsDisplay(inputObj) {
    if (!inputObj.hasChildren) {
      return;
    }
    let obj = this.findObjectInTree(inputObj);
    if (obj.hasChildren && obj.children.length === 0) {
      const children = await evalInWindow(
        "loadObjectChildren",
        [
          this.activeComponent.path,
          obj.path,
          obj.depth,
          obj.contentType,
          obj.objectType,
          this.activeComponent,
        ],
        this.activeFrame
      );
      obj.children = children;
    }
    obj.toggled = !obj.toggled;
  },

  // Toggle the selector tool which is used to select a component based on the hovered Dom element
  toggleSelector() {
    this.componentSearch.activeSelector = !this.componentSearch.activeSelector;
    evalInWindow(
      this.componentSearch.activeSelector ? "enableHTMLSelector" : "disableHTMLSelector",
      [],
      this.activeFrame
    );
  },

  // Update the value of the given object with the new provided one
  editObjectTreeElement(objectPath, value, objectType) {
    evalInWindow(
      "editObject",
      [this.activeComponent.path, objectPath, value, objectType],
      this.activeFrame
    );
  },

  // Checks for all iframes in the page, register it and load the scripts inside if not already done
  async updateIFrameList() {
    const frames = await evalInWindow("getIFrameUrls", []);
    for (const frame of frames) {
      chrome.devtools.inspectedWindow.eval(
        "window.__OWL_DEVTOOLS__?.Fiber !== undefined;",
        { frameURL: frame },
        (hasOwl) => {
          if (hasOwl) {
            chrome.devtools.inspectedWindow.eval(
              "window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;",
              { frameURL: frame },
              async (scriptsLoaded) => {
                if (!scriptsLoaded) {
                  await loadScripts(frame);
                }
              }
            );
            if (!this.frameUrls.includes(frame)) {
              this.frameUrls = [...this.frameUrls, frame];
            }
          }
        }
      );
    }
  },

  // Resets the context of all values in the devtools tab and load the one from the given frame
  selectFrame(frame) {
    evalInWindow("removeHighlights", [], this.activeFrame);
    evalInWindow("toggleEventsRecording", [false, 0], this.activeFrame);
    this.events = [];
    this.eventsTree = [];
    this.activeFrame = frame;
    store.loadComponentsTree(false);
    evalInWindow(
      "toggleEventsRecording",
      [this.activeRecorder, this.events.length],
      this.activeFrame
    );
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
        for (let i = tree.length - 1; i >= 0; i--) {
          if (arraysEqual(eventNode.origin.path, tree[i].path)) {
            const relativePath = eventNode.path.slice(
              tree[i].path.length,
              eventNode.path.length - 1
            );
            let parent = tree[i];
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

  // Gives access to the specied event in the events tree
  findEventInTree(event) {
    let result;
    if (event.origin) {
      result = this.eventsTree.find((eventNode) => eventNode.id === event.origin.id);
    } else {
      result = this.eventsTree.find((eventNode) => eventNode.id === event.id);
      return result;
    }
    const relativePath = event.path.slice(result.path.length);
    for (const key of relativePath) {
      result = result.children.find((child) => child.key === key);
    }
    return result;
  },

  toggleEventAndChildren(event, toggle) {
    let eventNode = this.findEventInTree(event);
    if (toggle) {
      expandNodes(eventNode);
    } else {
      foldNodes(eventNode);
    }
  },

  resetData() {
    this.loadComponentsTree(false);
    this.events = [];
    this.eventsTree = [];
    evalInWindow("toggleEventsRecording", [false, 0]);
  },

  // Triggers manually the rendering of the selected component
  refreshComponent(path = this.activeComponent.path) {
    evalInWindow("refreshComponent", [path], this.activeFrame);
  },

  // Allows to log data on the component in the console:
  // type can be "node", "props", "env", "subscription" or "instance"
  logComponentDataInConsole(type, path = this.activeComponent.path) {
    evalInWindow("sendObjectToConsole", [path, type], this.activeFrame);
  },

  // Inspect the given component's data based on the given type
  inspectComponent(type, path = this.activeComponent.path) {
    switch (type) {
      case "DOM":
        evalInWindow("inspectComponentDOM", [path], this.activeFrame);
        break;
      case "source":
        evalInWindow("inspectComponentSource", [path], this.activeFrame);
        break;
      case "compiled template":
        evalInWindow("inspectComponentCompiledTemplate", [path], this.activeFrame);
        break;
      case "raw template":
        evalInWindow("inspectComponentRawTemplate", [path], this.activeFrame);
        break;
    }
  },

  // Trigger the highlight on the component in the page
  highlightComponent(path) {
    evalInWindow("highlightComponent", [path], this.activeFrame);
  },

  // Toggle the recording of events in the page
  async toggleRecording() {
    this.activeRecorder = await evalInWindow(
      "toggleEventsRecording",
      [!this.activeRecorder, this.events.length],
      this.activeFrame
    );
  },

  clearEventsConsole() {
    this.events = [];
    this.eventsTree = [];
    evalInWindow("resetEvents", [], this.activeFrame);
  },
});

// Instantiate the store
export function useStore() {
  return useState(store);
}

// We want to load the base components tree when the devtools tab is first opened
store.loadComponentsTree(false);

// We also want to detect the different iframes at first loading of the devtools tab
store.updateIFrameList();

document.addEventListener("click", () => store.contextMenu.close(), { capture: true });
document.addEventListener("contextmenu", () => store.contextMenu.close(), { capture: true });

for (const frame of store.frameUrls) {
  evalInWindow("toggleEventsRecording", [false, 0], frame);
}

let flushRendersTimeout = false;

if (chrome.devtools.panels.themeName === "dark") {
  document.querySelector("html").classList.add("dark-mode");
} else {
  document.querySelector("html").classList.remove("dark-mode");
}

// This is useful for checking regularly if owl is not present on the page while the owl devtools
// tab is still opened
const keepAliveInterval = setInterval(keepAlive, 500);

// As explained above
function keepAlive() {
  if (!store.owlStatus) {
    chrome.devtools.inspectedWindow.eval(
      "window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;",
      (hasOwl) => {
        if (hasOwl) {
          store.owlStatus = true;
          store.resetData();
        }
      }
    );
  }
}

// Connect to the port to communicate to the background script
chrome.runtime.onConnect.addListener((port) => {
  if (!port.name === "OwlDevtoolsPort") {
    return;
  }
  port.onMessage.addListener((msg) => {
    // When message of type Flush is received, overwrite the component tree with the new one from page
    // A flush message is sent everytime a component is rendered on the page
    if (msg.type === "Flush") {
      if (!(Array.isArray(msg.data) && msg.data.every((val) => typeof val === "string"))) {
        return;
      }
      store.renderPaths = [...store.renderPaths, msg.data];
      clearTimeout(flushRendersTimeout);
      flushRendersTimeout = setTimeout(() => {
        store.renderPaths = [];
      }, 200);
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

    // We need to reload the components tree when the set of apps in the page is modified
    if (msg.type === "RefreshApps") {
      store.loadComponentsTree(true);
    }

    // Logic for recording an event when the event message is received
    if (msg.type === "Event") {
      let events = msg.data;
      loadEvents(events);
    }

    // If we know a new iframe has been added to the page, update the iframe list
    if (msg.type === "NewIFrame") {
      setTimeout(() => {
        store.updateIFrameList();
      }, 100);
    }

    // Reload the tree after checking if the scripts are loaded when this message is received
    if (msg.type === "Reload") {
      chrome.devtools.inspectedWindow.eval(
        "window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;",
        (result) => {
          store.owlStatus = result;
          if (result) {
            store.loadComponentsTree(false);
          }
        }
      );
    }
  });
});

function loadEvents(events) {
  if (!Array.isArray(events)) {
    return;
  }
  for (const event of events) {
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
  node.children.forEach((child) => {
    expandNodes(child);
  });
}

// Fold the node given in entry and all of its children
function foldNodes(node) {
  node.toggled = false;
  node.children.forEach((child) => {
    foldNodes(child);
  });
}

// Load the scripts in the specified frame
async function loadScripts(frameUrl) {
  const response = await fetch("../page_scripts/load_scripts.js");
  const contents = await response.text();
  chrome.devtools.inspectedWindow.eval(contents, { frameURL: frameUrl });
}

// Shallow array equality
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    // Check if the arrays are of the same length
    return false;
  }
  return arr1.every((val, i) => val === arr2[i]); // Compare each element of the arrays
}
