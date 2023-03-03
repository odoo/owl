const { Component } = owl;
import { ComponentsTab } from "./components_tab/components_tab";
import { Tab } from "./tab/tab";
import { EventsTab } from "./events_tab/events_tab";
import { useStore } from "../store/store";

export class DevtoolsWindow extends Component {
  static props = [];
  static template = "devtools.DevtoolsWindow";
  static components = { ComponentsTab, Tab, EventsTab };
  setup() {
    this.store = useStore();
  }

  selectFrame(ev) {
    const val = ev.target.value;
    this.store.selectFrame(val);
  }
}
