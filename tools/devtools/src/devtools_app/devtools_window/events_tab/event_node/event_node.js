import { evalInWindow } from "../../../../utils";
import { useStore } from "../../../store/store";

const { Component, useState, onMounted } = owl;

export class EventNode extends Component {
  static template = "devtools.EventNode";

  static components = { EventNode };

  setup() {
    this.store = useStore();
  }

  // Focus on the component related to the event in the components tab
  goToComponent() {
    this.store.selectComponent(this.props.path);
    this.store.switchTab("ComponentsTab");
  }

  // Expand/fold the event node
  toggleDisplay() {
    let event = this.store.findEventInTree(this.props);
    event.toggled = !event.toggled;
  }

  // Trigger the highlight on the component in the page when its name is hovered
  hoverComponent() {
    evalInWindow("highlightComponent", [JSON.stringify(this.props.path)], this.store.activeFrame);
  }

  // Formatting for displaying the key of the component
  get minimizedKey() {
    if (!this.props.key) {
      return "";
    }
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2) {
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
    } else {
      key = "";
    }
    return key;
  }

  // Display the custom context menu to access the expandAll and foldAll methods
  openMenu(event) {
    const menu = document.getElementById("customMenu/" + this.props.id);
    menu.classList.remove("hidden");
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    let x = event.clientX;
    let y = event.clientY;
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight;
    }
    menu.style.left = x + "px";
    // Need 25px offset because of the main navbar from the browser devtools
    menu.style.top = y - 25 + "px";
  }

  expandAllChildren(ev) {
    this.store.toggleEventAndChildren(this.props, true);
  }

  foldAllChildren(ev) {
    this.store.toggleEventAndChildren(this.props, false);
  }
}
