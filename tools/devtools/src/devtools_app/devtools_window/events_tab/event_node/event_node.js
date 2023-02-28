import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useRef } = owl;

export class EventNode extends Component {
  static template = "devtools.EventNode";

  static components = { EventNode };

  setup() {
    this.store = useStore();
    this.contextMenu = useRef("contextmenu");
  }

  get eventPadding() {
    return this.props.depth * 0.8 + 0.3;
  }

  // Expand/fold the event node
  toggleDisplay() {
    let event = this.store.findEventInTree(this.props);
    event.toggled = !event.toggled;
  }

  // Formatting for displaying the key of the component
  get minimizedKey() {
    return minimizeKey(this.props.key);
  }

  get renderTime() {
    if (Number.isInteger(this.props.time)) {
      if (this.props.time === 0) {
        return "<1";
      } else {
        return this.props.time;
      }
    } else {
      if (this.props.time < 1.0) {
        return "<1";
      } else {
        return this.props.time.toFixed(1);
      }
    }
  }
}
