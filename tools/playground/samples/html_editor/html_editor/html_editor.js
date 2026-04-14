import { Component, signal, useEffect } from "@odoo/owl";

export class HtmlEditor extends Component {
  static template = "demo.HtmlEditor";
  static props = {
    html: { type: Object, optional: true },
  };

  setup() {
    this.editorRef = signal(null);

    useEffect(() => {
      const el = this.editorRef();
      if (el && this.props.html) {
        el.innerHTML = this.props.html.value;
      }
    });
  }

  execCommand(command, value = null) {
    document.execCommand(command, false, value);
    this.updateHtml();
  }

  insertLink() {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
      this.updateHtml();
    }
  }

  updateHtml() {
    const el = this.editorRef();
    if (el && this.props.html) {
      this.props.html.set(el.innerHTML);
    }
  }
}
