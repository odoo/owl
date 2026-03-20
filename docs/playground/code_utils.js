import { autocompletion, snippet } from "./libs/codemirror.bundle.js";
import { loadJS } from "./utils.js";

let markedLoaded = null;
let highlightJsLoaded = null;
let markedHighlightLoaded = null;
let markedConfigured = false;

async function getMarked() {
  if (!markedLoaded) {
    markedLoaded = loadJS("https://cdn.jsdelivr.net/npm/marked/marked.min.js").then(() => {
      return window.marked;
    });
  }
  return markedLoaded;
}

async function getHighlightJS() {
  if (!highlightJsLoaded) {
    highlightJsLoaded = loadJS(
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"
    ).then(() => {
      return window.hljs;
    });
  }
  return highlightJsLoaded;
}

async function getMarkedHighlight() {
  if (!markedHighlightLoaded) {
    markedHighlightLoaded = loadJS(
      "https://cdn.jsdelivr.net/npm/marked-highlight@2.2.1/lib/index.umd.min.js"
    ).then(() => {
      return window.markedHighlight;
    });
  }
  return markedHighlightLoaded;
}

async function parseMarkdown(content) {
  const [markedLib, hljs, markedHighlight] = await Promise.all([
    getMarked(),
    getHighlightJS(),
    getMarkedHighlight(),
  ]);
  if (!markedConfigured) {
    markedConfigured = true;
    markedLib.use(
      markedHighlight.markedHighlight({
        highlight(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {}
          }
          try {
            return hljs.highlightAuto(code).value;
          } catch (e) {}
          return code;
        },
      })
    );
  }
  return markedLib.parse(content);
}

const OWL_IMPORTS = [
  { label: "Component", type: "class" },
  { label: "mount", type: "function" },
  { label: "xml", type: "function" },
  { label: "signal", type: "function" },
  { label: "computed", type: "function" },
  { label: "effect", type: "function" },
  { label: "useEffect", type: "function" },
  { label: "Plugin", type: "class" },
  { label: "plugin", type: "function" },
  { label: "props", type: "function" },
  { label: "providePlugins", type: "function" },
  { label: "onMounted", type: "function" },
  { label: "onWillStart", type: "function" },
  { label: "onWillDestroy", type: "function" },
  { label: "onWillPatch", type: "function" },
  { label: "onPatched", type: "function" },
  { label: "onWillUnmount", type: "function" },
  { label: "useListener", type: "function" },
];

const OWL_SNIPPETS = [
  {
    label: "Component class",
    type: "snippet",
    info: "Create a new OWL component",
    template:
      'class ${1:MyComponent} extends Component {\n  static template = "${2:template_name}";\n\n  setup() {\n    ${3}\n  }\n}',
    importSymbol: "Component",
  },
  {
    label: "Plugin class",
    type: "snippet",
    info: "Create a new OWL plugin",
    template:
      'class ${1:MyPlugin} extends Plugin {\n  static id = "${2:myPlugin}";\n\n  setup() {\n    ${3}\n  }\n}',
    importSymbol: "Plugin",
  },
];

const SETUP_SNIPPET = {
  label: "setup",
  type: "snippet",
  info: "Add setup method to component",
  template: "setup() {\n  ${1}\n}",
};

function isInsideComponentClass(doc, position) {
  const textBefore = doc.slice(0, position);
  const lines = textBefore.split("\n");
  let braceDepth = 0;
  let insideComponentClass = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.includes("}")) braceDepth -= (line.match(/}/g) || []).length;
    if (line.includes("{")) braceDepth += (line.match(/{/g) || []).length;

    if (braceDepth > 0 && /class\s+\w+\s+extends\s+Component/.test(line)) {
      insideComponentClass = true;
      break;
    }
  }

  return insideComponentClass;
}

function getOwlImportChanges(doc, symbolName) {
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']@odoo\/owl["'];?/;
  const match = importRegex.exec(doc);

  if (match) {
    const importsStr = match[1];
    const imports = importsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (imports.includes(symbolName)) return null;

    imports.push(symbolName);
    const newImport = `import { ${imports.join(", ")} } from "@odoo/owl";`;
    return { from: match.index, to: match.index + match[0].length, insert: newImport };
  } else {
    return { from: 0, to: 0, insert: `import { ${symbolName} } from "@odoo/owl";\n` };
  }
}

function owlCompletionSource(context) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const doc = context.state.doc.toString();
  const insideComponent = isInsideComponentClass(doc, word.from);

  const options = [
    ...OWL_IMPORTS.map((item) => ({
      label: item.label,
      type: item.type,
      info: "OWL " + item.type,
      apply: (view, completion, from, to) => {
        const importChange = getOwlImportChanges(doc, item.label);
        const textChange = { from, to, insert: item.label };

        if (importChange) {
          view.dispatch({ changes: [importChange, textChange] });
        } else {
          view.dispatch({ changes: [textChange] });
        }
      },
    })),
    ...OWL_SNIPPETS.map((item) => ({
      label: item.label,
      type: item.type,
      info: item.info,
      apply: (view, completion, from, to) => {
        const importChange = getOwlImportChanges(doc, item.importSymbol);

        if (importChange) {
          const insertLength = importChange.insert.length;
          const deleteLength = importChange.to - importChange.from;
          const offset = insertLength - deleteLength;

          view.dispatch({ changes: [importChange] });
          snippet(item.template)(view, completion, from + offset, to + offset);
        } else {
          snippet(item.template)(view, completion, from, to);
        }
      },
    })),
  ];

  if (insideComponent) {
    options.push({
      label: SETUP_SNIPPET.label,
      type: SETUP_SNIPPET.type,
      info: SETUP_SNIPPET.info,
      apply: (view, completion, from, to) => {
        snippet(SETUP_SNIPPET.template)(view, completion, from, to);
      },
    });
  }

  return {
    from: word.from,
    options,
    validFor: /^\w*$/,
  };
}

function createOwlCompletions() {
  return autocompletion({
    override: [owlCompletionSource],
    activateOnTyping: true,
    maxRenderedOptions: 50,
  });
}

export { createOwlCompletions, OWL_IMPORTS, OWL_SNIPPETS, parseMarkdown, SETUP_SNIPPET };
