import { Component, signal } from "@odoo/owl-runtime";

export class App extends Component {
  static template = "App";

  count = signal(0);
}
