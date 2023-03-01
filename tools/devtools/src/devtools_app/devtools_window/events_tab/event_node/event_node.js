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
        if(menuId === this.nodeContextMenuId){
          this.store.contextMenu.open(this.contextMenuEvent, this.nodeContextMenu.el)
        }
        if(menuId === this.componentContextMenuId){
          this.store.contextMenu.open(this.contextMenuEvent, this.componentContextMenu.el)
        }
      },
      () => [this.store.contextMenu.activeMenu]
    );
  }

  get eventPadding() {
    return this.props.depth * 0.8 + 0.3;
  }

  openNodeMenu(ev){
    console.log("openNodeMenu");
    if(this.props.children.length){
      ev.preventDefault();
      this.contextMenuEvent = ev;
      this.store.contextMenu.activeMenu = this.nodeContextMenuId;
    }
  }

  openComponentMenu(ev){
    console.log("openComponentMenu");
    if(this.props.type === "destroy"){
      return;
    } else {
      ev.preventDefault();
      this.contextMenuEvent = ev;
      this.store.contextMenu.activeMenu = this.componentContextMenuId;
    }
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
