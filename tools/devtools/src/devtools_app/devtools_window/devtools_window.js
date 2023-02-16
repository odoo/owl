const { Component, onMounted, onWillUnmount } = owl;
import { ComponentsTab } from "./components_tab/components_tab";
import { Tab } from "./tab/tab";
import { EventsTab } from "./events_tab/events_tab";
import { FrameSelector } from "./frame_selector/frame_selector";
import { useStore } from "../store/store";
import { evalInWindow } from "../../utils";

export class DevtoolsWindow extends Component {
  static props = [];

  static template = "devtools.DevtoolsWindow";

  static components = { ComponentsTab, Tab, EventsTab, FrameSelector };

  setup() {
    this.store = useStore();
    // Make sure that all custom context menus will be closed as soon as the user clicks on anything in the panel
    onMounted(async () => {
      document.addEventListener("click", this.hideContextMenus, true);
    });
    onWillUnmount(() => {
      document.removeEventListener("click", this.hideContextMenus, true);
    });
  }

  // Remove the highlight on the DOM element correponding to the component
  removeHighlight() {
    evalInWindow("removeHighlights", [], this.store.activeFrame);
  }

  // Hide all context menus on the page
  hideContextMenus = () => {
    const customMenus = document.querySelectorAll(".custom-menu");
    customMenus.forEach((menu) => menu.classList.add("hidden"));
  };
}
