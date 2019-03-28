import { HELLO_WORLD } from "./demos.js";

class Playground extends owl.core.Component {
  inlineTemplate = `
    <div class="playground">
        <div class="left-bar">
            <button t-on-click="runCode">▶ Run</button>
            <div class="code-editor" t-ref="editor"></div>
        </div>
        <div class="content">
          <iframe t-ref="iframe"/>
        </div>
    </div>`;

  mounted() {
    this.editor = ace.edit(this.refs.editor);
    this.editor.session.setOption("useWorker", false);
    this.editor.setValue(HELLO_WORLD, -1);
    this.editor.setTheme("ace/theme/monokai");
    this.editor.session.setMode("ace/mode/javascript");
    const doc = this.refs.iframe.contentWindow.document;

    // add owl library
    const owlScript = doc.createElement("script");
    owlScript.src = "libs/owl.js";
    doc.body.appendChild(owlScript);
  }

  runCode() {
    const doc = this.refs.iframe.contentWindow.document;

    // // add owl library
    // const owlScript = doc.createElement("script");
    // owlScript.src = "libs/owl.js";
    // doc.body.appendChild(owlScript);

    const code = this.editor.getValue();
    const script = doc.createElement("script");
    script.type = "text/javascript";
    script.innerHTML = code;
    doc.body.appendChild(script);
    //  var thisDoc = this.contentWindow.document;
    //     if ( ! thisDoc.getElementById(scriptID)) {
    //         var scriptObj = thisDoc.createElement("script");
    //         scriptObj.type = "text/javascript";
    //         scriptObj.id = scriptId;
    //         scriptObj.innerHTML = script;
    //         thisDoc.body.appendChild(scriptObj);
    //     }
    // });
  }
}

document.addEventListener("DOMContentLoaded", async function() {
  const env = {
    qweb: new owl.core.QWeb()
  };

  const playground = new Playground(env);
  playground.mount(document.body);
});
