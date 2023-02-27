const { Component, onMounted, onWillUnmount, useExternalListener } = owl;
import { ComponentsTab } from "./components_tab/components_tab";
import { Tab } from "./tab/tab";
import { EventsTab } from "./events_tab/events_tab";
import { useStore } from "../store/store";
import { evalInWindow } from "../../utils";

export class DevtoolsWindow extends Component {
  static props = [];
  static template = "devtools.DevtoolsWindow";
  static components = { ComponentsTab, Tab, EventsTab };
  setup() {
    this.store = useStore();
    // Make sure that all custom context menus will be closed as soon as the user clicks on anything in the panel
    useExternalListener(document, "click", this.hideContextMenus, { capture: true });
    useExternalListener(document, "contextmenu", this.hideContextMenus, { capture: true });
  }

  // Remove the highlight on the DOM element correponding to the component
  removeHighlight() {
    evalInWindow("removeHighlights", [], this.store.activeFrame);
  }

  // Hide all context menus on the page
  hideContextMenus = () => {
    const customMenus = document.querySelectorAll(".custom-menu");
    customMenus.forEach((menu) => menu.classList.add("d-none"));
  };

  selectFrame(ev) {
    const val = ev.target.value;
    this.store.selectFrame(val);
  }
}
