import { SAMPLES } from "./samples.js";

const { QWeb, Component } = owl;

const MODES = {
  js: "ace/mode/javascript",
  css: "ace/mode/css",
  xml: "ace/mode/xml"
};

const DEFAULT_XML = `<templates>
</templates>`;

//------------------------------------------------------------------------------
// Tabbed editor
//------------------------------------------------------------------------------
const EDITOR_TEMPLATE = `
  <div class="tabbed-editor" t-att-style="props.style">
    <div class="tabBar" t-att-class="{resizeable: props.resizeable}" t-on-mousedown="onMouseDown">
      <a t-if="tabs.js" class="tab" t-att-class="{active: state.currentTab==='js'}" t-on-click="setTab('js')">JS</a>
      <a t-if="tabs.xml" class="tab" t-att-class="{active: state.currentTab==='xml'}" t-on-click="setTab('xml')">XML</a>
      <a t-if="tabs.css" class="tab" t-att-class="{active: state.currentTab==='css'}" t-on-click="setTab('css')">CSS</a>
    </div>
    <div class="code-editor" t-ref="'editor'"></div>
  </div>`;

class TabbedEditor extends Component {
  constructor() {
    super(...arguments);
    this.inlineTemplate = EDITOR_TEMPLATE;
    this.state = {
      currentTab: this.props.display.split("|")[0]
    };
    this.tabs = {
      js: this.props.display.includes("js"),
      xml: this.props.display.includes("xml"),
      css: this.props.display.includes("css")
    };
  }

  mounted() {
    this.editor = ace.edit(this.refs.editor);

    // remove this for xml/css (?)
    this.editor.session.setOption("useWorker", false);
    this.editor.setValue(this.props[this.state.currentTab], -1);
    this.editor.setFontSize("13px");
    this.editor.setTheme("ace/theme/monokai");
    this.editor.session.setMode(MODES[this.state.currentTab]);
    const tabSize = this.state.currentTab === "xml" ? 2 : 4;
    this.editor.session.setOption("tabSize", tabSize);
    this.editor.on("blur", () => {
      const editorValue = this.editor.getValue();
      const propsValue = this.props[this.state.currentTab];
      if (editorValue !== propsValue) {
        this.trigger("updateCode", {
          type: this.state.currentTab,
          value: editorValue
        });
      }
    });
  }

  patched() {
    if (this.editor) {
      window.dispatchEvent(new Event("resize"));
      this.editor.setValue(this.props[this.state.currentTab], -1);
    }
  }

  willUnmount() {
    this.editor.destroy();
    delete this.editor;
  }

  setTab(tab) {
    this.editor.setValue(this.props[tab], -1);

    const mode = MODES[tab];
    this.editor.session.setMode(mode);
    const tabSize = tab === "xml" ? 2 : 4;
    this.editor.session.setOption("tabSize", tabSize);
    this.state.currentTab = tab;
  }

  onMouseDown(ev) {
    if (ev.target.tagName === "DIV") {
      let y = ev.clientY;
      const resizer = ev => {
        const delta = ev.clientY - y;
        y = ev.clientY;
        this.trigger("updatePanelHeight", { delta });
      };
      document.body.addEventListener("mousemove", resizer);
      document.body.addEventListener("mouseup", () => {
        document.body.removeEventListener("mousemove", resizer);
      });
    }
  }
}

//------------------------------------------------------------------------------
// MAIN APP
//------------------------------------------------------------------------------

const TEMPLATE = `
  <div class="playground">
      <div class="left-bar" t-att-style="leftPaneStyle" t-att-class="{split: state.splitLayout}">
        <div class="menubar">
          <a class="btn run-code" t-on-click="runCode">▶ Run</a>
          <select t-on-change="setSample">
            <option t-foreach="SAMPLES" t-as="sample" t-key="sample_index">
              <t t-esc="sample.description"/>
            </option>
          </select>
          <div class="layout-selector" t-att-class="{active:state.splitLayout}" t-on-click="toggleLayout">◫</div>
        </div>
        <t t-if="!state.splitLayout">
          <t t-widget="TabbedEditor" t-props="{js:state.js, css:state.css, xml: state.xml, display: 'js|xml|css'}" t-on-updateCode="updateCode"/>
        </t>
        <t t-else="1">
          <t t-widget="TabbedEditor" t-props="{js:state.js, css:state.css, xml: state.xml, display: 'js', style:topEditorStyle}" t-on-updateCode="updateCode"/>
          <div class="separator horizontal"/>
          <t t-widget="TabbedEditor" t-keepalive="1" t-props="{js:state.js, css:state.css, xml: state.xml, display: 'xml|css', resizeable: true}" t-on-updateCode="updateCode" t-on-updatePanelHeight="updatePanelHeight"/>
        </t>
      </div>
      <div class="separator vertical" t-on-mousedown="onMouseDown"/>
      <div class="right-pane"  t-att-style="rightPaneStyle">
        <div class="welcome" t-if="state.displayWelcome">
          <div>🦉 Odoo Web Lab 🦉</div>
          <div>v<t t-esc="version"/></div>
          <div class="url"><a href="https://github.com/odoo/owl">https://github.com/odoo/owl</a></div>
          <div class="note">Note: these examples require a recent browser to work without a transpilation step. </div>
        </div>
        <div t-if="state.error" class="error">
          <t t-esc="state.error.message"/>
        </div>
        <div class="content" t-ref="'content'"/>
      </div>
  </div>`;

class App extends Component {
  constructor(...args) {
    super(...args);
    this.version = owl._version;
    this.SAMPLES = SAMPLES;
    this.inlineTemplate = TEMPLATE;
    this.widgets = { TabbedEditor };

    this.state = {
      js: SAMPLES[0].code,
      css: SAMPLES[0].css || "",
      xml: SAMPLES[0].xml || DEFAULT_XML,
      error: false,
      displayWelcome: true,
      splitLayout: true,
      leftPaneWidth: Math.ceil(window.innerWidth / 2),
      topPanelHeight: null
    };
  }

  async runCode() {
    // check templates
    var qweb = new owl.QWeb();
    var error = false;
    const sanitizedXML = this.state.xml.replace(/<!--[\s\S]*?-->/g, "");
    try {
      qweb.loadTemplates(sanitizedXML);
    } catch (e) {
      error = e;
    }

    this.state.error = error;
    this.state.displayWelcome = false;
    if (error) {
      setTimeout(() => {
        this.refs.content.innerHTML = "";
      });
      return;
    }

    // create iframe
    const iframe = document.createElement("iframe");

    iframe.onload = () => {
      const doc = iframe.contentWindow.document;
      // inject js
      const owlScript = doc.createElement("script");
      owlScript.type = "text/javascript";
      owlScript.src = "libs/owl.js";
      owlScript.addEventListener("load", () => {
        const script = doc.createElement("script");
        script.type = "text/javascript";
        const content = `window.TEMPLATES = \`${sanitizedXML}\`\n${
          this.state.js
        }`;
        script.innerHTML = content;
        doc.body.appendChild(script);
      });
      doc.head.appendChild(owlScript);

      // inject css
      const style = document.createElement("style");
      style.innerHTML = this.state.css;
      doc.head.appendChild(style);
    };
    this.refs.content.innerHTML = "";
    this.refs.content.appendChild(iframe);
  }

  setSample(ev) {
    const sample = SAMPLES.find(s => s.description === ev.target.value);
    this.state.js = sample.code;
    this.state.css = sample.css || "";
    this.state.xml = sample.xml || DEFAULT_XML;
  }

  get leftPaneStyle() {
    return `width:${this.state.leftPaneWidth}px`;
  }

  get rightPaneStyle() {
    return `width:${window.innerWidth - 6 - this.state.leftPaneWidth}px`;
  }

  get topEditorStyle() {
    return `flex: 0 0 ${this.state.topPanelHeight}px`;
  }

  onMouseDown() {
    const resizer = ev => {
      this.state.leftPaneWidth = ev.clientX;
    };

    document.body.addEventListener("mousemove", resizer);
    for (let iframe of document.getElementsByTagName("iframe")) {
      iframe.classList.add("disabled");
    }

    document.body.addEventListener("mouseup", () => {
      document.body.removeEventListener("mousemove", resizer);
      for (let iframe of document.getElementsByTagName("iframe")) {
        iframe.classList.remove("disabled");
      }
    });
  }
  updateCode(ev) {
    this.state[ev.type] = ev.value;
  }
  toggleLayout() {
    this.state.splitLayout = !this.state.splitLayout;
  }
  updatePanelHeight(ev) {
    if (!ev.delta) {
      return;
    }
    let height = this.state.topPanelHeight;
    if (!height) {
      height = document.getElementsByClassName("tabbed-editor")[0].clientHeight;
    }
    this.state.topPanelHeight = height + ev.delta;
  }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
document.title = `${document.title} (v${owl._version})`;
document.addEventListener("DOMContentLoaded", async function() {
  const qweb = new QWeb();
  const env = { qweb };
  const app = new App(env);
  app.mount(document.body);
});
