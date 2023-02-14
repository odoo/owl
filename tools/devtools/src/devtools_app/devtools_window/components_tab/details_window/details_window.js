const { Component, onRendered, onWillStart } = owl;
import { evalInWindow } from "../../../../utils";
import { useStore } from "../../../store/store";
import { ObjectTreeElement } from "./object_tree_element/object_tree_element";
import { Subscriptions } from "./subscriptions/subscriptions";

export class DetailsWindow extends Component {
  static template = "devtools.DetailsWindow";

  static components = { ObjectTreeElement, Subscriptions };

  setup() {
    this.store = useStore();
  }

  refreshComponent() {
    this.store.refreshComponent();
  }

  logComponentInConsole(type) {
    evalInWindow(
      "sendObjectToConsole",
      [JSON.stringify(this.store.activeComponent.path), '"' + type + '"'],
      this.store.activeFrame
    );
  }

  inspectComponentInDOM() {
    evalInWindow(
      "inspectComponentDOM",
      [JSON.stringify(this.store.activeComponent.path)],
      this.store.activeFrame
    );
  }

  inspectComponentSource() {
    evalInWindow(
      "inspectComponentSource",
      [JSON.stringify(this.store.activeComponent.path)],
      this.store.activeFrame
    );
  }

  inspectCompiledTemplate() {
    evalInWindow(
      "inspectComponentCompiledTemplate",
      [JSON.stringify(this.store.activeComponent.path)],
      this.store.activeFrame
    );
  }

  inspectRAwTemplate() {
    evalInWindow(
      "inspectComponentRawTemplate",
      [JSON.stringify(this.store.activeComponent.path)],
      this.store.activeFrame
    );
  }
}
