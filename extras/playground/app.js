import { SAMPLES } from "./samples.js";

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

const APP_PY = `import sys
import thread
import webbrowser
import time

import BaseHTTPServer, SimpleHTTPServer

def start_server():
    httpd = BaseHTTPServer.HTTPServer(('127.0.0.1', 3600), SimpleHTTPServer.SimpleHTTPRequestHandler)
    httpd.serve_forever()

thread.start_new_thread(start_server,())
url = 'http://127.0.0.1:3600'
webbrowser.open_new(url)

while True:
    try:
        time.sleep(1)
    except KeyboardInterrupt:
        sys.exit(0)
`;

//------------------------------------------------------------------------------
// Tabbed editor
//------------------------------------------------------------------------------
class TabbedEditor extends owl.Component {
  constructor() {
    super(...arguments);
    this.template = "tabbed-editor";
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
class App extends owl.Component {
  constructor(...args) {
    super(...args);
    this.template = "playground";
    this.version = owl._version;
    this.SAMPLES = SAMPLES;
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

  displayError(error) {
    this.state.error = error;
    if (error) {
      setTimeout(() => {
        this.refs.content.innerHTML = "";
      });
      return;
    }
  }

  async runCode() {
    this.state.displayWelcome = false;
    // check templates
    var qweb = new owl.QWeb();
    var error = false;
    const sanitizedXML = this.state.xml.replace(/<!--[\s\S]*?-->/g, "");
    try {
      qweb.loadTemplates(sanitizedXML);
    } catch (e) {
      error = e;
    }

    if (error) {
      this.displayError(error.message);
      return;
    } else {
      this.state.error = false;
    }

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
        const content = `window.TEMPLATES = \`${sanitizedXML}\`\n${
          this.state.js
        }`;
        script.innerHTML = content;
        const errorHandler = e => this.displayError(e.message || e.reason.message);
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

  async downloadCode() {
    await owl.utils.loadJS("libs/FileSaver.min.js");
    await owl.utils.loadJS("libs/jszip.min.js");

    const zip = new JSZip();

    const JS = `async function startApp() {
  // Loading templates
  let TEMPLATES;
  try {
    TEMPLATES = await owl.utils.loadTemplates('app.xml');
  } catch(e) {
    document.write(\`This app requires a static server.  If you have python installed, try 'python app.py'\`);
    return;
  }

  // Application code
${this.state.js.split('\n').map(l => l === '' ? '' : '  ' + l).join('\n')}
}

// wait for DOM ready before starting
owl.utils.whenReady(startApp);`;

    zip.file("app.js", JS);
    zip.file("app.css", this.state.css);
    zip.file("app.py", APP_PY);
    zip.file("app.xml", this.state.xml);
    zip.file("index.html", DEFAULT_HTML);
    zip.file("owl.js", owlSourceCode());
    zip.generateAsync({ type: "blob" }).then(function(content) {
      saveAs(content, "app.zip");
    });
  }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
document.title = `${document.title} (v${owl._version})`;
document.addEventListener("DOMContentLoaded", async function() {
  const templates = await owl.utils.loadTemplates("templates.xml");
  const qweb = new owl.QWeb(templates);
  const env = { qweb };
  const app = new App(env);
  app.mount(document.body);
});
