const { Component } = owl;
import { useStore } from "../../../store/store";
import { ObjectTreeElement } from "./object_tree_element/object_tree_element";

export class DetailsWindow extends Component {
  static template = "devtools.DetailsWindow";
  static components = { ObjectTreeElement };
  setup() {
    this.store = useStore();
  }

  get contextMenuItems() {
    return [
      {
        title: "Inspect source code",
        show: true,
        action: () => this.store.inspectComponent("source", this.store.activeComponent.path),
      },
      {
        title: "Store as global variable",
        show: this.store.activeComponent.path.length !== 1,
        action: () =>
          this.store.logObjectInConsole([
            ...this.store.activeComponent.path,
            { type: "item", value: "component" },
          ]),
      },
      {
        title: "Inspect in Elements tab",
        show: this.store.activeComponent.path.length !== 1,
        action: () => this.store.inspectComponent("DOM", this.store.activeComponent.path),
      },
      {
        title: "Force rerender",
        show: this.store.activeComponent.path.length !== 1,
        action: () => this.store.refreshComponent(this.store.activeComponent.path),
      },
      {
        title: "Store observed states as global variable",
        show: this.store.activeComponent.path.length !== 1,
        action: () =>
          this.store.logObjectInConsole([
            ...this.store.activeComponent.path,
            { type: "item", value: "subscriptions" },
          ]),
      },
      {
        title: "Inspect compiled template",
        show: this.store.activeComponent.path.length !== 1,
        action: () =>
          this.store.inspectComponent("compiled template", this.store.activeComponent.path),
      },
      {
        title: "Log raw template",
        show: this.store.activeComponent.path.length !== 1,
        action: () => this.store.inspectComponent("raw template", this.store.activeComponent.path),
      },
      {
        title: "Store as global variable",
        show: this.store.activeComponent.path.length === 1,
        action: () => this.store.logObjectInConsole([...this.store.activeComponent.path]),
      },
    ];
  }

  openMenu(ev) {
    this.store.openContextMenu(ev, this.contextMenuItems);
  }

  toggleCategory(ev, category) {
    this.store.activeComponent[category].toggled = !this.store.activeComponent[category].toggled;
  }
}
