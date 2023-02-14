const { reactive, useState } = owl;
import { evalInWindow, fuzzySearch } from "../../utils";

export const store = reactive({
  settings: {
    expandByDefault: true,
    toggleOnSelected: false,
  },
  frameUrls: ["top"],
  activeFrame: "top",
  page: "ComponentsTab",
  events: [],
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
  renderPaths: [],

  switchTab(componentName) {
    this.page = componentName;
  },

  loadComponentsTree(fromOld) {
    evalInWindow(
      "getComponentsTree",
      fromOld ? [JSON.stringify(this.activeComponent.path), JSON.stringify(this.apps)] : [],
      this.activeFrame
    ).then((result) => {
      this.apps = result;
      if (!fromOld && this.settings.expandByDefault)
        this.apps.forEach((tree) => expandComponents(tree));
    });
    evalInWindow(
      "getComponentDetails",
      fromOld
        ? [JSON.stringify(this.activeComponent.path), JSON.stringify(this.activeComponent)]
        : [],
      this.activeFrame
    ).then((result) => (this.activeComponent = result));
  },

  // Select a component by retrieving its details from the page based on its path
  selectComponent(path) {
    if (path.length < 2) return;
    // Deselect all components
    this.apps.forEach((app) => {
      app.selected = false;
      app.highlighted = false;
      app.children.forEach((child) => {
        deselectComponent(child);
      });
    });
    let element;
    if (path.length < 2) element = this.apps[path[0]];
    else element = this.apps[path[0]].children[0];
    for (let i = 2; i < path.length; i++) {
      element.toggled = true;
      let result = element.children.filter((child) => child.key === path[i])[0];
      if (result) element = result;
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
    this.apps.forEach((app) => this.getSearchResults(search, app));
    if (this.componentSearch.searchResults.length > 0) {
      this.componentSearch.searchIndex = 0;
      this.selectComponent(this.componentSearch.searchResults[0]);
      this.apps.forEach((app) => foldComponents(app));
      for (const result of this.componentSearch.searchResults) {
        this.toggleComponentParents(result);
      }
    } else this.componentSearch.searchIndex = -1;
  },

  // Search for results in the components tree given the current search string (in a fuzzy way)
  getSearchResults(search, node) {
    if (search.length < 1) return;
    if (fuzzySearch(node.name, search)) {
      this.componentSearch.searchResults.push(node.path);
    }
    if (node.children) {
      node.children.forEach((child) => this.getSearchResults(search, child));
    }
  },

  toggleComponentParents(path) {
    let cp = path.slice(2);
    this.apps[path[0]].toggled = true;
    let component = this.apps[path[0]].children[0];
    for (const key of cp) {
      component.toggled = true;
      component = component.children.filter((child) => child.key === key)[0];
    }
  },

  getComponentByPath(path) {
    let cp = path.slice(2);
    let component;
    if (path.length < 2) component = this.apps[path[0]];
    else component = this.apps[path[0]].children[0];
    for (const key of cp) {
      component = component.children.filter((child) => child.key === key)[0];
    }
    return component;
  },

  // Search the component given its path and expand/fold itself and its children based on toggle
  toggleComponentAndChildren(path, toggle) {
    let component = this.getComponentByPath(path);
    toggle ? expandComponents(component) : foldComponents(component);
  },

  toggleOrSelectPrevElement(toggle) {
    if (toggle) {
      let component = this.getComponentByPath(this.activeComponent.path);
      if (component.children.length > 0 && component.toggled) component.toggled = false;
      else {
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

  toggleOrSelectNextElement(toggle) {
    if (toggle) {
      let component = this.getComponentByPath(this.activeComponent.path);
      if (component.children.length > 0) {
        if (!component.toggled) {
          component.toggled = true;
          return;
        }
      } else return;
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

  findObjectInTree(inputObj) {
    let path = [...inputObj.path];
    let obj;
    if (inputObj.objectType !== "instance") path.shift();
    if (typeof path[0] === "object") {
      if (path[0].type === "prototype") {
        path[0] = "[[Prototype]]";
      } else path[0] = path[0].key;
    }
    if (inputObj.objectType === "props") obj = this.activeComponent.props[path[0]];
    else if (inputObj.objectType === "env") obj = this.activeComponent.env[path[0]];
    else if (inputObj.objectType === "instance") obj = this.activeComponent.instance[path[0]];
    else if (inputObj.objectType === "subscription")
      obj = this.activeComponent.subscriptions[path[0]].target;
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
  },

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
    if (!inputObj.hasChildren) return;
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

  // Triggers manually the rendering of the selected component
  refreshComponent() {
    evalInWindow("refreshComponent", [JSON.stringify(this.activeComponent.path)], this.activeFrame);
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

  updateIFrameList() {
    console.log("called");
    evalInWindow("getIFrameUrls", []).then((frames) => {
      console.log(frames);
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
              this.frameUrls = [...this.frameUrls, frame];
            }
          }
        );
      }
    });
  },

  selectFrame(frame){
    evalInWindow("removeHighlights", [], this.activeFrame);
    evalInWindow("toggleEventsRecording", [false], this.activeFrame);
    this.activeFrame = frame;
    store.loadComponentsTree(false);
    evalInWindow("toggleEventsRecording", [this.activeRecorder], this.activeFrame);
  }
});

export function useStore() {
  return useState(store);
}

store.loadComponentsTree(false);

store.updateIFrameList();

let flushRendersTimeout = false;

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

    if (msg.type === "RefreshApps") {
      store.loadComponentsTree(true);
    }

    if (msg.type === "Event") {
      store.events = [...store.events, msg.data];
      store.events.sort((a, b) => a.id - b.id);
    }

    if (msg.type === "NewIFrame") {
      setTimeout(() => {
        store.updateIFrameList();
      }, 100);
    }

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

// Expand the component given in entry and all of its children
function expandComponents(component) {
  component.toggled = true;
  component.children.forEach((child) => {
    expandComponents(child);
  });
}

// Fold the component given in entry and all of its children
function foldComponents(component) {
  component.toggled = false;
  component.children.forEach((child) => {
    foldComponents(child);
  });
}

function loadScripts(frameUrl) {
  fetch("../page_scripts/load_scripts.js")
    .then((response) => response.text())
    .then((contents) => {
      chrome.devtools.inspectedWindow.eval(contents, { frameURL: frameUrl });
    });
}
