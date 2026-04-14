import { Component, mount, signal, xml } from "@odoo/owl";
import { HtmlEditor } from "./html_editor/html_editor.js";

class Root extends Component {
  static template = xml`<HtmlEditor html="this.html"/>`;
  static components = { HtmlEditor };

  setup() {
    this.html = signal("<h2>Hello World</h2><p>Start editing here...</p>");
  }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
