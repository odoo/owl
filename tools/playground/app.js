import { SAMPLES } from "./samples.js";
const { useState, useRef, onMounted, onWillUnmount } = owl.hooks;
//------------------------------------------------------------------------------
// Constants, helpers, utils
//------------------------------------------------------------------------------
let owlJS;

async function owlSourceCode() {
  if (owlJS) {
    return owlJS;
  }
  const result = await fetch("../owl.js");
  owlJS = await result.text();
  return owlJS;
}

const MODES = {
  js: "ace/mode/javascript",
  css: "ace/mode/css",
  xml: "ace/mode/xml"
};

const DEFAULT_XML = `<templates>
</templates>`;

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>OWL App</title>
    <link rel="icon" href="data:,">

    <script src="owl.js"></script>
    <link rel="stylesheet" href="app.css">
    <script src="app.js"></script>
  </head>
  <body>
  </body>
</html>
`;

const APP_PY = `#!/usr/bin/env python3

import threading
import time

from http.server import SimpleHTTPRequestHandler, HTTPServer

def start_server():
    SimpleHTTPRequestHandler.extensions_map['.js'] = 'application/javascript'
    httpd = HTTPServer(('0.0.0.0', 3600), SimpleHTTPRequestHandler)
    httpd.serve_forever()

url = 'http://127.0.0.1:3600'

if __name__ == "__main__":
    print("Owl Application")
    print("---------------")
    print("Server running on: {}".format(url))
    threading.Thread(target=start_server, daemon=True).start()

    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            httpd.server_close()
            quit(0)
`;

/**
 * Make an iframe, with all the js, css and xml properly injected.
 */
function makeCodeIframe(js, css, xml, errorHandler) {
  // check templates
  var qweb = new owl.QWeb();
  const sanitizedXML = xml.replace(/<!--[\s\S]*?-->/g, "");

  // will throw error if there is something wrong with xml
  qweb.addTemplates(sanitizedXML);

  // create iframe
  const iframe = document.createElement("iframe");

  iframe.onload = () => {
    const doc = iframe.contentDocument;
    // inject js
    const owlScript = doc.createElement("script");
    owlScript.type = "text/javascript";
    owlScript.src = "../owl.js";
    owlScript.addEventListener("load", () => {
      const script = doc.createElement("script");
      script.type = "text/javascript";
      const content = `owl.__info__.mode = 'dev';\nwindow.TEMPLATES = \`${sanitizedXML}\`;\n${js}`;
      script.innerHTML = content;
      iframe.contentWindow.addEventListener("error", errorHandler);
      iframe.contentWindow.addEventListener("unhandledrejection", errorHandler);
      setTimeout(function() {
        if (iframe.contentWindow) {
          iframe.contentWindow.removeEventListener("error", errorHandler);
          iframe.contentWindow.removeEventListener("unhandledrejection", errorHandler);
        }
      }, 200);
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

/**
 * Make a zip file containing a functioning application
 */
async function makeApp(js, css, xml) {
  await owl.utils.loadJS("libs/jszip.min.js");

  const zip = new JSZip();
  const processedJS = js
    .split("\n")
    .map(l => (l === "" ? "" : "  " + l))
    .join("\n");

  const JS = `
async function loadTemplates() {
  try {
    return owl.utils.loadFile('app.xml');
  } catch(e) {
    console.error(\`This app requires a static server.  If you have python installed, try 'python app.py'\`);
  }
}

function start([TEMPLATES]) {
  // Application code
${processedJS}
}

Promise.all([loadTemplates(), owl.utils.whenReady()]).then(start);
`;

  zip.file("app.js", JS);
  zip.file("app.css", css);
  zip.file("app.py", APP_PY);
  zip.file("app.xml", xml);
  zip.file("index.html", DEFAULT_HTML);
  zip.file("owl.js", owlSourceCode());
  return zip.generateAsync({ type: "blob" });
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
  const component = owl.Component.current;
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
  constructor(parent, props) {
    super(parent, props);
    this.state = useState({
      currentTab: props.js !== false ? "js" : props.xml ? "xml" : "css"
    });
    this.setTab = owl.utils.debounce(this.setTab, 250, true);

    this.sessions = {};
    this._setupSessions(props);
    this.editorNode = useRef("editor");
    this._updateCode = this._updateCode.bind(this);
  }

  mounted() {
    this.editor = this.editor || ace.edit(this.editorNode.el);

    this.editor.setValue(this.props[this.state.currentTab], -1);
    this.editor.setFontSize("12px");
    this.editor.setTheme("ace/theme/monokai");
    this.editor.setSession(this.sessions[this.state.currentTab]);
    const tabSize = this.state.currentTab === "xml" ? 2 : 4;
    this.editor.session.setOption("tabSize", tabSize);
    this.editor.on("blur", this._updateCode);
    this.interval = setInterval(this._updateCode, 3000);
  }

  willUnmount() {
    clearInterval(this.interval);
    this.editor.off("blur", this._updateCode);
  }
  willUpdateProps(nextProps) {
    this._setupSessions(nextProps);
  }

  patched() {
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
      this.trigger("updateCode", {
        type: this.state.currentTab,
        value: editorValue
      });
    }
  }
}

//------------------------------------------------------------------------------
// MAIN APP
//------------------------------------------------------------------------------
class App extends owl.Component {
  constructor(...args) {
    super(...args);
    this.version = owl.__info__.version;
    this.SAMPLES = useSamples();
    this.isDirty = false;

    this.state = useState({
      js: this.SAMPLES[0].code,
      css: this.SAMPLES[0].css || "",
      xml: this.SAMPLES[0].xml || DEFAULT_XML,
      error: false,
      displayWelcome: true,
      splitLayout: true,
      leftPaneWidth: Math.ceil(window.innerWidth / 2),
      topPanelHeight: null
    });

    this.toggleLayout = owl.utils.debounce(this.toggleLayout, 250, true);
    this.runCode = owl.utils.debounce(this.runCode, 250, true);
    this.downloadCode = owl.utils.debounce(this.downloadCode, 250, true);
    this.content = useRef("content");
  }

  displayError(error) {
    this.state.error = error;
    if (error) {
      setTimeout(() => {
        this.content.el.innerHTML = "";
      });
      return;
    }
  }

  runCode() {
    this.state.displayWelcome = false;
    let subiframe;
    let error = false;
    const errorHandler = e => this.displayError(e.message || e.reason.message);
    try {
      const { js, css, xml } = this.state;
      subiframe = makeCodeIframe(js, css, xml, errorHandler);
    } catch (e) {
      //probably problem with the templates
      error = e;
      // we still log the error, always useful to have it available
      console.error(e);
    }
    if (error) {
      this.displayError(error.message);
      return;
    } else {
      this.state.error = false;
    }
    this.content.el.innerHTML = "";
    this.content.el.appendChild(subiframe);
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
  updateCode(ev) {
    if (this.state[ev.detail.type] !== ev.detail.value) {
      this.state[ev.detail.type] = ev.detail.value;
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
    const content = await makeApp(js, css, xml);
    await owl.utils.loadJS("libs/FileSaver.min.js");
    saveAs(content, "app.zip");
  }
}
App.components = { TabbedEditor };

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
async function start() {
  document.title = `${document.title} (v${owl.__info__.version})`;
  const commit = `https://github.com/odoo/owl/commit/${owl.__info__.hash}`;
  console.info(`This application is using Owl built with the following commit:`, commit);
  const [templates] = await Promise.all([
    owl.utils.loadFile("templates.xml"),
    owl.utils.whenReady()
  ]);
  const qweb = new owl.QWeb({ templates });
  const app = new App({ qweb });
  app.mount(document.body);
}

start();
