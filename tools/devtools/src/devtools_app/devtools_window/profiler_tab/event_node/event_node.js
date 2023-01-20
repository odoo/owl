import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useRef, useEffect } = owl;

export class EventNode extends Component {
  static template = "devtools.EventNode";

  static components = { EventNode };

  setup() {
    this.store = useStore();
    this.nodeContextMenu = useRef("nodeContextMenu");
    this.nodeContextMenuId = this.store.contextMenu.id++;
    this.componentContextMenu = useRef("componentContextmenu");
    this.componentContextMenuId = this.store.contextMenu.id++;
    this.contextMenuEvent,
      useEffect(
        (menuId) => {
          if (menuId === this.nodeContextMenuId) {
            this.store.contextMenu.open(this.contextMenuEvent, this.nodeContextMenu.el);
          }
          if (menuId === this.componentContextMenuId) {
            this.store.contextMenu.open(this.contextMenuEvent, this.componentContextMenu.el);
          }
        },
        () => [this.store.contextMenu.activeMenu]
      );
  }

  get eventPadding() {
    return this.props.event.depth * 0.8 + 0.3;
  }

  openNodeMenu(ev) {
    if (this.props.event.children.length) {
      ev.preventDefault();
      this.contextMenuEvent = ev;
      this.store.contextMenu.activeMenu = this.nodeContextMenuId;
    }
  }

  openComponentMenu(ev) {
    if (this.props.event.type === "destroy") {
      return;
    } else {
      ev.preventDefault();
      this.contextMenuEvent = ev;
      this.store.contextMenu.activeMenu = this.componentContextMenuId;
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
