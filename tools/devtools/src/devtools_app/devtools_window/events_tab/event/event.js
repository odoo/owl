import { evalInWindow } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useState, onMounted } = owl;

export class Event extends Component {
  static template = "devtools.Event";

  setup() {
    this.store = useStore();
  }

  // Focus on the component related to the event in the components tab
  goToComponent() {
    this.store.selectComponent(this.props.path);
    this.store.switchTab("ComponentsTab");
  }

  // Focus on the component related to the event's origin in the components tab
  goToOriginComponent() {
    this.store.selectComponent(this.props.origin.path);
    this.store.switchTab("ComponentsTab");
  }

  // Expand/fold the event
  toggleDisplay() {
    console.log(this.store.events);
    if (this.props.origin)
      this.store.events[this.props.id].toggled = !this.store.events[this.props.id].toggled;
  }

  // Trigger the highlight on the component in the page when its name is hovered
  hoverComponent() {
    evalInWindow("highlightComponent", [JSON.stringify(this.props.path)], this.store.activeFrame);
  }

  // Same for the origin component of the event
  hoverOriginComponent() {
    evalInWindow(
      "highlightComponent",
      [JSON.stringify(this.props.origin.path)],
      this.store.activeFrame
    );
  }

  // Formatting for displaying the key of the component
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

  // Same for the origin component
  get originMinimizedKey() {
    if (!this.props.origin.key) return "";
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
