const { Component } = owl;
import { ContextMenu } from "../context_menu/context_menu";
import { useStore } from "../store/store";
import { ComponentsTab } from "./components_tab/components_tab";
import { ProfilerTab } from "./profiler_tab/profiler_tab";
import { Tab } from "./tab/tab";

export class DevtoolsWindow extends Component {
  static props = [];
  static template = "devtools.DevtoolsWindow";
  static components = { ComponentsTab, Tab, ProfilerTab, ContextMenu };
  setup() {
    this.store = useStore();
  }

  selectFrame(ev) {
    const val = ev.target.value;
    this.store.selectFrame(val);
  }
}
