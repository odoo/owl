import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useState, onMounted } = owl;

export class Event extends Component {
  static template = "devtools.Event";

  setup() {
    this.store = useStore();
  }

  // Expand/fold the event
  toggleDisplay() {
    if (this.props.origin) {
      this.store.events[this.props.id].toggled = !this.store.events[this.props.id].toggled;
    }
  }

  // Formatting for displaying the key of the component
  get minimizedKey() {
    return minimizeKey(this.props.key);
  }

  // Same for the origin component
  get originMinimizedKey() {
    return minimizeKey(this.props.origin.key);
  }
}
