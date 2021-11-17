import { loadJS } from "./utils.js";

const sourceCache = new Map();
async function getSourceCode(filePath) {
    if (sourceCache.has(filePath)) {
        return sourceCache.get(filePath);
    }
    let source = await fetch(`${filePath}.js`);
    source = await source.text();
    sourceCache.set(filePath, source);
    return source;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>OWL App</title>
    <link rel="icon" href="data:,">

    <script src="owl.js"></script>
    <link rel="stylesheet" href="app.css">
    <script type="module" src="app.js"></script>
    <script type="module" src="utils.js"></script>
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
 * Make a zip file containing a functioning application
 */
export async function exportStandaloneApp(js, css, xml) {
  await loadJS("libs/jszip.min.js");

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
import * as utils from "./utils.js";
async function app() {
${processedJS}
}

/**
 * Initialization code
 * This code load templates, and make sure everything is properly connected.
 */
function prepareOWLApp(templates) {
  const _configure = owl.App.prototype.configure;
  owl.App.prototype.configure = function configureOverriden(config) {
    config = Object.assign({ dev: true }, config); 
    this.addTemplates(templates);
    return _configure.call(this, config);
  }
}

async function start() {
  let templates;
  try {
    templates = await owl.loadFile('app.xml');
  } catch(e) {
    console.error(\`This app requires a static server.  If you have python installed, try 'python app.py'\`);
    return;
  }
  prepareOWLApp(templates);
  app();
}

start();
`;

  const [owlSrc, utilsSrc] = await Promise.all([
    getSourceCode("../owl"),
    getSourceCode("./utils"),
  ]);

  zip.file("app.js", JS);
  zip.file("utils.js", utilsSrc);
  zip.file("app.css", css);
  zip.file("app.py", APP_PY);
  zip.file("app.xml", xml);
  zip.file("index.html", DEFAULT_HTML);
  zip.file("owl.js", owlSrc);
  return zip.generateAsync({ type: "blob" });
}
