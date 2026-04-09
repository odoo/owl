/** @odoo-module **/

import { isElementInCenterViewport, minimizeKey, browserInstance } from "../../../../utils";
import { StorePlugin } from "../../../store/store";
import { HighlightText } from "./highlight_text/highlight_text";

const { Component, signal, proxy, useEffect, onMounted, plugin, props, types: t } = owl;

export class TreeElement extends Component {
  static template = "devtools.TreeElement";
  static components = { TreeElement, HighlightText };

  props = props({ component: t.object() });

  setup() {
    this.state = proxy({
      searched: false,
    });
    this.store = plugin(StorePlugin);
    this.element = signal(null);
    this.stringifiedPath = JSON.stringify(this.props.component.path);
    // Scroll to the selected element when it changes
    onMounted(() => {
      if (this.props.component.selected) {
        this.element()?.scrollIntoView({ block: "center", behavior: "auto" });
      }
    });
    useEffect(() => {
      const selected = this.props.component.selected;
      const el = this.element();
      if (selected && el) {
        if (!isElementInCenterViewport(el)) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      if (el) {
        this.store.selectedElement.set(el);
      }
    });
    // Effect to apply a short highlight effect to the component when it is rendered
    useEffect(() => {
      if (this.store.renderPaths.has(this.stringifiedPath)) {
        if (this.blockHighlight) {
          return;
        }
        const treeElement = this.element();
        if (treeElement) {
          this.blockHighlight = true;
          treeElement.classList.add("render-highlight");
          setTimeout(() => {
            treeElement.classList.add("highlight-fade");
            treeElement.classList.remove("render-highlight");
            setTimeout(() => {
              treeElement.classList.remove("highlight-fade");
              this.blockHighlight = false;
            }, 500);
          }, 50);
        }
      }
    });
    // Used to know when the component is in the search bar results
    useEffect(() => {
      const searchResults = this.store.searchResults();
      if (searchResults.includes(this.props.component.path)) {
        this.state.searched = true;
      } else {
        this.state.searched = false;
      }
    });
  }

  get componentPadding() {
    return this.props.component.depth * 0.8;
  }

  get minimizedKey() {
    return minimizeKey(this.props.component.key);
  }

  get contextMenuItems() {
    return [
      {
        title: "Expand children",
        show: true,
        action: () => this.store.toggleComponentAndChildren(this.props.component, true),
      },
      {
        title: "Fold all children",
        show: true,
        action: () => this.store.toggleComponentAndChildren(this.props.component, false),
      },
      {
        title: "Fold direct children",
        show: true,
        action: () => this.store.foldDirectChildren(this.props.component),
      },
      {
        title: "Inspect source code",
        show: true,
        action: () => this.store.inspectComponent("source", this.props.component.path),
      },
      {
        title: "Store as global variable",
        show: this.props.component.path.length !== 1,
        action: () =>
          this.store.logObjectInConsole([
            ...this.props.component.path,
            { type: "item", value: "component" },
          ]),
      },
      {
        title: "Inspect in Elements tab",
        show: this.props.component.path.length !== 1,
        action: () => this.store.inspectComponent("DOM", this.props.component.path),
      },
      {
        title: "Force rerender",
        show: this.props.component.path.length !== 1,
        action: () => this.store.refreshComponent(this.props.component.path),
      },
      {
        title: "Store observed states as global variable",
        show: this.props.component.path.length !== 1,
        action: () =>
          this.store.logObjectInConsole([
            ...this.props.component.path,
            { type: "item", value: "subscriptions" },
          ]),
      },
      {
        title: "Inspect compiled template",
        show: this.props.component.path.length !== 1,
        action: () => this.store.inspectComponent("compiled template", this.props.component.path),
      },
      {
        title: "Log raw template",
        show: this.props.component.path.length !== 1,
        action: () => this.store.inspectComponent("raw template", this.props.component.path),
      },
      {
        title: "Store as global variable",
        show: this.props.component.path.length === 1,
        action: () => this.store.logObjectInConsole([...this.props.component.path]),
      },
      {
        title: "Don't fold component by default",
        show: this.store.componentsToggleBlacklist().has(this.props.component.name),
        action: () => this.toggleComponentToBlacklist(),
      },
      {
        title: "Fold component by default",
        show: !this.store.componentsToggleBlacklist().has(this.props.component.name),
        action: () => this.toggleComponentToBlacklist(),
      },
    ];
  }

  openMenu(ev) {
    this.store.openContextMenu(ev, this.contextMenuItems);
  }

  // Expand/fold the component node
  toggleDisplay() {
    this.props.component.toggled = !this.props.component.toggled;
  }

  // Used to select the component node
  toggleComponent() {
    if (this.store.toggleOnSelected()) {
      this.toggleDisplay();
    }
    if (!this.props.component.selected) {
      this.store.selectComponent(this.props.component.path);
    }
  }

  // Adds the component name to the components toggle blacklist if not already present
  // Else, remove it from the blacklist
  toggleComponentToBlacklist() {
    if (this.store.componentsToggleBlacklist().has(this.props.component.name)) {
      if (!this.props.component.toggled) {
        this.props.component.toggled = !this.props.component.toggled;
      }
      this.store.componentsToggleBlacklist().delete(this.props.component.name);
      browserInstance.storage.local.set({
        owlDevtoolsComponentsToggleBlacklist: Array.from(
          this.store.componentsToggleBlacklist()
        ),
      });
    } else {
      if (this.props.component.toggled) {
        this.props.component.toggled = !this.props.component.toggled;
      }
      this.store.componentsToggleBlacklist().add(this.props.component.name);
      browserInstance.storage.local.set({
        owlDevtoolsComponentsToggleBlacklist: Array.from(
          this.store.componentsToggleBlacklist()
        ),
      });
    }
  }
}
