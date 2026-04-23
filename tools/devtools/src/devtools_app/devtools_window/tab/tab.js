/** @odoo-module **/

import { useStore } from "../../store/store";

const { Component } = owl;
const getProps = owl.props;

export class Tab extends Component {
  props = getProps();

  static template = "devtools.Tab";

  setup() {
    this.store = useStore();
  }

  get active() {
    return this.props.tabName === this.store.page;
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
