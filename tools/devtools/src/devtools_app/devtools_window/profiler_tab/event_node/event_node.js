import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component } = owl;

export class EventNode extends Component {
  static template = "devtools.EventNode";

  static components = { EventNode };

  setup() {
    this.store = useStore();
  }

  get eventPadding() {
    return this.props.event.depth * 0.8 + 0.3;
  }

  get nodeContextMenuItems() {
    return [
      {
        title: "Expand children",
        show: true,
        action: () => this.store.toggleEventAndChildren(this.props.event, true),
      },
      {
        title: "Fold all children",
        show: true,
        action: () => this.store.toggleEventAndChildren(this.props.event, false),
      },
      {
        title: "Fold direct children",
        show: true,
        action: () => this.store.foldDirectChildren(this.props.event),
      },
    ];
  }

  get componentContextMenuItems() {
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

  openNodeMenu(ev) {
    if (this.props.event.children.length) {
      ev.preventDefault();
      this.store.openContextMenu(ev, this.nodeContextMenuItems);
    }
  }

  openComponentMenu(ev) {
    if (this.props.event.type === "destroy") {
      return;
    } else {
      ev.preventDefault();
      this.store.openContextMenu(ev, this.componentContextMenuItems);
    }
  }

  // Expand/fold the event node
  toggleDisplay() {
    this.props.event.toggled = !this.props.event.toggled;
  }

  // Formatting for displaying the key of the component
  get minimizedKey() {
    return minimizeKey(this.props.event.key);
  }

  get renderTime() {
    if (Number.isInteger(this.props.event.time)) {
      if (this.props.event.time === 0) {
        return "<1";
      } else {
        return this.props.event.time;
      }
    } else {
      if (this.props.event.time < 1.0) {
        return "<1";
      } else {
        return this.props.event.time.toFixed(1);
      }
    }
  }
}
