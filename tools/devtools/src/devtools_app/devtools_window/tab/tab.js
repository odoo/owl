import { StorePlugin } from "../../store/store";

const { Component, usePlugin, useProps, types: t } = owl;

export class Tab extends Component {
  static template = "devtools.Tab";

  props = useProps({ tabName: t.string });

  setup() {
    this.store = usePlugin(StorePlugin);
  }

  get active() {
    return this.props.tabName === this.store.page();
  }

  get name() {
    switch (this.props.tabName) {
      case "ComponentsTab":
        return "Components";
      case "ProfilerTab":
        return "Profiler";
    }
  }

  selectTab(ev) {
    this.store.switchTab(this.props.tabName);
  }
}
