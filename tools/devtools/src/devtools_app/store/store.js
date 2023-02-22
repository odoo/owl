const { reactive, useState, toRaw } = owl;
import { evalInWindow, fuzzySearch } from "../../utils";

// Main store which contains all states that needs to be maintained throughout all components in the devtools app
export const store = reactive({
  settings: {
    expandByDefault: true,
    toggleOnSelected: false,
  },
  frameUrls: ["top"],
  activeFrame: "top",
  page: "ComponentsTab",
  events: [],
  eventsTreeView: false,
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
  loadComponentsTree(fromOld) {
    evalInWindow(
      "getComponentsTree",
      fromOld ? [JSON.stringify(this.activeComponent.path), JSON.stringify(this.apps)] : [],
      this.activeFrame
    ).then((result) => {
      if (result.length === 0) {
        this.owlStatus = false;
        return;
      }
      this.apps = result;
      if (!fromOld && this.settings.expandByDefault) {
        this.apps.forEach((tree) => expandNodes(tree));
      }
    });
    evalInWindow(
      "getComponentDetails",
      fromOld
        ? [JSON.stringify(this.activeComponent.path), JSON.stringify(this.activeComponent)]
        : [],
      this.activeFrame
    ).then((result) => {
      if (result) {
        this.activeComponent = result;
      }
    });
  },

  // Select a component by retrieving its details from the page based on its path
  selectComponent(path) {
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
      let result = element.children.filter((child) => child.key === path[i])[0];
      if (result) {
        element = result;
      }
    }
    element.selected = true;
    highlightChildren(element);
    evalInWindow("getComponentDetails", [JSON.stringify(element.path)], this.activeFrame).then(
      (result) => (this.activeComponent = result)
    );
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
      component = component.children.filter((child) => child.key === key)[0];
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
      component = component.children.filter((child) => child.key === key)[0];
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
      let component = this.getComponentByPath(this.activeComponent.path);
      if (component.children.length > 0 && component.toggled) {
        component.toggled = false;
      } else {
        if (this.activeComponent.path.length > 1)
          this.selectComponent(this.activeComponent.path.slice(0, -1));
      }
      return;
    }
    const currentElement = document.getElementById(
      "treeElement/" + this.activeComponent.path.join("/")
    );
    const prevElement = currentElement.previousElementSibling;
    if (prevElement) {
      const prevPath = prevElement.id.substring(12).split("/");
      this.selectComponent(prevPath);
    }
  },

  // Action related to the right(toggle)/down(not toggle) arrow keys for navigation purpose
  toggleOrSelectNextElement(toggle) {
    if (toggle) {
      let component = this.getComponentByPath(this.activeComponent.path);
      if (component.children.length > 0) {
        if (!component.toggled) {
          component.toggled = true;
          return;
        }
      } else {
        return;
      }
    }
    const currentElement = document.getElementById(
      "treeElement/" + this.activeComponent.path.join("/")
    );
    const nextElement = currentElement.nextElementSibling;
    if (nextElement) {
      const nextPath = nextElement.id.substring(12).split("/");
      this.selectComponent(nextPath);
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
      } else if (obj.contentType === "array") {
        obj = obj.children[match];
      } else {
        obj = obj.children.filter((child) => child.name === match)[0];
      }
    }
    return obj;
  },

  // Replace the (...) content of a getter with the value returned by the corresponding get method
  loadGetterContent(inputObj) {
    let obj = this.findObjectInTree(inputObj);
    evalInWindow(
      "loadGetterContent",
      [JSON.stringify(this.activeComponent.path), JSON.stringify(obj)],
      this.activeFrame
    ).then((result) => {
      Object.keys(obj).forEach((key) => {
        obj[key] = result[key];
      });
      obj.children = [];
    });
  },

  // Expand the children of the input object property and load it from page if necessary
  toggleObjectTreeElementsDisplay(inputObj) {
    if (!inputObj.hasChildren) {
      return;
    }
    let obj = this.findObjectInTree(inputObj);
    if (obj.hasChildren && obj.children.length === 0) {
      evalInWindow(
        "loadObjectChildren",
        [
          JSON.stringify(this.activeComponent.path),
          JSON.stringify(obj.path),
          obj.depth,
          '"' + obj.contentType + '"',
          '"' + obj.objectType + '"',
          JSON.stringify(this.activeComponent),
        ],
        this.activeFrame
      ).then((result) => (obj.children = result));
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
      [
        JSON.stringify(this.activeComponent.path),
        JSON.stringify(objectPath),
        value,
        JSON.stringify(objectType),
      ],
      this.activeFrame
    );
  },

  // Checks for all iframes in the page, register it and load the scripts inside if not already done
  updateIFrameList() {
    evalInWindow("getIFrameUrls", []).then((frames) => {
      for (const frame of frames) {
        chrome.devtools.inspectedWindow.eval(
          "window.__OWL_DEVTOOLS__?.Fiber !== undefined;",
          { frameURL: frame },
          (hasOwl) => {
            if (hasOwl) {
              chrome.devtools.inspectedWindow.eval(
                "window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;",
                { frameURL: frame },
                (scriptsLoaded) => {
                  if (!scriptsLoaded) {
                    loadScripts(frame);
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
    });
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

  // Constructs the tree that represents the currently recorded events to see them as a tree instead of a temporaly accurate list
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
          if (eventNode.origin.path.join("/") === tree[i].path.join("/")) {
            const relativePath = eventNode.path.slice(
              tree[i].path.length,
              eventNode.path.length - 1
            );
            let parent = tree[i];
            for (const key of relativePath) {
              parent = parent.children.filter((child) => child.key === key)[0];
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
      [result] = this.eventsTree.filter((eventNode) => eventNode.id === event.origin.id);
    } else {
      [result] = this.eventsTree.filter((eventNode) => eventNode.id === event.id);
      return result;
    }
    const relativePath = event.path.slice(result.path.length);
    for (const key of relativePath) {
      result = result.children.filter((child) => child.key === key)[0];
    }
    return result;
  },

  toggleEventAndChildren(event, toggle) {
    let eventNode = this.findEventInTree(event);
    toggle ? expandNodes(eventNode) : foldNodes(eventNode);
  },

  resetData() {
    this.loadComponentsTree(false);
    this.events = [];
    this.eventsTree = [];
    evalInWindow("toggleEventsRecording", [false, 0]);
  },

  // Triggers manually the rendering of the selected component
  refreshComponent(path = this.activeComponent.path) {
    evalInWindow("refreshComponent", [JSON.stringify(path)], this.activeFrame);
  },

  logComponentInConsole(type, path = this.activeComponent.path) {
    evalInWindow("sendObjectToConsole", [JSON.stringify(path), '"' + type + '"'], this.activeFrame);
  },

  inspectComponentInDOM(path = this.activeComponent.path) {
    evalInWindow("inspectComponentDOM", [JSON.stringify(path)], this.activeFrame);
  },

  inspectComponentSource(path = this.activeComponent.path) {
    evalInWindow("inspectComponentSource", [JSON.stringify(path)], this.activeFrame);
  },

  inspectCompiledTemplate(path = this.activeComponent.path) {
    evalInWindow("inspectComponentCompiledTemplate", [JSON.stringify(path)], this.activeFrame);
  },

  inspectRAwTemplate(path = this.activeComponent.path) {
    evalInWindow("inspectComponentRawTemplate", [JSON.stringify(path)], this.activeFrame);
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

for (const frame of store.frameUrls) {
  evalInWindow("toggleEventsRecording", [false, 0], frame);
}

let flushRendersTimeout = false;

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
  port.onMessage.addListener((msg) => {
    // When message of type Flush is received, overwrite the component tree with the new one from page
    // A flush message is sent everytime a component is rendered on the page
    if (msg.type === "Flush") {
      store.renderPaths = [...store.renderPaths, msg.data];
      clearTimeout(flushRendersTimeout);
      flushRendersTimeout = setTimeout(() => {
        store.renderPaths = [];
      }, 200);
      store.loadComponentsTree(true);
    }
    // Select the component based on the path received with the SelectElement message
    if (msg.type === "SelectElement") {
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
      let event = msg.data;
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
                parent = parent.children.filter((child) => child.key === key)[0];
              }
              eventNode.depth = parent.depth + 1;
              parent.children.push(eventNode);
              break;
            }
          }
        }
      }
      store.events = [...store.events, msg.data];
      // We want to sort the events based on their id since the order between messages reception may not be an accurate representation
      store.events.sort((a, b) => a.id - b.id);
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

// Deselect component and remove highlight on all children
function deselectComponent(component) {
  component.selected = false;
  component.highlighted = false;
  component.children.forEach((child) => {
    deselectComponent(child);
  });
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
function loadScripts(frameUrl) {
  fetch("../page_scripts/load_scripts.js")
    .then((response) => response.text())
    .then((contents) => {
      chrome.devtools.inspectedWindow.eval(contents, { frameURL: frameUrl });
    });
}
