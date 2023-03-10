import { minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useEffect, useRef } = owl;

export class Event extends Component {
  static template = "devtools.Event";

  setup() {
    this.store = useStore();
    this.componentContextMenu = useRef("componentContextmenu");
    this.componentContextMenuId = this.store.contextMenu.id++;
    this.contextMenuEvent,
      useEffect(
        (menuId) => {
          if (menuId === this.componentContextMenuId) {
            this.store.contextMenu.open(this.contextMenuEvent, this.componentContextMenu.el);
          }
        },
        () => [this.store.contextMenu.activeMenu]
      );
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

  openComponentMenu(ev) {
    if (this.props.event.type === "destroy") {
      return;
    } else {
      ev.preventDefault();
      this.contextMenuEvent = ev;
      this.store.contextMenu.activeMenu = this.componentContextMenuId;
    }
  }
}
