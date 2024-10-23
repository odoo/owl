import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component } = owl;

export class Event extends Component {
  static template = "devtools.Event";

  setup() {
    this.store = useStore();
  }

  // Formatting for displaying the key of the component
  get minimizedKey() {
    return minimizeKey(this.props.event.key);
  }

  // Same for the origin component
  get originMinimizedKey() {
    return minimizeKey(this.props.event.origin.key);
  }

  get renderTime() {
    if (Number.isInteger(this.props.event.time)) {
      if (this.props.event.time === 0) {
        return "<1";
      } else {
        return this.props.event.time;
      }
    } else {
      if (this.props.event.time < 0.1) {
        return "<0.1";
      } else {
        return this.props.event.time.toFixed(1);
      }
    }
  }

  // Expand/fold the event
  toggleDisplay() {
    if (this.props.event.origin) {
      this.props.event.toggled = !this.props.event.toggled;
    }
  }

  get contextMenuItems() {
    return [
      {
        title: "Inspect source code",
        show: true,
        action: () => this.store.inspectComponent("source", this.props.event.path),
      },
      {
        title: "Store as global variable",
        show: this.props.event.path.length !== 1,
        action: () =>
          this.store.logObjectInConsole([
            ...this.props.event.path,
            { type: "item", value: "component" },
          ]),
      },
      {
        title: "Inspect in Elements tab",
        show: this.props.event.path.length !== 1,
        action: () => this.store.inspectComponent("DOM", this.props.event.path),
      },
      {
        title: "Force rerender",
        show: this.props.event.path.length !== 1,
        action: () => this.store.refreshComponent(this.props.event.path),
      },
      {
        title: "Store observed states as global variable",
        show: this.props.event.path.length !== 1,
        action: () =>
          this.store.logObjectInConsole([
            ...this.props.event.path,
            { type: "item", value: "subscriptions" },
          ]),
      },
      {
        title: "Inspect compiled template",
        show: this.props.event.path.length !== 1,
        action: () => this.store.inspectComponent("compiled template", this.props.event.path),
      },
      {
        title: "Log raw template",
        show: this.props.event.path.length !== 1,
        action: () => this.store.inspectComponent("raw template", this.props.event.path),
      },
      {
        title: "Store as global variable",
        show: this.props.event.path.length === 1,
        action: () => this.store.logObjectInConsole([...this.props.event.path]),
      },
    ];
  }

  openMenu(ev) {
    if (this.props.event.type === "destroy") {
      return;
    } else {
      ev.preventDefault();
      this.store.openContextMenu(ev, this.contextMenuItems);
    }
  }
}
