import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component } = owl;

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

  get renderTime() {
    if(Number.isInteger(this.props.time)){
      return this.props.time;
    } else {
      if(this.props.time < 1.0){
        return "<1"
      } else {
        return this.props.time.toFixed(1);
      }
    }
  }
}
