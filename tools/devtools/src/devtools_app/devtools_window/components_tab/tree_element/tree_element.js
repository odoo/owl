/** @odoo-module **/

import { isElementInCenterViewport, minimizeKey, browserInstance } from "../../../../utils";
import { useStore } from "../../../store/store";
import { HighlightText } from "./highlight_text/highlight_text";

const { Component, useRef, useState, useEffect, onMounted } = owl;

export class TreeElement extends Component {
  static template = "devtools.TreeElement";

  static components = { TreeElement, HighlightText };

  setup() {
    this.state = useState({
      searched: false,
    });
    this.store = useStore();
    this.element = useRef("element");
    this.stringifiedPath = JSON.stringify(this.props.component.path);
    // Scroll to the selected element when it changes
    onMounted(() => {
      if (this.props.component.selected) {
        this.element.el.scrollIntoView({ block: "center", behavior: "auto" });
      }
    });
    useEffect(
      (selected) => {
        if (selected) {
          if (!isElementInCenterViewport(this.element.el)) {
            this.element.el.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
        this.store.selectedElement = this.element.el;
      },
      () => [this.props.component.selected]
    );
    // Effect to apply a short highlight effect to the component when it is rendered
    useEffect(
      () => {
        if (this.store.renderPaths.has(this.stringifiedPath)) {
          const treeElement = this.element.el;
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
      },
      () => [this.store.renderPaths.size]
    );
    // Used to know when the component is in the search bar results
    useEffect(
      (searchResults) => {
        if (searchResults.includes(this.props.component.path)) {
          this.state.searched = true;
        } else {
          this.state.searched = false;
        }
      },
      () => [this.store.componentSearch.searchResults]
    );
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
        show: this.store.settings.componentsToggleBlacklist.has(this.props.component.name),
        action: () => this.toggleComponentToBlacklist(),
      },
      {
        title: "Fold component by default",
        show: !this.store.settings.componentsToggleBlacklist.has(this.props.component.name),
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
    if (this.store.settings.toggleOnSelected) {
      this.toggleDisplay();
    }
    if (!this.props.component.selected) {
      this.store.selectComponent(this.props.component.path);
    }
  }

  // Adds the component name to the components toggle blacklist if not already present
  // Else, remove it from the blacklist
  toggleComponentToBlacklist() {
    if (this.store.settings.componentsToggleBlacklist.has(this.props.component.name)) {
      if (!this.props.component.toggled) {
        this.props.component.toggled = !this.props.component.toggled;
      }
      this.store.settings.componentsToggleBlacklist.delete(this.props.component.name);
      browserInstance.storage.local.set({
        owlDevtoolsComponentsToggleBlacklist: Array.from(
          this.store.settings.componentsToggleBlacklist
        ),
      });
    } else {
      if (this.props.component.toggled) {
        this.props.component.toggled = !this.props.component.toggled;
      }
      this.store.settings.componentsToggleBlacklist.add(this.props.component.name);
      browserInstance.storage.local.set({
        owlDevtoolsComponentsToggleBlacklist: Array.from(
          this.store.settings.componentsToggleBlacklist
        ),
      });
    }
  }
}
