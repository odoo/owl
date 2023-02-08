const { Component, useState } = owl;
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
  }

  // Remove the highlight on the DOM element correponding to the component
  removeHighlight(ev) {
    evalInWindow("removeHighlights", []);
  }
}
