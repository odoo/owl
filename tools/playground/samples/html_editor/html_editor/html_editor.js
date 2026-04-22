import { Component, signal, onMounted, props, types as t } from "@odoo/owl";

export class HtmlEditor extends Component {
  static template = "demo.HtmlEditor";
  props = props({
    "html?": t.signal(),
  });

  setup() {
    this.editorRef = signal(null);

    onMounted(() => {
      const el = this.editorRef();
      if (el && this.props.html) {
        el.innerHTML = this.props.html();
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
