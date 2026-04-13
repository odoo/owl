const { Plugin, signal, proxy, toRaw, plugin } = owl;
import { browserInstance } from "../../utils";
import { StorePlugin, evalFunctionInWindow } from "./store";

// Plugin handling all profiler-tab state and logic: event recording, event tree,
// tracing, and subscription tracing.
export class ProfilerPlugin extends Plugin {
  // --- Profiler state ---
  events = signal(proxy([]));
  eventsTree = signal(proxy([]));
  eventsTreeView = signal(true);
  activeRecorder = signal(false);
  traceRenderings = signal(false);
  traceSubscriptions = signal(false);
  // false when inspecting an OWL 3 page (reactive not exposed → patchReactivity() cannot work)
  subscriptionTracingSupported = signal(true);

  setup() {
    this._store = plugin(StorePlugin);
  }

  // -------------------------------------------------------------------------
  // Events / profiler
  // -------------------------------------------------------------------------

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

  async toggleRecording() {
    this.activeRecorder.set(
      await evalFunctionInWindow(
        "toggleEventsRecording",
        [!this.activeRecorder(), this.events().length],
        this._store.activeFrame()
      )
    );
  }

  clearEventsConsole() {
    this.events.set(proxy([]));
    this.eventsTree.set(proxy([]));
    evalFunctionInWindow("resetEvents", [], this._store.activeFrame());
  }

  _loadEvents(events) {
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
      event.isLast = false;
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
      this._addEventSorted(event);
    }
    const evts = this.events();
    evts[evts.length - 1].isLast = true;
  }

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
  // Tracing
  // -------------------------------------------------------------------------

  async toggleTracing() {
    this.traceRenderings.set(
      await evalFunctionInWindow(
        "toggleTracing",
        [!this.traceRenderings()],
        this._store.activeFrame()
      )
    );
  }

  async refreshSubscriptionTracingSupport(frame) {
    const supported = await evalFunctionInWindow(
      "supportsSubscriptionTracing",
      [],
      frame ?? this._store.activeFrame()
    );
    this.subscriptionTracingSupported.set(supported);
    // If the active frame no longer supports subscription tracing, turn it off.
    if (!supported && this.traceSubscriptions()) {
      this.traceSubscriptions.set(false);
    }
  }

  async toggleSubscriptionTracing() {
    this.traceSubscriptions.set(
      await evalFunctionInWindow(
        "toggleSubscriptionTracing",
        [!this.traceSubscriptions()],
        this._store.activeFrame()
      )
    );
  }
}

// -------------------------------------------------------------------------
// Standalone helper functions
// -------------------------------------------------------------------------

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

function expandNodes(node) {
  node.toggled = true;
  for (const child of node.children) {
    expandNodes(child);
  }
}

function foldNodes(node) {
  node.toggled = false;
  for (const child of node.children) {
    foldNodes(child);
  }
}
