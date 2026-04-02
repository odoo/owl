import {
  Annotation,
  autocompletion,
  EditorView,
  snippet,
  syntaxTree,
} from "./libs/codemirror.bundle.js";
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
  // Core
  { label: "App", type: "class" },
  { label: "Component", type: "class" },
  { label: "mount", type: "function" },
  { label: "xml", type: "function" },
  { label: "status", type: "function" },

  // Reactivity
  { label: "signal", type: "function" },
  { label: "computed", type: "function" },
  { label: "effect", type: "function" },
  { label: "proxy", type: "function" },
  { label: "markRaw", type: "function" },
  { label: "toRaw", type: "function" },
  { label: "untrack", type: "function" },

  // Lifecycle hooks
  { label: "onWillStart", type: "function" },
  { label: "onMounted", type: "function" },
  { label: "onWillPatch", type: "function" },
  { label: "onPatched", type: "function" },
  { label: "onWillUnmount", type: "function" },
  { label: "onWillDestroy", type: "function" },
  { label: "onError", type: "function" },

  // Other hooks
  { label: "useEffect", type: "function" },
  { label: "useListener", type: "function" },
  { label: "useApp", type: "function" },

  // Props
  { label: "props", type: "function" },

  // Plugins
  { label: "Plugin", type: "class" },
  { label: "plugin", type: "function" },
  { label: "providePlugins", type: "function" },
  { label: "config", type: "function" },

  // Resources and Registries
  { label: "Resource", type: "class" },
  { label: "useResource", type: "function" },
  { label: "Registry", type: "class" },

  // Type validation
  { label: "types", type: "variable" },
  { label: "validateType", type: "function" },
  { label: "assertType", type: "function" },

  // Utilities
  { label: "EventBus", type: "class" },
  { label: "markup", type: "function" },
  { label: "whenReady", type: "function" },
  { label: "useContext", type: "function" },
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

function getOwlImportChanges(doc, symbolName, cursorPos) {
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']@odoo\/owl["'];?/;
  const match = importRegex.exec(doc);

  if (match) {
    // Don't modify the import if the cursor is inside it (user is typing there)
    if (cursorPos >= match.index && cursorPos <= match.index + match[0].length) return null;

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
  if (word.from > 0 && doc[word.from - 1] === ".") return null;

  const insideComponent = isInsideComponentClass(doc, word.from);

  const options = [
    ...OWL_IMPORTS.map((item) => ({
      label: item.label,
      type: item.type,
      info: "OWL " + item.type,
      apply: (view, completion, from, to) => {
        const importChange = getOwlImportChanges(doc, item.label, from);
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
        const importChange = getOwlImportChanges(doc, item.importSymbol, from);

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

const syncTagRename = Annotation.define();

function xmlTagRename() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    if (update.transactions.some((tr) => tr.annotation(syncTagRename))) return;
    for (const tr of update.transactions) {
      if (!tr.docChanged) continue;
      const tree = syntaxTree(tr.startState);
      const mirrorChanges = [];
      tr.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
        let node = tree.resolveInner(fromA, 1);
        if (node.name !== "TagName") node = tree.resolveInner(fromA, -1);
        if (node.name !== "TagName") return;
        const tagNode = node.parent;
        if (!tagNode) return;
        const element = tagNode.parent;
        if (!element || element.name !== "Element") return;
        const isOpen = tagNode.name === "OpenTag";
        const isClose = tagNode.name === "CloseTag";
        if (!isOpen && !isClose) return;
        const pairTag = isOpen ? element.getChild("CloseTag") : element.getChild("OpenTag");
        if (!pairTag) return;
        const pairName = pairTag.getChild("TagName");
        if (!pairName) return;
        const oldName = tr.startState.sliceDoc(node.from, node.to);
        const newName =
          oldName.slice(0, fromA - node.from) +
          tr.newDoc.sliceString(fromB, toB) +
          oldName.slice(toA - node.from);
        mirrorChanges.push({
          from: tr.changes.mapPos(pairName.from),
          to: tr.changes.mapPos(pairName.to),
          insert: newName,
        });
      });
      if (mirrorChanges.length > 0) {
        update.view.dispatch({
          changes: mirrorChanges,
          annotations: syncTagRename.of(true),
        });
      }
    }
  });
}

export { createOwlCompletions, OWL_IMPORTS, OWL_SNIPPETS, parseMarkdown, SETUP_SNIPPET, xmlTagRename };
