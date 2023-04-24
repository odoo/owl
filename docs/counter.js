import { mount, Component, useState, loadFile } from "@odoo/owl";

class Counter extends Component {
  static template = "Counter";
  setup() {
    this.state = useState({ value: 0 });
  }

  increment() {
    this.state.value++;
  }
}
const templates = await loadFile("./counter.xml");

mount(Counter, document.getElementById("app-container"), { templates });
