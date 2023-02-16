import { evalInWindow } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useState, onMounted } = owl;

export class EventNode extends Component {
  static template = "devtools.EventNode";

  static components = { EventNode };

  setup() {
    this.store = useStore();
  }

  // goToComponent() {
  //   this.store.selectComponent(this.props.path);
  //   this.store.switchTab("ComponentsTab");
  // }

  toggleDisplay() {
    let event = this.store.findEventInTree(this.props);
    event.toggled = !event.toggled;
  }

  hoverComponent() {
    evalInWindow("highlightComponent", [JSON.stringify(this.props.path)], this.store.activeFrame);
  }

  get minimizedKey() {
    if (!this.props.key) return "";
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2) {
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
    } else {
      key = "";
    }
    return key;
  }
}
