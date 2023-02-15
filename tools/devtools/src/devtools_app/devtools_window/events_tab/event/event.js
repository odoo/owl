import { evalInWindow } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useState, onMounted } = owl;

export class Event extends Component {
  static template = "devtools.Event";

  setup() {
    this.store = useStore();
  }

  goToComponent() {
    this.store.selectComponent(this.props.path);
    this.store.switchTab("ComponentsTab");
  }

  goToOriginComponent() {
    this.store.selectComponent(this.props.origin.path);
    this.store.switchTab("ComponentsTab");
  }

  toggleDisplay() {
    this.store.events[this.props.id].toggled = !this.store.events[this.props.id].toggled;
  }

  hoverComponent(ev) {
    evalInWindow("highlightComponent", [JSON.stringify(this.props.path)], this.store.activeFrame);
  }

  get minimizedKey() {
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2) {
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
    } else {
      key = "";
    }
    return key;
  }

  get originMinimizedKey() {
    const split = this.props.origin.key.split("__");
    let key;
    if (split.length > 2) {
      key = this.props.origin.key.substring(4 + split[1].length, this.props.origin.key.length);
    } else {
      key = "";
    }
    return key;
  }
}
