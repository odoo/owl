const { Component } = owl;
import { useStore } from "../../../store/store";
import { ObjectTreeElement } from "./object_tree_element/object_tree_element";
import { Subscriptions } from "./subscriptions/subscriptions";

export class DetailsWindow extends Component {
  static template = "devtools.DetailsWindow";

  static components = { ObjectTreeElement, Subscriptions };

  setup() {
    this.store = useStore();
  }
}
