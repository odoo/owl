const { Component, markup, useState, onMounted, onWillUpdateProps } = owl;
import { useStore } from "../../../../store/store";
import { ObjectTreeElement } from "../object_tree_element/object_tree_element";

export class Subscriptions extends Component {
  static template = "devtools.Subscriptions";

  static components = { ObjectTreeElement };

  setup() {
    this.store = useStore();
  }

  keysContent(index) {
    const keys = this.store.activeComponent.subscriptions[index].keys;
    let content = JSON.stringify(keys);
    const maxLength = 50;
    content = content.replace(/,/g, ", ");
    if (content.length > maxLength) {
      content = content.slice(0, content.lastIndexOf(",", maxLength - 5)) + ", ...]";
    }
    return content;
  }

  expandKeys(event, index) {
    this.store.activeComponent.subscriptions[index].keysExpanded =
      !this.store.activeComponent.subscriptions[index].keysExpanded;
  }
}
