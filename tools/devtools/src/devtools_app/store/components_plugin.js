const { Plugin, signal, proxy, toRaw, plugin } = owl;
import { fuzzySearch, IS_FIREFOX, browserInstance } from "../../utils";
import { StorePlugin, evalFunctionInWindow, evalInWindow } from "./store";

// Plugin handling all components-tab state and logic: tree, search, navigation,
// selector/highlight, details panel, inspect/debug, and observed variables.
export class ComponentsPlugin extends Plugin {
  // --- Component tree state ---
  apps = signal(proxy([]));
  activeComponent = signal(proxy({
    path: ["0"],
    name: "App",
    subscriptions: { toggled: true, children: [] },
    props: { toggled: true, children: [] },
    env: { toggled: false, children: [] },
    instance: { toggled: true, children: [] },
    hooks: { toggled: true, children: [] },
    version: "1.0",
  }));

  // --- Search state ---
  searchText = signal("");
  searchResults = signal([]);
  searchIndex = signal(0);

  // --- Selector / highlight state ---
  activeSelector = signal(false);
  selectedElement = signal(null);
  renderPaths = proxy(new Set());

  // --- Inspect state ---
  observedVariables = signal(proxy([]));

  setup() {
    this._store = plugin(StorePlugin);
  }

  // -------------------------------------------------------------------------
  // Components tree
  // -------------------------------------------------------------------------

  async loadComponentsTree(fromOld) {
    if (IS_FIREFOX) {
      await evalInWindow("window.$0 = $0;", this._store.activeFrame());
    }
    const [apps, details] = await evalFunctionInWindow(
      "getComponentsTree",
      fromOld && this.activeComponent()
        ? [this.activeComponent().path, this.apps(), this.activeComponent()]
        : [],
      this._store.activeFrame()
    );
    this.apps.set(proxy(apps || []));
    if (!fromOld && this._store.expandByDefault()) {
      this.apps().forEach((tree) => expandNodes(tree, this._store.componentsToggleBlacklist()));
    }
    if (details.env) {
      keepEnvLit(details);
    }
    this.activeComponent.set(proxy(details));
    if (this.searchText().length) {
      this.updateSearch(this.searchText());
    }
  }

  async selectComponent(path) {
    // Deselect all components
    this.apps().forEach((app) => {
      app.selected = false;
      app.highlighted = false;
      app.children.forEach((child) => deselectComponent(child));
    });
    let component;
    // path[0] = app index, path[1] = root index, path[2..] = child keys
    if (path.length === 1) {
      component = this.apps()[path[0]];
    } else {
      component = this.apps()[path[0]].children[parseInt(path[1], 10)];
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
    this.highlightComponent(path);
    const details = await evalFunctionInWindow(
      "getComponentDetails",
      [component.path],
      this._store.activeFrame()
    );
    if (!details) {
      await this.loadComponentsTree(false);
    } else {
      if (details.env) {
        keepEnvLit(details);
      }
      this.activeComponent.set(proxy(details));
    }
    if (this._store.page() !== "ComponentsTab") {
      this._store.switchTab("ComponentsTab");
    }
  }

  // Toggle all parent components of the specified one to make sure it is visible in the tree
  toggleComponentParents(path) {
    let cp = path.slice(2);
    this.apps()[path[0]].toggled = true;
    let component = this.apps()[path[0]].children[parseInt(path[1], 10)];
    for (const key of cp) {
      component.toggled = true;
      component = component.children.find((child) => child.key === key);
    }
  }

  // Returns access to the specified component in the tree
  getComponentByPath(path) {
    let component;
    if (path.length < 2) {
      component = this.apps()[path[0]];
    } else {
      component = this.apps()[path[0]].children[parseInt(path[1], 10)];
    }
    let cp = path.slice(2);
    for (const key of cp) {
      component = component.children.find((child) => child.key === key);
    }
    return component;
  }

  // Expand/fold the component and its children based on toggle
  toggleComponentAndChildren(component, toggle) {
    if (toggle) {
      expandNodes(component);
    } else {
      foldNodes(component);
    }
  }

  // -------------------------------------------------------------------------
  // Component search
  // -------------------------------------------------------------------------

  updateSearch(search) {
    this.searchText.set(search);
    this.searchResults.set([]);
    const results = [];
    this.apps().forEach((app) => this._getComponentSearchResults(search, app, results));
    this.searchResults.set(results);
    if (results.length > 0) {
      this.searchIndex.set(0);
      this.selectComponent(results[0]);
      this.apps().forEach((app) => foldNodes(app));
      for (const result of results) {
        this.toggleComponentParents(result);
      }
    } else {
      this.searchIndex.set(-1);
    }
  }

  _getComponentSearchResults(search, node, results) {
    if (search.length < 1) {
      return;
    }
    if (fuzzySearch(node.name, search)) {
      results.push(node.path);
    }
    if (node.children) {
      node.children.forEach((child) => this._getComponentSearchResults(search, child, results));
    }
  }

  getNextSearch() {
    const index = this.searchIndex();
    const results = this.searchResults();
    if (index > -1 && index < results.length - 1) {
      this.setSearchIndex(index + 1);
    } else if (index === results.length - 1) {
      this.setSearchIndex(0);
    }
  }

  getPrevSearch() {
    const index = this.searchIndex();
    const results = this.searchResults();
    if (index > 0) {
      this.setSearchIndex(index - 1);
    } else if (index === 0) {
      this.setSearchIndex(results.length - 1);
    }
  }

  setSearchIndex(index) {
    this.searchIndex.set(index);
    this.selectComponent(this.searchResults()[index]);
  }

  // -------------------------------------------------------------------------
  // Tree navigation (keyboard)
  // -------------------------------------------------------------------------

  toggleOrSelectPrevElement(toggle) {
    if (toggle) {
      const component = this.getComponentByPath(this.activeComponent().path);
      if (component.children.length > 0 && component.toggled) {
        component.toggled = false;
      } else if (this.activeComponent().path.length > 1) {
        this.selectComponent(this.activeComponent().path.slice(0, -1));
      }
      return;
    }
    const parentPath = [...this.activeComponent().path];
    const key = parentPath.pop();
    if (parentPath.length === 0) {
      const parent = this.apps();
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
  }

  toggleOrSelectNextElement(toggle) {
    let component = this.getComponentByPath(this.activeComponent().path);
    if (toggle) {
      if (!component.children.length) {
        return;
      } else if (!component.toggled) {
        component.toggled = true;
        return;
      }
    }
    if (component.toggled && component.children.length) {
      this.selectComponent(component.children[0].path);
    } else {
      const parentPath = [...this.activeComponent().path];
      while (true) {
        const key = parentPath.pop();
        if (parentPath.length === 0) {
          const index = Number(key);
          if (index < this.apps().length - 1) {
            this.selectComponent(this.apps()[index + 1].path);
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
  }

  // -------------------------------------------------------------------------
  // Object tree / details
  // -------------------------------------------------------------------------

  async loadGetterContent(obj) {
    const result = await evalFunctionInWindow(
      "loadGetterContent",
      [obj],
      this._store.activeFrame()
    );
    Object.keys(obj).forEach((key) => {
      obj[key] = result[key];
    });
    obj.children = [];
  }

  async toggleObjectTreeElementsDisplay(obj) {
    if (!obj.hasChildren || window.getSelection().toString().length) {
      return;
    }
    if (obj.hasChildren && obj.children.length === 0) {
      const children = await evalFunctionInWindow(
        "loadObjectChildren",
        [obj.path, obj.depth, obj.contentType, obj.objectType, this.activeComponent()],
        this._store.activeFrame()
      );
      obj.children = children;
    }
    obj.toggled = !obj.toggled;
  }

  editObjectTreeElement(path, value, objectType) {
    evalFunctionInWindow("editObject", [path, value, objectType], this._store.activeFrame());
  }

  // -------------------------------------------------------------------------
  // Selector / highlight
  // -------------------------------------------------------------------------

  toggleSelector() {
    this.activeSelector.set(!this.activeSelector());
    evalFunctionInWindow(
      this.activeSelector() ? "enableHTMLSelector" : "disableHTMLSelector",
      [],
      this._store.activeFrame()
    );
  }

  highlightComponent(path) {
    evalFunctionInWindow("highlightComponent", [path], this._store.activeFrame());
  }

  removeHighlights() {
    if (this._store.owlStatus() && !this.invalidContext) {
      evalFunctionInWindow("removeHighlights", [], this._store.activeFrame());
    }
  }

  onActiveComponentClick() {
    this.selectedElement()?.scrollIntoView({ block: "center", behavior: "smooth" });
    copyToClipboard(this.activeComponent().name);
  }

  // -------------------------------------------------------------------------
  // Inspect / debug
  // -------------------------------------------------------------------------

  refreshComponent(path = this.activeComponent().path) {
    evalFunctionInWindow("refreshComponent", [path], this._store.activeFrame());
  }

  logObjectInConsole(path) {
    if (!path) {
      if (this.activeComponent().path.length > 1) {
        path = [...this.activeComponent().path, { type: "item", value: "component" }];
      } else {
        path = this.activeComponent().path;
      }
    }
    evalFunctionInWindow("sendObjectToConsole", [path], this._store.activeFrame());
  }

  async inspectFunctionSource(path) {
    await evalFunctionInWindow("inspectFunctionSource", [path], this._store.activeFrame());
    if (IS_FIREFOX) {
      await evalInWindow("inspect(window.$temp);", this._store.activeFrame());
    }
  }

  async inspectComponent(type, path = this.activeComponent().path) {
    switch (type) {
      case "DOM":
        await evalFunctionInWindow("inspectComponentDOM", [path], this._store.activeFrame());
        break;
      case "source":
        if (path.length > 1) {
          await evalFunctionInWindow(
            "inspectFunctionSource",
            [[...path, { type: "item", value: "component" }, { type: "item", value: "constructor" }]],
            this._store.activeFrame()
          );
        } else {
          await evalFunctionInWindow(
            "inspectFunctionSource",
            [[...path, { type: "item", value: "constructor" }]],
            this._store.activeFrame()
          );
        }
        break;
      case "compiled template":
        await evalFunctionInWindow(
          "inspectComponentCompiledTemplate",
          [path],
          this._store.activeFrame()
        );
        break;
      case "raw template":
        await evalFunctionInWindow(
          "inspectComponentRawTemplate",
          [path],
          this._store.activeFrame()
        );
        break;
    }
    if (IS_FIREFOX && type !== "raw template") {
      await evalInWindow("inspect(window.$temp);", this._store.activeFrame());
    }
  }

  async injectBreakpoint(hook, path, instanceOnly = false, condition = "1") {
    path = [...path];
    await evalFunctionInWindow(
      "injectBreakpoint",
      [hook, path, instanceOnly, condition],
      this._store.activeFrame()
    );
    await this.loadComponentsTree(true);
  }

  async removeBreakpoints() {
    await evalFunctionInWindow("removeBreakpoints", [], this._store.activeFrame());
    await this.loadComponentsTree(true);
  }

  async observeVariable(path) {
    this.observedVariables().push({ path: [...path], visible: false });
    const result = await evalFunctionInWindow(
      "getObservedVariables",
      [[...this.observedVariables()]],
      this._store.activeFrame()
    );
    this.observedVariables.set(proxy(result));
    await browserInstance.storage.local.set({
      observedVariables: toRaw(this.observedVariables()).map((o) => o.path),
    });
  }

  clearObservedVariable(index) {
    if (index !== undefined) {
      this.observedVariables().splice(index, 1);
    } else {
      this.observedVariables.set(proxy([]));
    }
    browserInstance.storage.local.set({ observedVariables: toRaw(this.observedVariables()) });
  }
}

// -------------------------------------------------------------------------
// Standalone helper functions
// -------------------------------------------------------------------------

function deselectComponent(component) {
  component.selected = false;
  component.highlighted = false;
  for (const child of component.children) {
    deselectComponent(child);
  }
}

function highlightChildren(component) {
  component.children.forEach((child) => {
    child.highlighted = true;
    highlightChildren(child);
  });
}

function expandNodes(node, blacklistSet = null) {
  if (blacklistSet && blacklistSet.has(node.name)) {
    node.toggled = false;
  } else {
    node.toggled = true;
  }
  for (const child of node.children) {
    expandNodes(child, blacklistSet);
  }
}

function foldNodes(node) {
  node.toggled = false;
  for (const child of node.children) {
    foldNodes(child);
  }
}

function keepEnvLit(details) {
  if (!details) return;
  let alreadyMet = new Set();
  for (let i = 0; i < details.env.children.length; i++) {
    if (i < details.env.children.length - 1) {
      alreadyMet.add(details.env.children[i].name);
    } else {
      let lastElement = details.env.children[i];
      while (lastElement.children.at(-1)?.name === "[[Prototype]]") {
        for (const [index, child] of lastElement.children.entries()) {
          if (index < lastElement.children.length - 1) {
            if (!alreadyMet.has(child.name)) {
              child.keepLit = true;
              alreadyMet.add(child.name);
            }
          } else {
            lastElement = child;
          }
        }
      }
    }
  }
}

function copyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("Copy failed", err);
  }
  document.body.removeChild(textarea);
}
