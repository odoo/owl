/** @odoo-module **/

import { useStore } from "../../store/store";

const { Component } = owl;

export class FrameSelector extends Component {
  static template = "devtools.FrameSelector";

  setup() {
    this.store = useStore();
  }

  selectFrame(ev) {
    const val = ev.target.value;
    this.store.selectFrame(val);
  }
}
