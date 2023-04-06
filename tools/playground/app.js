import { SAMPLES } from "./samples.js";
import { debounce, loadJS } from "./utils.js";
import { exportStandaloneApp } from "./export_snippet.js";
const { useState, useRef, onMounted, onWillUnmount, onPatched, onWillUpdateProps } = owl;

//------------------------------------------------------------------------------
// Constants, helpers, utils
//------------------------------------------------------------------------------

const MODES = {
  js: "ace/mode/javascript",
  css: "ace/mode/css",
  xml: "ace/mode/xml"
};

const DEFAULT_XML = `<templates>
</templates>`;

/**
 * Make an iframe, with all the js, css and xml properly injected.
 */
function makeCodeIframe(js, css, xml) {
  const sanitizedXML = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/`/g, '\\\`');

  // create iframe
  const iframe = document.createElement("iframe");

  iframe.onload = () => {
    const doc = iframe.contentDocument;
    const utilsMod = doc.createElement("script");
    utilsMod.setAttribute("type", "module");
    utilsMod.setAttribute("src", "utils.js");
    doc.head.appendChild(utilsMod);
    // inject js
    const owlScript = doc.createElement("script");
    owlScript.type = "text/javascript";
    owlScript.src = "../owl.js";
    owlScript.addEventListener("load", () => {
      const script = doc.createElement("script");
      script.type = "module";
      const content = `
        (async function(TEMPLATES) {
          ${js}
        })(\`${sanitizedXML}\`)`;
      script.innerHTML = content;
      doc.body.appendChild(script);
    });
    doc.head.appendChild(owlScript);

    // inject css
    const style = document.createElement("style");
    style.innerHTML = css;
    doc.head.appendChild(style);
  };
  return iframe;
}

//------------------------------------------------------------------------------
// SAMPLES
//------------------------------------------------------------------------------
function loadSamples() {
  let result = SAMPLES.slice();
  const localSample = localStorage.getItem("owl-playground-local-sample");
  if (localSample) {
    const { js, css, xml } = JSON.parse(localSample);
    result.unshift({
      description: "Local Storage Code",
      code: js,
      xml,
      css
    });
  }
  return result;
}

function saveLocalSample(js, css, xml) {
  const str = JSON.stringify({ js, css, xml });
  localStorage.setItem("owl-playground-local-sample", str);
}

function deleteLocalSample() {
  localStorage.removeItem("owl-playground-local-sample");
}

function useSamples() {
  const samples = loadSamples();
  const component = owl.useComponent();
  let interval;

  onMounted(() => {
    const state = component.state;
    interval = setInterval(() => {
      if (component.isDirty) {
        saveLocalSample(state.js, state.css, state.xml);
      }
    }, 1000);
  });
  onWillUnmount(() => {
    clearInterval(interval);
  });
  return samples;
}

//------------------------------------------------------------------------------
// Tabbed editor
//------------------------------------------------------------------------------
class TabbedEditor extends owl.Component {
  setup() {
    const props = this.props;
    this.state = useState({
      currentTab: props.js !== false ? "js" : props.xml ? "xml" : "css"
    });
    this.setTab = debounce(this.setTab.bind(this), 250, true);

    this.sessions = {};
    this._setupSessions(props);
    this.editorNode = useRef("editor");
    this._updateCode = this._updateCode.bind(this);

    onMounted(() => {
      this.editor = this.editor || ace.edit(this.editorNode.el);

      this.editor.setValue(this.props[this.state.currentTab], -1);
      this.editor.setFontSize("12px");
      this.editor.setTheme("ace/theme/monokai");
      this.editor.setSession(this.sessions[this.state.currentTab]);
      const tabSize = this.state.currentTab === "xml" ? 2 : 4;
      this.editor.session.setOption("tabSize", tabSize);
      this.editor.on("blur", this._updateCode);
      this.interval = setInterval(this._updateCode, 3000);
    });

    onPatched(() => {
      const session = this.sessions[this.state.currentTab];
      let content = this.props[this.state.currentTab];
      if (content === false) {
        const tab = this.props.js !== false ? "js" : this.props.xml ? "xml" : "css";
        content = this.props[tab];
        this.state.currentTab = tab;
      }
      if (this.editor.getValue() !== content) {
        session.setValue(content, -1);
        this.editor.setSession(session);
        this.editor.resize();
      }
    });

    onWillUpdateProps((nextProps) => this._setupSessions(nextProps));

    onWillUnmount(() => {
      clearInterval(this.interval);
      this.editor.off("blur", this._updateCode);
    });
  }

  setTab(tab) {
    if (this.state.currentTab !== tab) {
      this.state.currentTab = tab;
      const session = this.sessions[this.state.currentTab];
      session.doc.setValue(this.props[tab], -1);
      this.editor.setSession(session);
    }
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

  _setupSessions(props) {
    for (let tab of ["js", "xml", "css"]) {
      if (props[tab] !== false && !this.sessions[tab]) {
        this.sessions[tab] = new ace.EditSession(props[tab], MODES[tab]);
        this.sessions[tab].setOption("useWorker", false);
        const tabSize = tab === "xml" ? 2 : 4;
        this.sessions[tab].setOption("tabSize", tabSize);
        this.sessions[tab].setUndoManager(new ace.UndoManager());
      }
    }
  }

  _updateCode() {
    const editorValue = this.editor.getValue();
    const propsValue = this.props[this.state.currentTab];
    if (editorValue !== propsValue) {
      this.props.updateCode({
        type: this.state.currentTab,
        value: editorValue
      });
    }
  }
}
TabbedEditor.template = "TabbedEditor";

//------------------------------------------------------------------------------
// MAIN APP
//------------------------------------------------------------------------------
class App extends owl.Component {
  setup() {
    this.version = owl.__info__.version;
    this.SAMPLES = useSamples();
    this.isDirty = false;

    this.state = useState({
      js: this.SAMPLES[0].code,
      css: this.SAMPLES[0].css || "",
      xml: this.SAMPLES[0].xml || DEFAULT_XML,
      displayWelcome: true,
      splitLayout: true,
      leftPaneWidth: Math.ceil(window.innerWidth / 2),
      topPanelHeight: null
    });

    this.toggleLayout = debounce(this.toggleLayout, 250, true);
    this.runCode = debounce(this.runCode, 250, true);
    this.downloadCode = debounce(this.downloadCode, 250, true);
    this.content = useRef("content");
    this.updateCode = this.updateCode.bind(this);
    if (window.location.hash) {
      try {
        const { js, css, xml } = JSON.parse(atob(decodeURIComponent(window.location.hash.slice(1))));
        if (![js, css, xml].every(item => typeof item === "string")) {
          return;
        }
        Object.assign(this.state, { js, css, xml });
      } catch {}
    }
  }

  runCode() {
    this.content.el.innerHTML = "";
    this.state.displayWelcome = false;

    const { js, css, xml } = this.state;
    const subiframe = makeCodeIframe(js, css, xml);
    this.content.el.appendChild(subiframe);
  }

  shareCode() {
    const state = btoa(JSON.stringify({ js: this.state.js, css: this.state.css, xml: this.state.xml }));
    const link = new URL(window.location.href);
    link.hash = state;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link.href);
      clearTimeout(this.state.copied)
      this.state.copied = setTimeout(() => this.state.copied = null, 2000);
    }
    window.location.href = link.href;
  }

  setSample(ev) {
    const sample = this.SAMPLES.find(s => s.description === ev.target.value);
    this.state.js = sample.code;
    this.state.css = sample.css || "";
    this.state.xml = sample.xml || DEFAULT_XML;
    deleteLocalSample();
    this.isDirty = false;
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
  updateCode({type, value}) {
    if (this.state[type] !== value) {
      this.state[type] = value;
      this.isDirty = true;
    }
  }
  toggleLayout() {
    this.state.splitLayout = !this.state.splitLayout;
  }
  updatePanelHeight(ev) {
    if (!ev.detail.delta) {
      return;
    }
    let height = this.state.topPanelHeight;
    if (!height) {
      height = document.getElementsByClassName("tabbed-editor")[0].clientHeight;
    }
    this.state.topPanelHeight = height + ev.detail.delta;
  }

  async downloadCode() {
    const { js, css, xml } = this.state;
    const content = await exportStandaloneApp(js, css, xml);
    await loadJS("libs/FileSaver.min.js");
    saveAs(content, "app.zip");
  }
}
App.components = { TabbedEditor };
App.template = "App";

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
async function start() {
  document.title = `${document.title} (v${owl.__info__.version})`;
  const commit = `https://github.com/odoo/owl/commit/${owl.__info__.hash}`;
  console.info(`This application is using Owl built with the following commit:`, commit);
  const [templates] = await Promise.all([
    owl.loadFile("templates.xml"),
    owl.whenReady()
  ]);
  const rootApp = new owl.App(App);
  rootApp.addTemplates(templates);

  await  rootApp.mount(document.body);
}

start();
