import { SAMPLES as samples }  from "./samples.js" ;
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
function makeCodeIframe(js, css, xml) {
    const sanitizedXML = xml.replace(/<!--[\s\S]*?-->/g, "");


    // create iframe
    const iframe = document.createElement("iframe");
    iframe.className += "h-full w-full";

    iframe.onload = () => {
        const doc = iframe.contentDocument;
        // inject js
        const owlScript = doc.createElement("script");
        owlScript.type = "text/javascript";
        owlScript.src = "../owl.js";
        owlScript.addEventListener("load", () => {
            const script = doc.createElement("script");
            script.type = "text/javascript";
            const content = `
        {
          owl.config.mode = 'dev';
          let templates = \`${sanitizedXML}\`;
          const qweb = new owl.QWeb({ templates });
          owl.Component.env = { qweb };
        }
        ${js}`;
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
/**
 * This is the javascript code defined in the playground.
 * In a larger application, this code should probably be moved in different
 * sub files.
 */
function app() {
${processedJS}
}

/**
 * Initialization code
 * This code load templates, and make sure everything is properly connected.
 */
async function start() {
  let templates;
  try {
    templates = await owl.utils.loadFile('app.xml');
  } catch(e) {
    console.error(\`This app requires a static server.  If you have python installed, try 'python app.py'\`);
    return;
  }
  const env = { qweb: new owl.QWeb({templates})};
  owl.Component.env = env;
  await owl.utils.whenReady();
  app();
}

start();
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
    let result = samples.slice();
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
    return loadSamples();
}

//------------------------------------------------------------------------------
// MAIN APP
//------------------------------------------------------------------------------

class Tab extends owl.Component {
}

class Editor extends owl.Component {

    static props = ['js', 'xml', 'css']

    state = useState({ 
        currentExtension: 'js', 
        js: this.props.js,
        css: this.props.css,
        xml: this.props.xml
    })

    editor = null;

    willUpdateProps(nextProps) {
        console.log(nextProps);
        this.state.js = nextProps.js;
        this.state.css = nextProps.css;
        this.state.xml = nextProps.xml;
        this._openFile(this.state.currentExtension, false) 
    }

    _run(ev) {
        this._saveCodeState();
        this.trigger('run-project', {
            js: this.state.js,
            xml: this.state.xml,
            css: this.state.css
        })
    }

    _openFile(extension, save = true) {
        if (save) this._saveCodeState();
        this.state.currentExtension = extension;
        let language = 'javascript';
        switch (extension) {
            case 'xml':
                language = 'xml';
                break;
            case 'css':
                language = 'css';
                break;
        }

        const model = monaco.editor.createModel(
            this.state[this.state.currentExtension],
            language,
            null
        )

        this.editor.setModel(model)
    }

    mounted() {
        this.editor = monaco.editor.create(document.getElementById('container'), {
            value: this.state[this.state.currentExtension],
            language: 'javascript',
            automaticLayout: true,
            minimap: {
                enabled: false
            }
        });
    }

    _saveCodeState() {
        this.state[this.state.currentExtension] = this.editor.getValue();
    }

    _openCSS(ev) {
        this._openFile('css')
    }

    _openXML(ev) {
        this._openFile('xml')
    }

    _openJS(ev) {
        this._openFile('js')
    }

}

Editor.components = { Tab }


class App extends owl.Component {

    samples = [];

    constructor(...args) {
        super(...args);
        this.version = owl.__info__.version;
        this.samples = useSamples();

        this.state = useState({ 
            js: this.samples[0].code,
            css: this.samples[0].css || "",
            xml: this.samples[0].xml || DEFAULT_XML,
        });

        this.runCode = owl.utils.debounce(this.runCode, 250, true);
        this.downloadCode = owl.utils.debounce(this.downloadCode, 250, true);
        this.content = useRef("iframe-container");
    }


    _run(ev) {
        this.content.el.innerHTML = "";
        const { js, css, xml } = ev.detail;
        const subiframe = makeCodeIframe(js, css, xml);
        this.content.el.appendChild(subiframe);
    }

    _setSample(ev) {
        const sample = this.samples.find(s => s.description === ev.target.value);
        this.state.js = sample.code;
        this.state.css = sample.css || "";
        this.state.xml = sample.xml || DEFAULT_XML;
        deleteLocalSample();
    }


}

App.components = { Editor }

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
    owl.Component.env = { qweb };
    const app = new App();
    app.mount(document.body);
}

start();
