const { Component, plugin } = owl;
import { StorePlugin } from "../../../store/store";
import { ComponentsPlugin } from "../../../store/components_plugin";
import { ObjectTreeElement } from "./object_tree_element/object_tree_element";

export class DetailsWindow extends Component {
  static template = "devtools.DetailsWindow";
  static components = { ObjectTreeElement };
  setup() {
    this.store = plugin(StorePlugin);
    this.components = plugin(ComponentsPlugin);
  }

  get contextMenuItems() {
    return [
      {
        title: "Inspect source code",
        show: true,
        action: () => this.components.inspectComponent("source", this.components.activeComponent().path),
      },
      {
        title: "Store as global variable",
        show: this.components.activeComponent().path.length !== 1,
        action: () =>
          this.components.logObjectInConsole([
            ...this.components.activeComponent().path,
            { type: "item", value: "component" },
          ]),
      },
      {
        title: "Inspect in Elements tab",
        show: this.components.activeComponent().path.length !== 1,
        action: () => this.components.inspectComponent("DOM", this.components.activeComponent().path),
      },
      {
        title: "Force rerender",
        show: this.components.activeComponent().path.length !== 1,
        action: () => this.components.refreshComponent(this.components.activeComponent().path),
      },
      {
        title: "Store observed states as global variable",
        show: this.components.activeComponent().path.length !== 1,
        action: () =>
          this.components.logObjectInConsole([
            ...this.components.activeComponent().path,
            { type: "item", value: "subscriptions" },
          ]),
      },
      {
        title: "Inspect compiled template",
        show: this.components.activeComponent().path.length !== 1,
        action: () =>
          this.components.inspectComponent("compiled template", this.components.activeComponent().path),
      },
      {
        title: "Log raw template",
        show: this.components.activeComponent().path.length !== 1,
        action: () => this.components.inspectComponent("raw template", this.components.activeComponent().path),
      },
      {
        title: "Store as global variable",
        show: this.components.activeComponent().path.length === 1,
        action: () => this.components.logObjectInConsole([...this.components.activeComponent().path]),
      },
    ];
  }

  openMenu(ev) {
    this.store.openContextMenu(ev, this.contextMenuItems);
  }

  toggleCategory(ev, category) {
    this.components.activeComponent()[category].toggled = !this.components.activeComponent()[category].toggled;
  }
}
