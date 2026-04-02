const { Plugin, signal, proxy, toRaw } = owl;
import { fuzzySearch, IS_FIREFOX, getActiveTabURL, browserInstance } from "../../utils";
import globalHook from "../../page_scripts/owl_devtools_global_hook";

// Main store which contains all states that needs to be maintained throughout all components in the devtools app
export class StorePlugin extends Plugin {
  // --- Primitive state ---
  devtoolsId = signal(0);
  contextMenu = signal(null);
  page = signal("ComponentsTab");
  activeFrame = signal("top");
  frameUrls = signal(["top"]);
  eventsTreeView = signal(true);
  activeRecorder = signal(false);
  owlStatus = signal(true);
  extensionContextStatus = signal(true);
  splitPosition = signal(window.innerWidth > window.innerHeight ? 45 : 60);
  traceRenderings = signal(false);
  traceSubscriptions = signal(false);
  selectedElement = signal(null);

  // --- Settings (flattened) ---
  expandByDefault = signal(true);
  toggleOnSelected = signal(false);
  darkMode = signal(false);
  componentsToggleBlacklist = signal.Set(new Set());

  // --- Component search state (flattened) ---
  searchText = signal("");
  searchResults = signal([]);
  searchIndex = signal(0);
  activeSelector = signal(false);

  // --- Deep reactive state (signal + proxy for nested mutation tracking) ---
  apps = signal(proxy([]));
  events = signal(proxy([]));
  eventsTree = signal(proxy([]));
  observedVariables = signal(proxy([]));
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
  renderPaths = signal.Set(new Set());

  // --- Non-reactive ---
  isFirefox = IS_FIREFOX;

  setup() {
    this._init();
    this._setupPortListener();
  }

  // -------------------------------------------------------------------------
  // Tab / context menu
  // -------------------------------------------------------------------------

  // Used to navigate between the Components tab and the Events tab
  switchTab(componentName) {
    this.page.set(componentName);
    this.activeSelector.set(false);
    evalFunctionInWindow("disableHTMLSelector", [], this.activeFrame());
  }

  openContextMenu(event, items) {
    this.contextMenu.set({
      position: { x: event.clientX, y: event.clientY },
      items,
    });
  }

  // -------------------------------------------------------------------------
  // Components tree
  // -------------------------------------------------------------------------

  // Load all data related to the components tree using the global hook loaded on the page.
  // Use fromOld to specify if we want to keep most of the toggled/selected data of the old tree
  // when generating the new one.
  async loadComponentsTree(fromOld) {
    if (IS_FIREFOX) {
      await evalInWindow("window.$0 = $0;", this.activeFrame());
    }
    const [apps, details] = await evalFunctionInWindow(
      "getComponentsTree",
      fromOld && this.activeComponent()
        ? [this.activeComponent().path, this.apps(), this.activeComponent()]
        : [],
      this.activeFrame()
    );
    this.apps.set(proxy(apps || []));
    if (!fromOld && this.expandByDefault()) {
      this.apps().forEach((tree) => expandNodes(tree, this.componentsToggleBlacklist()));
    }
    keepEnvLit(details);
    this.activeComponent.set(proxy(details));
    if (this.searchText().length) {
      this.updateSearch(this.searchText());
    }
  }

  // Select a component by retrieving its details from the page based on its path
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
      this.activeFrame()
    );
    if (!details) {
      await this.loadComponentsTree(false);
    } else {
      keepEnvLit(details);
      this.activeComponent.set(proxy(details));
    }
    if (this.page() !== "ComponentsTab") {
      this.switchTab("ComponentsTab");
    }
  }

  // -------------------------------------------------------------------------
  // Component search
  // -------------------------------------------------------------------------

  // Update the search state value with the current search string and trigger the search
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

  // Search for results in the components tree given the current search string (in a fuzzy way)
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

  // Set the search index to the provided one in order to select the current searched component
  setSearchIndex(index) {
    this.searchIndex.set(index);
    this.selectComponent(this.searchResults()[index]);
  }

  // -------------------------------------------------------------------------
  // Tree navigation
  // -------------------------------------------------------------------------

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

  foldDirectChildren(element) {
    for (const child of element.children) {
      child.toggled = false;
    }
  }

  // Action related to the left(toggle)/up(not toggle) arrow keys for navigation purpose.
  // The resulting behaviour is the same as in the Elements tab of the chrome devtools.
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
    // If component is an app, find descendant with the highest successive children indexes
    // of the app above, or do nothing if there is no app above
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

  // Action related to the right(toggle)/down(not toggle) arrow keys for navigation purpose.
  // The resulting behaviour is the same as in the Elements tab of the chrome devtools.
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
    // If component has children and is toggled, select its first child
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

  // Replace the (...) content of a getter with the value returned by the corresponding get method
  async loadGetterContent(obj) {
    const result = await evalFunctionInWindow("loadGetterContent", [obj], this.activeFrame());
    Object.keys(obj).forEach((key) => {
      obj[key] = result[key];
    });
    obj.children = [];
  }

  // Expand the children of the input object property and load it from page if necessary
  async toggleObjectTreeElementsDisplay(obj) {
    if (!obj.hasChildren || window.getSelection().toString().length) {
      return;
    }
    // Since it is sometimes impossible (and always ineffective) to load all descendants of a property
    // when the component details are loaded, we need to populate the children of a property only when
    // it is first expanded. Do note that it has a limit to how deep we can expand (when reaching a circular dependancy)
    if (obj.hasChildren && obj.children.length === 0) {
      const children = await evalFunctionInWindow(
        "loadObjectChildren",
        [obj.path, obj.depth, obj.contentType, obj.objectType, this.activeComponent()],
        this.activeFrame()
      );
      obj.children = children;
    }
    obj.toggled = !obj.toggled;
  }

  // Update the value of the given object with the new provided one
  editObjectTreeElement(path, value, objectType) {
    evalFunctionInWindow("editObject", [path, value, objectType], this.activeFrame());
  }

  // -------------------------------------------------------------------------
  // Selector / highlight
  // -------------------------------------------------------------------------

  // Toggle the selector tool which is used to select a component based on the hovered DOM element
  toggleSelector() {
    this.activeSelector.set(!this.activeSelector());
    evalFunctionInWindow(
      this.activeSelector() ? "enableHTMLSelector" : "disableHTMLSelector",
      [],
      this.activeFrame()
    );
  }

  // Trigger the highlight on the component in the page
  highlightComponent(path) {
    evalFunctionInWindow("highlightComponent", [path], this.activeFrame());
  }

  // Remove all the highlight boxes created above the html elements in the page to show components
  removeHighlights() {
    if (this.owlStatus() && !this.invalidContext) {
      evalFunctionInWindow("removeHighlights", [], this.activeFrame());
    }
  }

  // Center the view around the currently selected component
  onActiveComponentClick() {
    this.selectedElement()?.scrollIntoView({ block: "center", behavior: "smooth" });
    copyToClipboard(this.activeComponent().name);
  }

  // -------------------------------------------------------------------------
  // Tracing
  // -------------------------------------------------------------------------

  // Toggle the tracing mode which will record all root render events and send their trace in the console
  async toggleTracing() {
    this.traceRenderings.set(
      await evalFunctionInWindow("toggleTracing", [!this.traceRenderings()], this.activeFrame())
    );
  }

  // Toggle subscriptions tracing mode which will record all new subscriptions
  async toggleSubscriptionTracing() {
    this.traceSubscriptions.set(
      await evalFunctionInWindow(
        "toggleSubscriptionTracing",
        [!this.traceSubscriptions()],
        this.activeFrame()
      )
    );
  }

  // -------------------------------------------------------------------------
  // Frames
  // -------------------------------------------------------------------------

  // Checks for all iframes in the page, register it and load the scripts inside if not already done
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

  // Reset the context of all values in the devtools tab and load the one from the given frame
  selectFrame(frame) {
    this.removeHighlights();
    evalFunctionInWindow("toggleEventsRecording", [false, 0], this.activeFrame());
    evalFunctionInWindow("toggleTracing", [false], this.activeFrame());
    evalFunctionInWindow("toggleSubscriptionTracing", [false], this.activeFrame());
    this.events.set(proxy([]));
    this.eventsTree.set(proxy([]));
    this.activeFrame.set(frame);
    this.loadComponentsTree(false);
    evalFunctionInWindow(
      "toggleEventsRecording",
      [this.activeRecorder(), this.events().length],
      this.activeFrame()
    );
    evalFunctionInWindow("toggleTracing", [this.traceRenderings()], this.activeFrame());
    evalFunctionInWindow(
      "toggleSubscriptionTracing",
      [this.traceSubscriptions()],
      this.activeFrame()
    );
  }

  // -------------------------------------------------------------------------
  // Events / profiler
  // -------------------------------------------------------------------------

  // Constructs the tree that represents the currently recorded events to see them as a tree
  // instead of a temporally accurate list
  buildEventsTree() {
    let tree = [];
    for (const event of this.events()) {
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
    this.eventsTree.set(proxy(tree));
  }

  // Expand/fold the event tree node based on toggle
  toggleEventAndChildren(event, toggle) {
    if (toggle) {
      expandNodes(event);
    } else {
      foldNodes(event);
    }
  }

  collapseAll() {
    for (let event of this.eventsTree()) {
      event.toggled = false;
    }
  }

  // Toggle the recording of events in the page
  async toggleRecording() {
    this.activeRecorder.set(
      await evalFunctionInWindow(
        "toggleEventsRecording",
        [!this.activeRecorder(), this.events().length],
        this.activeFrame()
      )
    );
  }

  // Reset all events data
  clearEventsConsole() {
    this.events.set(proxy([]));
    this.eventsTree.set(proxy([]));
    evalFunctionInWindow("resetEvents", [], this.activeFrame());
  }

  // Handle and store a batch of events coming from the page
  _loadEvents(events) {
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
      event.isLast = false;
      // Logic to retrace the origin of the event if it is not a root render event
      if (!event.type.includes("render")) {
        const evts = this.events();
        for (let i = evts.length - 1; i >= 0; i--) {
          if (!evts[i].origin && event.path.join("/").includes(evts[i].path.join("/"))) {
            event.origin = toRaw(evts[i]);
            break;
          }
          if (
            evts[i].origin &&
            event.path.join("/").includes(evts[i].origin.path.join("/"))
          ) {
            event.origin = toRaw(evts[i].origin);
            break;
          }
        }
      }
      // Add the event to the events tree immediately when the events view is in tree mode
      if (this.eventsTreeView()) {
        let eventNode = Object.assign({}, event);
        eventNode.children = [];
        eventNode.toggled = true;
        if (!eventNode.origin) {
          eventNode.depth = 0;
          this.eventsTree().push(eventNode);
        } else {
          const tree = this.eventsTree();
          for (let i = tree.length - 1; i >= 0; i--) {
            if (eventNode.origin.path.join("/") === tree[i].path.join("/")) {
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
      // Make sure we add the event while keeping the whole list ordered by id
      this._addEventSorted(event);
    }
    const evts = this.events();
    evts[evts.length - 1].isLast = true;
  }

  // A binary search algorithm to efficiently add an event in the events array while keeping it sorted
  _addEventSorted(item) {
    const evts = this.events();
    let low = 0;
    let high = evts.length;
    while (low < high) {
      let mid = Math.floor((low + high) / 2);
      if (evts[mid].id < item.id) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    evts.splice(low, 0, item);
  }

  // -------------------------------------------------------------------------
  // Inspect / debug
  // -------------------------------------------------------------------------

  // Triggers manually the rendering of the selected component
  refreshComponent(path = this.activeComponent().path) {
    evalFunctionInWindow("refreshComponent", [path], this.activeFrame());
  }

  // Allows to log any object in the console, defaults to the active component (or app)
  logObjectInConsole(path) {
    if (!path) {
      if (this.activeComponent().path.length > 1) {
        path = [...this.activeComponent().path, { type: "item", value: "component" }];
      } else {
        path = this.activeComponent().path;
      }
    }
    evalFunctionInWindow("sendObjectToConsole", [path], this.activeFrame());
  }

  // Inspect the source code of the object given by its path
  async inspectFunctionSource(path) {
    await evalFunctionInWindow("inspectFunctionSource", [path], this.activeFrame());
    if (IS_FIREFOX) {
      await evalInWindow("inspect(window.$temp);", this.activeFrame());
    }
  }

  // Inspect the given component's data based on the given type
  async inspectComponent(type, path = this.activeComponent().path) {
    switch (type) {
      case "DOM":
        await evalFunctionInWindow("inspectComponentDOM", [path], this.activeFrame());
        break;
      case "source":
        if (path.length > 1) {
          await evalFunctionInWindow(
            "inspectFunctionSource",
            [[...path, { type: "item", value: "component" }, { type: "item", value: "constructor" }]],
            this.activeFrame()
          );
        } else {
          await evalFunctionInWindow(
            "inspectFunctionSource",
            [[...path, { type: "item", value: "constructor" }]],
            this.activeFrame()
          );
        }
        break;
      case "compiled template":
        await evalFunctionInWindow("inspectComponentCompiledTemplate", [path], this.activeFrame());
        break;
      case "raw template":
        await evalFunctionInWindow("inspectComponentRawTemplate", [path], this.activeFrame());
        break;
    }
    if (IS_FIREFOX && type !== "raw template") {
      await evalInWindow("inspect(window.$temp);", this.activeFrame());
    }
  }

  async injectBreakpoint(hook, path, instanceOnly = false, condition = "1") {
    path = [...path];
    await evalFunctionInWindow(
      "injectBreakpoint",
      [hook, path, instanceOnly, condition],
      this.activeFrame()
    );
    await this.loadComponentsTree(true);
  }

  async removeBreakpoints() {
    await evalFunctionInWindow("removeBreakpoints", [], this.activeFrame());
    await this.loadComponentsTree(true);
  }

  async observeVariable(path) {
    this.observedVariables().push({ path: [...path], visible: false });
    const result = await evalFunctionInWindow(
      "getObservedVariables",
      [[...this.observedVariables()]],
      this.activeFrame()
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

  // -------------------------------------------------------------------------
  // Settings / UI
  // -------------------------------------------------------------------------

  // Toggle dark mode in the extension and store result in the storage
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

  // Refresh the whole extension
  async refreshExtension() {
    await loadScripts();
    await this._resetData();
  }

  // Reset all the relevant data about the page currently stored
  async _resetData() {
    await this._loadSettings();
    this.loadComponentsTree(false);
    this.events.set(proxy([]));
    this.eventsTree.set(proxy([]));
    this.activeRecorder.set(false);
    evalFunctionInWindow("toggleEventsRecording", [false, 0]);
    this.traceRenderings.set(false);
    evalFunctionInWindow("toggleTracing", [false]);
    this.traceSubscriptions.set(false);
    evalFunctionInWindow("toggleSubscriptionTracing", [false]);
    this.updateIFrameList();
  }

  // -------------------------------------------------------------------------
  // Initialization (private)
  // -------------------------------------------------------------------------

  async _init() {
    this.devtoolsId.set(await getTabURL());

    evalFunctionInWindow("initDevtools", []);

    await this._loadSettings();

    // We want to load the base components tree when the devtools tab is first opened
    this.loadComponentsTree(false);
    // We also want to detect the different iframes at first loading of the devtools tab
    this.updateIFrameList();

    // Global listeners to close the currently shown context menu when the user clicks or opens another
    document.addEventListener("click", () => this.contextMenu.set(null), { capture: true });
    document.addEventListener("contextmenu", () => this.contextMenu.set(null), { capture: true });
    window.addEventListener("blur", () => this.contextMenu.set(null), { capture: true });

    // Make sure the events recorder is at its initial state in every frame
    for (const frame of this.frameUrls()) {
      evalFunctionInWindow("toggleEventsRecording", [false, 0], frame);
    }

    browserInstance.runtime.sendMessage({ type: "newDevtoolsPanel", id: this.devtoolsId() });

    // Heartbeat message to test whether the extension context is still valid or not
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
          [[...this.observedVariables()]],
          this.activeFrame()
        );
        this.observedVariables.set(proxy(result));
      }
    }, 200);
  }

  // Connect to the port to communicate to the background script
  _setupPortListener() {
    let rootRendersTimeout = false;
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
            this.loadComponentsTree(true);
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
            this.renderPaths().add(JSON.stringify(msg.data));
            clearTimeout(rootRendersTimeout);
            rootRendersTimeout = setTimeout(() => {
              this.renderPaths().clear();
            }, 100);
            this.loadComponentsTree(true);
          }
          // Select the component based on the path received with the SelectElement message
          if (msg.type === "SelectElement") {
            if (!(Array.isArray(msg.data) && msg.data.every((val) => typeof val === "string"))) {
              return;
            }
            this.selectComponent(msg.data);
          }
          // Stop the DOM element selector tool upon receiving the StopSelector message
          if (msg.type === "StopSelector") {
            this.activeSelector.set(false);
          }
          // Logic for recording an event when the event message is received
          if (msg.type === "Event") {
            this._loadEvents(msg.data);
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

  // Load all settings from the chrome sync storage
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
      this.observedVariables.set(proxy(vars));
    }
  }
}

// -------------------------------------------------------------------------
// Standalone helper functions
// -------------------------------------------------------------------------

// Deselect component and remove highlight on all children
function deselectComponent(component) {
  component.selected = false;
  component.highlighted = false;
  for (const child of component.children) {
    deselectComponent(child);
  }
}

// Apply highlight recursively to all children of a selected component
function highlightChildren(component) {
  component.children.forEach((child) => {
    child.highlighted = true;
    highlightChildren(child);
  });
}

// Expand the node given in entry and all of its children
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

// Fold the node given in entry and all of its children
function foldNodes(node) {
  node.toggled = false;
  for (const child of node.children) {
    foldNodes(child);
  }
}

// This function transforms the env part of the details such that all env keys are not
// greyed out in the UI at their first occurence
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

// Used to check if the given object has the right shape
function isObjectWithShape(obj, shape) {
  if (typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(shape).every(
    (key) => obj.hasOwnProperty(key) && typeof obj[key] === shape[key]
  );
}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  return arr1.every((val, i) => val === arr2[i]);
}

// Load the scripts in the specified frame
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

// General method for executing functions from the loaded scripts in the right frame of the page
// using the __OWL__DEVTOOLS_GLOBAL_HOOK__. Takes the function's args as an array.
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

// This is crappy but it seems like document.execCommand is the only remaining way to
// copy text to clipboard in a devtools extension (even though it is marked as deprecated)
// since navigator.clipboard.writeText has permission issues inside iframes (and the devtools
// panel is mounted inside an iframe)
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
