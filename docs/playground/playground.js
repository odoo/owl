import { debounce, loadJS } from "./utils.js";
import {
  App,
  Component,
  useState,
  useRef,
  onMounted,
  onWillUnmount,
  onPatched,
  onWillUpdateProps,
  loadFile as _loadFile,
  whenReady,
  __info__,
  useEffect,
  onWillStart,
} from "../owl.js";

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

// Memoize loadFile so that samples aren't reloaded whenever a sample is selected
const fileCache = {};
const loadFile = (path) => {
  if (!(path in fileCache)) {
    fileCache[path] = _loadFile(path);
  }
  return fileCache[path];
}

/**
 * Make an iframe, with all the js, css and xml properly injected.
 */
function makeCodeIframe(js, css, xml) {
  // escape backticks in the xml so they don't close the template string
  const escapedXml = xml.replace(/`/g, '\\\`');

  const iframe = document.createElement("iframe");
  iframe.onload = () => {
    const doc = iframe.contentDocument;

    const importMap = doc.createElement("script");
    importMap.type = "importmap";
    importMap.textContent = `{ "imports": { "@odoo/owl": "../owl.js" } }`;
    doc.head.appendChild(importMap);

    const script = doc.createElement("script");
    script.type = "module";
    script.textContent = `const TEMPLATES = \`${escapedXml}\`\n${js}`;
    doc.body.appendChild(script);

    const style = document.createElement("style");
    style.innerText = css;
    doc.head.appendChild(style);
  };
  return iframe;
}

//------------------------------------------------------------------------------
// SAMPLES
//------------------------------------------------------------------------------

const SAMPLES = [
  {
    description: "Components",
    folder: "components",
    code: ["js", "xml", "css"],
  },
  {
    description: "Form Input Bindings",
    folder: "form",
    code: ["js", "xml"],
  },
  {
    description: "Inline templates",
    folder: "single_file_component",
    code: ["js"],
  },
  {
    description: "Lifecycle demo",
    folder: "lifecycle_demo",
    code: ["js", "xml", "css"],
  },
  {
    description: "Customized hook",
    folder: "custom_hooks",
    code: ["js", "xml", "css"],
  },
  {
    description: "Todo List App (with reactivity)",
    folder: "todo_app",
    code: ["js", "xml", "css"],
  },
  {
    description: "Responsive app",
    folder: "responsive_app",
    code: ["js", "xml", "css"],
  },
  {
    description: "Slots And Generic Components",
    folder: "slots",
    code: ["js", "xml", "css"],
  },
  {
    description: "Window Management System",
    folder: "window_manager",
    code: ["js", "xml", "css"],
  },
  {
    description: "Benchmark example",
    folder: "benchmark",
    code: ["js", "xml", "css"],
  },
]

function loadSamples() {
  const result = SAMPLES.map(({ description, folder, code }) => ({
    description,
    code: async () => Object.fromEntries(
      await Promise.all(
        code.map(async (type) => [type, await loadFile(`./samples/${folder}/${folder}.${type}`)])
      )
    ),
  }));
  const localSample = localStorage.getItem("owl-playground-local-sample");
  if (localSample) {
    const { js, css, xml } = JSON.parse(localSample);
    result.unshift({
      description: "Local Storage Code",
      code: () => Promise.resolve({ js, xml, css }),
    });
  }
  return result;
}

//------------------------------------------------------------------------------
// Tabbed editor
//------------------------------------------------------------------------------
class TabbedEditor extends Component {
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
        this.props.updatePanelHeight({ delta });
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
class Playground extends Component {
  static template = "Playground";
  static components = { TabbedEditor };
  setup() {
    this.version = __info__.version;

    this.isDirty = false;
    this.state = useState({
      js: "",
      css: "",
      xml: DEFAULT_XML,
      displayWelcome: true,
      splitLayout: true,
      leftPaneWidth: Math.ceil(window.innerWidth / 2),
      topPanelHeight: null
    });

    this.samples = loadSamples();
    if (window.location.hash) {
      try {
        const { js, css, xml } = JSON.parse(atob(decodeURIComponent(window.location.hash.slice(1))));
        if ([js, css, xml].every(item => typeof item === "string")) {
          Object.assign(this.state, { js, css, xml });
        }
      } catch {}
    }
    onWillStart(async () => {
      if (!this.state.js) {
        this.setSample(await this.samples[0].code());
      }
    })
    useEffect(() => {
      const interval = setInterval(() => {
        if (this.isDirty) {
          const { js, css, xml } = this.state;
          const str = JSON.stringify({ js, css, xml });
          localStorage.setItem("owl-playground-local-sample", str);
        }
      }, 1000);
      return () => clearInterval(interval);
    }, () => []);

    this.toggleLayout = debounce(this.toggleLayout, 250, true);
    this.runCode = debounce(this.runCode, 250, true);
    this.exportStandaloneApp = debounce(this.exportStandaloneApp, 250, true);
    this.content = useRef("content");
    this.updateCode = this.updateCode.bind(this);
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

  setSample(sample) {
    this.state.js = sample.js;
    this.state.css = sample.css || "";
    this.state.xml = sample.xml || DEFAULT_XML;
    localStorage.removeItem("owl-playground-local-sample");
    this.isDirty = false;
  }

  get leftPaneStyle() {
    return `width:${this.state.leftPaneWidth}px`;
  }

  get topEditorStyle() {
    return `flex: 0 0 ${this.state.topPanelHeight}px`;
  }

  async onSampleChange(ev) {
    this.setSample(await this.samples.find(s => s.description === ev.target.value).code());
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
  updatePanelHeight({ delta }) {
    let height = this.state.topPanelHeight || document.querySelector(".tabbed-editor").clientHeight;
    this.state.topPanelHeight = height + delta;
  }

  async exportStandaloneApp() {
    const { js, css, xml } = this.state;

    await loadJS("libs/jszip.min.js");
    const zip = new JSZip();
    zip.file("app.py", await loadFile("./standalone_app/app.py"));
    zip.file("index.html", await loadFile("./standalone_app/index.html"));
    zip.file("owl.js", await loadFile("../owl.js"));
    zip.file("app.js", `const TEMPLATES = await (await fetch('app.xml')).text();\n${js}`);
    zip.file("app.css", css);
    zip.file("app.xml", xml);

    await loadJS("libs/FileSaver.min.js");
    saveAs(await zip.generateAsync({ type: "blob" }), "app.zip");
  }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
async function start() {
  document.title = `${document.title} (v${__info__.version})`;
  const commit = `https://github.com/odoo/owl/commit/${__info__.hash}`;
  console.info(`This application is using Owl built with the following commit:`, commit);
  const [templates] = await Promise.all([
    loadFile("templates.xml"),
    whenReady()
  ]);
  const rootApp = new App(App, { name: "Owl Playground" });
  rootApp.addTemplates(templates);

  await  rootApp.mount(document.body);
}

start();
