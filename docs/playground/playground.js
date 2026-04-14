// src/playground.js
import {
  __info__ as __info__2,
  Component as Component2,
  computed as computed3,
  mount,
  onWillDestroy,
  onWillStart,
  plugin as plugin3,
  providePlugins,
  signal as signal3,
  useEffect as useEffect2
} from "../owl.js";

// src/components.js
import {
  __info__,
  Component,
  computed as computed2,
  onMounted,
  onPatched,
  onWillPatch,
  onWillUnmount,
  plugin as plugin2,
  props,
  signal as signal2,
  untrack,
  useEffect
} from "../owl.js";

// src/code_utils.js
import {
  Annotation,
  autocompletion,
  EditorView,
  snippet,
  syntaxTree
} from "./libs/codemirror.bundle.js";

// src/utils.js
function debounce(func, wait, immediate) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    function later() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    }
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}
var loadedScripts = {};
function loadJS(url) {
  if (url in loadedScripts) {
    return loadedScripts[url];
  }
  const promise = new Promise(function(resolve, reject) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = function() {
      resolve();
    };
    script.onerror = function() {
      reject(`Error loading file '${url}'`);
    };
    const head = document.head || document.getElementsByTagName("head")[0];
    head.appendChild(script);
  });
  loadedScripts[url] = promise;
  return promise;
}

// src/code_utils.js
var markedLoaded = null;
var highlightJsLoaded = null;
var markedHighlightLoaded = null;
var markedConfigured = false;
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
    getMarkedHighlight()
  ]);
  if (!markedConfigured) {
    markedConfigured = true;
    markedLib.use(
      markedHighlight.markedHighlight({
        highlight(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {
            }
          }
          try {
            return hljs.highlightAuto(code).value;
          } catch (e) {
          }
          return code;
        }
      })
    );
  }
  return markedLib.parse(content);
}
var OWL_IMPORTS = [
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
  { label: "useContext", type: "function" }
];
var OWL_SNIPPETS = [
  {
    label: "Component class",
    type: "snippet",
    info: "Create a new OWL component",
    template: 'class ${1:MyComponent} extends Component {\n  static template = "${2:template_name}";\n\n  setup() {\n    ${3}\n  }\n}',
    importSymbol: "Component"
  },
  {
    label: "Plugin class",
    type: "snippet",
    info: "Create a new OWL plugin",
    template: 'class ${1:MyPlugin} extends Plugin {\n  static id = "${2:myPlugin}";\n\n  setup() {\n    ${3}\n  }\n}',
    importSymbol: "Plugin"
  }
];
var SETUP_SNIPPET = {
  label: "setup",
  type: "snippet",
  info: "Add setup method to component",
  template: "setup() {\n  ${1}\n}"
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
    if (cursorPos >= match.index && cursorPos <= match.index + match[0].length) return null;
    const importsStr = match[1];
    const imports = importsStr.split(",").map((s) => s.trim()).filter(Boolean);
    if (imports.includes(symbolName)) return null;
    imports.push(symbolName);
    const newImport = `import { ${imports.join(", ")} } from "@odoo/owl";`;
    return { from: match.index, to: match.index + match[0].length, insert: newImport };
  } else {
    return { from: 0, to: 0, insert: `import { ${symbolName} } from "@odoo/owl";
` };
  }
}
function owlCompletionSource(context) {
  const word = context.matchBefore(/\w*/);
  if (!word || word.from === word.to && !context.explicit) return null;
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
      }
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
      }
    }))
  ];
  if (insideComponent) {
    options.push({
      label: SETUP_SNIPPET.label,
      type: SETUP_SNIPPET.type,
      info: SETUP_SNIPPET.info,
      apply: (view, completion, from, to) => {
        snippet(SETUP_SNIPPET.template)(view, completion, from, to);
      }
    });
  }
  return {
    from: word.from,
    options,
    validFor: /^\w*$/
  };
}
function createOwlCompletions() {
  return autocompletion({
    override: [owlCompletionSource],
    activateOnTyping: true,
    maxRenderedOptions: 50
  });
}
var syncTagRename = Annotation.define();
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
        const newName = oldName.slice(0, fromA - node.from) + tr.newDoc.sliceString(fromB, toB) + oldName.slice(toA - node.from);
        mirrorChanges.push({
          from: tr.changes.mapPos(pairName.from),
          to: tr.changes.mapPos(pairName.to),
          insert: newName
        });
      });
      if (mirrorChanges.length > 0) {
        update.view.dispatch({
          changes: mirrorChanges,
          annotations: syncTagRename.of(true)
        });
      }
    }
  });
}

// src/file_utils.js
import { css as cssLang, javascript, markdown, xml as xmlLang } from "./libs/codemirror.bundle.js";
var LANGUAGES = {
  js: () => javascript(),
  css: () => cssLang(),
  xml: () => xmlLang(),
  md: () => markdown()
};
var TAB_SIZES = { js: 4, css: 4, xml: 2, md: 2 };
var FILE_ICON_CLASSES = {
  js: "file-icon-js",
  xml: "file-icon-xml",
  css: "file-icon-css",
  md: "file-icon-md"
};
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function getFileType(name) {
  const ext = name.split(".").pop();
  return ext in LANGUAGES ? ext : "js";
}
function makeFileEntry(name) {
  const type = getFileType(name);
  return { name, type, iconClass: FILE_ICON_CLASSES[type] || "" };
}
function parseFilePaths(files) {
  const hiddenFiles = [".gitkeep"];
  function buildTree(fileList, prefix) {
    const folderMap = /* @__PURE__ */ new Map();
    const localFiles = [];
    for (const file of fileList) {
      const parts = file.name.split("/");
      if (parts.length === 1) {
        if (!hiddenFiles.includes(file.name)) {
          localFiles.push({ ...file, fullName: prefix + file.name });
        }
      } else {
        const folderName = parts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, []);
        }
        const rest = parts.slice(1).join("/");
        if (!hiddenFiles.includes(rest)) {
          folderMap.get(folderName).push({
            ...file,
            name: rest
          });
        }
      }
    }
    const folders = [...folderMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, children]) => {
      const folderPath = prefix + name;
      return [name, { path: folderPath, ...buildTree(children, folderPath + "/") }];
    });
    localFiles.sort((a, b) => a.name.localeCompare(b.name));
    return { folders, files: localFiles };
  }
  return buildTree(files, "");
}

// src/components.js
import {
  abbreviationTracker,
  acceptCompletion,
  basicSetup,
  Compartment,
  EditorState,
  EditorView as EditorView2,
  expandAbbreviation,
  indentLess,
  indentMore,
  indentUnit,
  keymap,
  oneDark,
  Prec
} from "./libs/codemirror.bundle.js";

// src/plugins.js
import { Plugin, computed, plugin, signal } from "../owl.js";

// src/samples.js
var HELLO_WORLD_JS = `import { Component, mount, xml } from "@odoo/owl";

class Root extends Component {
    static template = xml\`<div>Hello Owl!</div>\`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
`;
var EXAMPLES = [
  { id: "hello_world", category: "Examples", description: "Hello World", files: {} },
  {
    id: "simple_component",
    category: "Examples",
    description: "Simple component",
    files: { "main.js": "components/main.js", "main.css": "components/main.css" }
  },
  {
    id: "props_list",
    category: "Examples",
    description: "Props and list of components",
    files: {
      "main.js": "product_card/main.js",
      "main.css": "product_card/main.css",
      "product_card.js": "product_card/product_card.js",
      "product_card.xml": "product_card/product_card.xml"
    }
  },
  {
    id: "lifecycle",
    category: "Examples",
    description: "Component Lifecycle, hooks",
    files: {
      "readme.md": "lifecycle_demo/readme.md",
      "helpers.js": "lifecycle_demo/helpers.js",
      "chat_window.js": "lifecycle_demo/chat_window.js",
      "chat_window.xml": "lifecycle_demo/chat_window.xml",
      "main.js": "lifecycle_demo/main.js"
    }
  },
  {
    id: "reactivity",
    category: "Examples",
    description: "Signals, proxy, computed, effects",
    files: {
      "main.js": "reactivity/main.js",
      "shopping_cart.js": "reactivity/shopping_cart.js",
      "shopping_cart.xml": "reactivity/shopping_cart.xml"
    }
  },
  {
    id: "canvas",
    category: "Examples",
    description: "Accessing the DOM (t-ref)",
    files: { "main.js": "canvas/main.js" }
  },
  {
    id: "form",
    category: "Examples",
    description: "Form Controls (t-model)",
    files: { "main.js": "form/main.js", "main.xml": "form/main.xml" }
  },
  {
    id: "slots",
    category: "Examples",
    description: "Generic components (slots)",
    files: {
      "readme.md": "slots/readme.md",
      "dialog.css": "slots/dialog.css",
      "dialog.js": "slots/dialog.js",
      "dialog.xml": "slots/dialog.xml",
      "main.js": "slots/main.js"
    }
  },
  {
    id: "plugins",
    category: "Examples",
    description: "Coordinating code (Plugins)",
    files: {
      "readme.md": "plugins/readme.md",
      "core_plugins.js": "plugins/core_plugins.js",
      "form_view.js": "plugins/form_view.js",
      "main.js": "plugins/main.js"
    }
  },
  {
    id: "kanban_board",
    category: "Demos",
    description: "Kanban Board",
    files: {
      "main.js": "kanban_board/main.js",
      "main.xml": "kanban_board/main.xml",
      "main.css": "kanban_board/main.css"
    }
  },
  {
    id: "html_editor",
    category: "Demos",
    description: "HTML Editor",
    files: {
      "main.js": "html_editor/main.js",
      "main.css": "html_editor/main.css",
      "html_editor.js": "html_editor/html_editor/html_editor.js",
      "html_editor.xml": "html_editor/html_editor/html_editor.xml"
    }
  },
  {
    id: "web_client",
    category: "Demos",
    description: "Web Client",
    files: {
      "readme.md": "web_client/readme.md",
      "core/orm.js": "web_client/core/orm.js",
      "core/rpc.js": "web_client/core/rpc.js",
      "web_client/action_plugin.js": "web_client/web_client/action_plugin.js",
      "core/notification_plugin.js": "web_client/core/notification_plugin.js",
      "core/notification_container.js": "web_client/core/notification_container.js",
      "core/notification_container.css": "web_client/core/notification_container.css",
      "web_client/navbar.js": "web_client/web_client/navbar.js",
      "web_client/navbar.xml": "web_client/web_client/navbar.xml",
      "web_client/navbar.css": "web_client/web_client/navbar.css",
      "web_client/menu_plugin.js": "web_client/web_client/menu_plugin.js",
      "web_client/web_client.js": "web_client/web_client/web_client.js",
      "web_client/web_client.xml": "web_client/web_client/web_client.xml",
      "views/controlpanel.js": "web_client/views/controlpanel.js",
      "views/controlpanel.xml": "web_client/views/controlpanel.xml",
      "views/list_view.js": "web_client/views/list_view.js",
      "views/list_view.xml": "web_client/views/list_view.xml",
      "views/form_view.js": "web_client/views/form_view.js",
      "views/form_view.xml": "web_client/views/form_view.xml",
      "discuss/discuss.js": "web_client/discuss/discuss.js",
      "discuss/discuss.xml": "web_client/discuss/discuss.xml",
      "main.js": "web_client/main.js"
    }
  }
];
var TUTORIALS = [
  {
    id: "getting_started",
    name: "Getting Started",
    description: "Getting Started",
    summary: "Learn Owl fundamentals step by step",
    difficulty: 1,
    steps: [
      {
        title: "A simple counter",
        files: {
          "readme.md": "tutorials/getting_started/1/readme.md",
          "main.js": "tutorials/getting_started/1/main.js"
        },
        solution: {
          "main.js": "tutorials/getting_started/1/main_solution.js"
        }
      },
      {
        title: "Sub component",
        files: {
          "readme.md": "tutorials/getting_started/2/readme.md",
          "main.js": "tutorials/getting_started/1/main_solution.js"
        },
        solution: {
          "counter.js": "tutorials/getting_started/2/counter_solution.js",
          "counter.xml": "tutorials/getting_started/2/counter.xml",
          "counter.css": "tutorials/getting_started/2/counter.css",
          "main.js": "tutorials/getting_started/2/main.js"
        }
      },
      {
        title: "Props and props validation",
        files: {
          "readme.md": "tutorials/getting_started/3/readme.md",
          "main.js": "tutorials/getting_started/3/main.js"
        },
        solution: {
          "main.js": "tutorials/getting_started/3/main_solution.js",
          "product_card.js": "tutorials/getting_started/3/product_card.js",
          "product_card.css": "tutorials/getting_started/3/product_card.css"
        }
      },
      {
        title: "Signals, computed values and t-model",
        files: {
          "readme.md": "tutorials/getting_started/4/readme.md",
          "main.js": "tutorials/getting_started/4/main.js"
        },
        solution: {
          "main.js": "tutorials/getting_started/4/main_solution.js",
          "main.css": "tutorials/getting_started/4/main.css"
        }
      },
      {
        title: "Lifecycle hooks",
        files: {
          "readme.md": "tutorials/getting_started/5/readme.md",
          "main.js": "tutorials/getting_started/5/main.js"
        },
        solution: {
          "main.js": "tutorials/getting_started/5/main_solution.js",
          "timer.js": "tutorials/getting_started/5/timer.js",
          "timer.css": "tutorials/getting_started/5/timer.css"
        }
      }
    ]
  },
  {
    id: "todo_list",
    name: "Todo List",
    description: "Todo List",
    summary: "Build a complete todo app with Owl",
    difficulty: 2,
    steps: [
      {
        title: "Rendering a list of components",
        files: {
          "readme.md": "tutorials/todo_list/1/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/1/todo_list.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/1/todo_list.xml"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/1/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/1/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/1/todo_item.xml"
        }
      },
      {
        title: "Adding new Todos",
        files: {
          "readme.md": "tutorials/todo_list/2/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/1/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/1/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/1/todo_item.xml"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/2/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/2/todo_list_solution.xml"
        }
      },
      {
        title: "Styling the Todo List",
        files: {
          "readme.md": "tutorials/todo_list/3/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/2/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/2/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/1/todo_item.xml"
        },
        solution: {
          "todo_list/todo_list.xml": "tutorials/todo_list/3/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.xml": "tutorials/todo_list/3/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css"
        }
      },
      {
        title: "Focus the input",
        files: {
          "readme.md": "tutorials/todo_list/4/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/2/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/3/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/3/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/4/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        }
      },
      {
        title: "Toggle todo completion",
        files: {
          "readme.md": "tutorials/todo_list/5/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/4/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/3/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/5/todo_list_solution.js",
          "todo_list/todo_item.js": "tutorials/todo_list/5/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/5/todo_item_solution.xml"
        }
      },
      {
        title: "Reacting to data changes",
        files: {
          "readme.md": "tutorials/todo_list/6/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/5/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/5/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/5/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/6/todo_list_solution.js"
        }
      },
      {
        title: "Deleting todos",
        files: {
          "readme.md": "tutorials/todo_list/7/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/6/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/5/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/5/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/7/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/7/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/7/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/7/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css"
        }
      },
      {
        title: "Separating business logic from UI",
        files: {
          "readme.md": "tutorials/todo_list/8/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/7/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/7/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/7/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/7/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/8/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/8/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/8/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/8/todo_item_solution.xml",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/8/todo_list_plugin.js"
        }
      },
      {
        title: "Computed values",
        files: {
          "readme.md": "tutorials/todo_list/9/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/8/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/8/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/8/todo_list_plugin.js",
          "todo_list/todo_item.js": "tutorials/todo_list/8/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/8/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        },
        solution: {
          "todo_list/todo_list.xml": "tutorials/todo_list/9/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/9/todo_list.css",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/9/todo_list_plugin_solution.js"
        }
      },
      {
        title: "Persisting data",
        files: {
          "readme.md": "tutorials/todo_list/10/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/8/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/9/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/9/todo_list.css",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/9/todo_list_plugin_solution.js",
          "todo_list/todo_item.js": "tutorials/todo_list/8/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/8/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js"
        },
        solution: {
          "main.js": "tutorials/todo_list/10/main_solution.js",
          "todo_list/todo_list.js": "tutorials/todo_list/10/todo_list_solution.js",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/10/todo_list_plugin_solution.js",
          "storage_plugin.js": "tutorials/todo_list/10/storage_plugin.js"
        }
      }
    ]
  },
  {
    id: "hibou_os",
    name: "Hibou OS",
    description: "Hibou OS",
    summary: "Build a mini desktop environment",
    difficulty: 3,
    steps: [
      {
        title: "Setting the stage",
        files: {
          "readme.md": "tutorials/hibou_os/1/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/1/hibou.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou.xml"
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/1/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/1/taskbar.js",
          "core/taskbar.xml": "tutorials/hibou_os/1/taskbar.xml",
          "core/taskbar.css": "tutorials/hibou_os/1/taskbar.css"
        }
      },
      {
        title: "The System Tray Clock",
        files: {
          "readme.md": "tutorials/hibou_os/2/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/1/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/1/taskbar.js",
          "core/taskbar.xml": "tutorials/hibou_os/1/taskbar.xml",
          "core/taskbar.css": "tutorials/hibou_os/1/taskbar.css"
        },
        solution: {
          "core/taskbar.js": "tutorials/hibou_os/2/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/2/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml"
        }
      },
      {
        title: "The Window Component",
        files: {
          "readme.md": "tutorials/hibou_os/3/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/1/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/2/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/2/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml"
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/3/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/3/hibou_solution.xml",
          "core/window.js": "tutorials/hibou_os/3/window.js",
          "core/window.xml": "tutorials/hibou_os/3/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css"
        }
      },
      {
        title: "Opening a second window",
        files: {
          "readme.md": "tutorials/hibou_os/4/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/3/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/3/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/2/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/2/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
          "core/window.js": "tutorials/hibou_os/3/window.js",
          "core/window.xml": "tutorials/hibou_os/3/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css"
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/4/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/4/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/4/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/4/taskbar_solution.xml",
          "core/window.js": "tutorials/hibou_os/4/window.js",
          "core/window.xml": "tutorials/hibou_os/4/window.xml"
        }
      },
      {
        title: "The Window Manager Plugin",
        files: {
          "readme.md": "tutorials/hibou_os/5/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/4/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/4/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/4/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/4/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
          "core/window.js": "tutorials/hibou_os/4/window.js",
          "core/window.xml": "tutorials/hibou_os/4/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css"
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/5/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/5/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/5/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/5/taskbar_solution.xml",
          "core/window_manager_plugin.js": "tutorials/hibou_os/5/window_manager_plugin.js",
          "core/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/managed_window.xml": "tutorials/hibou_os/5/managed_window.xml",
          "core/hello_app.js": "tutorials/hibou_os/5/hello_app.js"
        }
      },
      {
        title: "Tidying up: extracting window logic",
        files: {
          "readme.md": "tutorials/hibou_os/6/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/5/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/5/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/5/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/5/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
          "core/window.js": "tutorials/hibou_os/4/window.js",
          "core/window.xml": "tutorials/hibou_os/4/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css",
          "core/window_manager_plugin.js": "tutorials/hibou_os/5/window_manager_plugin.js",
          "core/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/managed_window.xml": "tutorials/hibou_os/5/managed_window.xml",
          "core/hello_app.js": "tutorials/hibou_os/5/hello_app.js"
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/6/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/6/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/6/taskbar_solution.js",
          "core/window.js": null,
          "core/window.xml": null,
          "core/window.css": null,
          "core/window_manager_plugin.js": null,
          "core/managed_window.js": null,
          "core/managed_window.xml": null,
          "core/window/window.js": "tutorials/hibou_os/4/window.js",
          "core/window/window.xml": "tutorials/hibou_os/4/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/5/window_manager_plugin.js",
          "core/window/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/window/managed_window.xml": "tutorials/hibou_os/5/managed_window.xml",
          "core/window/window_manager.js": "tutorials/hibou_os/6/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/6/window_manager.xml"
        }
      },
      {
        title: "Tidying up: apps",
        files: {
          "readme.md": "tutorials/hibou_os/7/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/6/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/6/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/6/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/5/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
          "core/hello_app.js": "tutorials/hibou_os/5/hello_app.js",
          "core/window/window.js": "tutorials/hibou_os/4/window.js",
          "core/window/window.xml": "tutorials/hibou_os/4/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/5/window_manager_plugin.js",
          "core/window/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/window/managed_window.xml": "tutorials/hibou_os/5/managed_window.xml",
          "core/window/window_manager.js": "tutorials/hibou_os/6/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/6/window_manager.xml"
        },
        solution: {
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/7/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/clock.js": null,
          "core/clock.xml": null,
          "core/hello_app.js": null,
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/7/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/7/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        }
      },
      {
        title: "Window z-index management",
        files: {
          "readme.md": "tutorials/hibou_os/8/readme.md",
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/7/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/4/window.js",
          "core/window/window.xml": "tutorials/hibou_os/4/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/5/window_manager_plugin.js",
          "core/window/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/window/managed_window.xml": "tutorials/hibou_os/5/managed_window.xml",
          "core/window/window_manager.js": "tutorials/hibou_os/6/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/6/window_manager.xml",
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/7/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/7/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/8/window_manager_plugin.js",
          "core/window/window.js": "tutorials/hibou_os/8/window.js",
          "core/window/window.xml": "tutorials/hibou_os/8/window.xml",
          "core/window/managed_window.xml": "tutorials/hibou_os/8/managed_window.xml"
        }
      },
      {
        title: "Simplifying: merging window components",
        files: {
          "readme.md": "tutorials/hibou_os/9/readme.md",
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/7/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/8/window.js",
          "core/window/window.xml": "tutorials/hibou_os/8/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/8/window_manager_plugin.js",
          "core/window/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/window/managed_window.xml": "tutorials/hibou_os/8/managed_window.xml",
          "core/window/window_manager.js": "tutorials/hibou_os/6/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/6/window_manager.xml",
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/7/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/7/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "core/window/window.js": "tutorials/hibou_os/9/window.js",
          "core/window/window.xml": "tutorials/hibou_os/9/window.xml",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/9/window_manager.xml",
          "core/window/managed_window.js": null,
          "core/window/managed_window.xml": null
        }
      },
      {
        title: "Dragging windows",
        files: {
          "readme.md": "tutorials/hibou_os/10/readme.md",
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/7/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/9/window.js",
          "core/window/window.xml": "tutorials/hibou_os/9/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/8/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/9/window_manager.xml",
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/7/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/7/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/10/window_manager_plugin.js",
          "core/window/window.js": "tutorials/hibou_os/10/window.js",
          "core/window/window.xml": "tutorials/hibou_os/10/window.xml"
        }
      },
      {
        title: "Reusable drag and drop",
        files: {
          "readme.md": "tutorials/hibou_os/11/readme.md",
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/7/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/10/window.js",
          "core/window/window.xml": "tutorials/hibou_os/10/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/10/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/9/window_manager.xml",
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/7/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/7/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "core/window/window.js": "tutorials/hibou_os/11/window.js",
          "core/window/window.xml": "tutorials/hibou_os/11/window.xml",
          "core/utils/drag_and_drop.js": "tutorials/hibou_os/11/drag_and_drop.js"
        }
      },
      {
        title: "App plugins and validation",
        files: {
          "readme.md": "tutorials/hibou_os/12/readme.md",
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/7/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/11/window.js",
          "core/window/window.xml": "tutorials/hibou_os/11/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/10/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/9/window_manager.xml",
          "core/utils/drag_and_drop.js": "tutorials/hibou_os/11/drag_and_drop.js",
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/7/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/7/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/12/hibou_solution.js",
          "apps/notepad/index.js": "tutorials/hibou_os/12/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/12/notepad_app.js",
          "apps/notepad/notepad_plugin.js": "tutorials/hibou_os/12/notepad_plugin.js"
        }
      },
      {
        title: "Registries: the key to extensibility",
        files: {
          "readme.md": "tutorials/hibou_os/13/readme.md",
          "main.js": "tutorials/hibou_os/7/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/12/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/7/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/7/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/7/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/11/window.js",
          "core/window/window.xml": "tutorials/hibou_os/11/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/10/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/9/window_manager.xml",
          "core/utils/drag_and_drop.js": "tutorials/hibou_os/11/drag_and_drop.js",
          "apps/clock/index.js": "tutorials/hibou_os/7/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/12/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/12/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/notepad/notepad_plugin.js": "tutorials/hibou_os/12/notepad_plugin.js",
          "apps/calculator/index.js": "tutorials/hibou_os/7/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "main.js": "tutorials/hibou_os/13/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/13/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/13/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/13/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/13/taskbar_solution.xml",
          "core/registries.js": "tutorials/hibou_os/13/registries.js",
          "apps/clock/index.js": "tutorials/hibou_os/13/clock_index.js",
          "apps/notepad/index.js": "tutorials/hibou_os/13/notepad_index.js",
          "apps/calculator/index.js": "tutorials/hibou_os/13/calculator_index.js"
        }
      },
      {
        title: "A browser app",
        files: {
          "readme.md": "tutorials/hibou_os/14/readme.md",
          "main.js": "tutorials/hibou_os/13/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/13/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/13/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/registries.js": "tutorials/hibou_os/13/registries.js",
          "core/taskbar.js": "tutorials/hibou_os/13/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/13/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/11/window.js",
          "core/window/window.xml": "tutorials/hibou_os/11/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/10/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/9/window_manager.xml",
          "core/utils/drag_and_drop.js": "tutorials/hibou_os/11/drag_and_drop.js",
          "apps/clock/index.js": "tutorials/hibou_os/13/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/13/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/12/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/notepad/notepad_plugin.js": "tutorials/hibou_os/12/notepad_plugin.js",
          "apps/calculator/index.js": "tutorials/hibou_os/13/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css"
        },
        solution: {
          "main.js": "tutorials/hibou_os/14/main_solution.js",
          "core/registries.js": "tutorials/hibou_os/14/registries.js",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/14/window_manager_plugin.js",
          "core/window/window.js": "tutorials/hibou_os/14/window.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/14/window_manager.xml",
          "core/taskbar.xml": "tutorials/hibou_os/14/taskbar_solution.xml",
          "apps/browser/index.js": "tutorials/hibou_os/14/browser_index.js",
          "apps/browser/browser_app.js": "tutorials/hibou_os/14/browser_app.js",
          "apps/browser/browser_app.css": "tutorials/hibou_os/14/browser_app.css"
        }
      },
      {
        title: "Multiple workspaces",
        files: {
          "readme.md": "tutorials/hibou_os/15/readme.md",
          "main.js": "tutorials/hibou_os/14/main_solution.js",
          "core/hibou.js": "tutorials/hibou_os/13/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/13/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/registries.js": "tutorials/hibou_os/14/registries.js",
          "core/taskbar.js": "tutorials/hibou_os/13/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/14/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/window/window.js": "tutorials/hibou_os/14/window.js",
          "core/window/window.xml": "tutorials/hibou_os/11/window.xml",
          "core/window/window.css": "tutorials/hibou_os/3/window.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/14/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/9/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/14/window_manager.xml",
          "core/utils/drag_and_drop.js": "tutorials/hibou_os/11/drag_and_drop.js",
          "apps/clock/index.js": "tutorials/hibou_os/13/clock_index.js",
          "apps/clock/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
          "apps/clock/clock_systray.js": "tutorials/hibou_os/2/clock.js",
          "apps/clock/clock_systray.xml": "tutorials/hibou_os/2/clock.xml",
          "apps/notepad/index.js": "tutorials/hibou_os/13/notepad_index.js",
          "apps/notepad/notepad_app.js": "tutorials/hibou_os/12/notepad_app.js",
          "apps/notepad/notepad_app.css": "tutorials/hibou_os/7/notepad_app.css",
          "apps/notepad/notepad_plugin.js": "tutorials/hibou_os/12/notepad_plugin.js",
          "apps/calculator/index.js": "tutorials/hibou_os/13/calculator_index.js",
          "apps/calculator/calculator_app.js": "tutorials/hibou_os/7/calculator_app.js",
          "apps/calculator/calculator_app.css": "tutorials/hibou_os/7/calculator_app.css",
          "apps/browser/index.js": "tutorials/hibou_os/14/browser_index.js",
          "apps/browser/browser_app.js": "tutorials/hibou_os/14/browser_app.js",
          "apps/browser/browser_app.css": "tutorials/hibou_os/14/browser_app.css"
        },
        solution: {
          "core/taskbar.js": "tutorials/hibou_os/15/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/15/taskbar_solution.xml",
          "core/workspace_switcher.js": "tutorials/hibou_os/15/workspace_switcher.js",
          "core/workspace_switcher.xml": "tutorials/hibou_os/15/workspace_switcher.xml",
          "core/workspace_switcher.css": "tutorials/hibou_os/15/workspace_switcher.css",
          "core/window/window_manager_plugin.js": "tutorials/hibou_os/15/window_manager_plugin.js",
          "core/window/window_manager.js": "tutorials/hibou_os/15/window_manager.js",
          "core/window/window_manager.xml": "tutorials/hibou_os/15/window_manager.xml",
          "core/window/window_manager.css": "tutorials/hibou_os/15/window_manager.css"
        }
      }
    ]
  }
];
var fileCache = {};
var loadFile = (path) => {
  if (!(path in fileCache)) {
    fileCache[path] = fetch(path).then((result) => {
      if (!result.ok) {
        throw new Error("Error while fetching xml templates");
      }
      return result.text();
    });
  }
  return fileCache[path];
};
async function loadFilesFromMapping(fileMapping) {
  const entries = await Promise.all(
    Object.entries(fileMapping).map(async ([playgroundName, actualPath]) => {
      if (actualPath === null) {
        return [playgroundName, null];
      }
      try {
        const content = await loadFile(`./samples/${actualPath}`);
        return [playgroundName, content];
      } catch {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
}

// src/plugins.js
var CodePlugin = class extends Plugin {
  static id = "code";
  files = signal([]);
  contents = signal({});
  primaryFile = signal("");
  secondaryFile = signal("");
  activePane = signal("primary");
  splitMode = signal(false);
  splitRatio = signal(0.6);
  contentVersion = signal(0);
  runCode = signal(null);
  modifiedFiles = signal(/* @__PURE__ */ new Set());
  markdownPreviewMode = signal({});
  focusRequest = signal(0);
  currentFile = computed(
    () => this.activePane() === "primary" ? this.primaryFile() : this.secondaryFile()
  );
  currentFileName = computed(() => this.currentFile());
  requestFocus() {
    this.focusRequest.set(this.focusRequest() + 1);
  }
  isMarkdownFile(fileName) {
    return getFileType(fileName) === "md";
  }
  isMarkdownPreview(fileName) {
    if (!this.isMarkdownFile(fileName)) return false;
    const mode = this.markdownPreviewMode()[fileName];
    if (mode !== void 0) return mode;
    const content = this.getContent(fileName);
    return content.trim() !== "";
  }
  setMarkdownPreviewMode(fileName, preview) {
    const current = this.markdownPreviewMode();
    this.markdownPreviewMode.set({ ...current, [fileName]: preview });
  }
  toggleMarkdownPreview(fileName) {
    const current = this.isMarkdownPreview(fileName);
    this.setMarkdownPreviewMode(fileName, !current);
  }
  getContent(fileName) {
    return this.contents()[fileName] || "";
  }
  setContent(fileName, value) {
    this.contents.set({ ...this.contents(), [fileName]: value });
    const modified = new Set(this.modifiedFiles());
    modified.add(fileName);
    this.modifiedFiles.set(modified);
  }
  loadFiles(fileNames, contents, editorState = null, options = {}) {
    const { preserveRunCode = false } = options;
    const sorted = [...fileNames].sort((a, b) => a.localeCompare(b));
    this.files.set(sorted.map(makeFileEntry));
    this.contents.set({ ...contents });
    if (editorState) {
      const valid = (n) => sorted.includes(n);
      this.primaryFile.set(
        valid(editorState.primaryFile) ? editorState.primaryFile : sorted[0] || ""
      );
      this.secondaryFile.set(
        valid(editorState.secondaryFile) ? editorState.secondaryFile : sorted[1] || sorted[0] || ""
      );
      this.activePane.set(editorState.activePane || "primary");
      this.splitMode.set(editorState.splitMode || false);
      this.splitRatio.set(editorState.splitRatio ?? 0.6);
    } else {
      const defaultFile = fileNames.includes("main.js") ? "main.js" : sorted[0] || "";
      this.primaryFile.set(defaultFile);
      this.secondaryFile.set(sorted.find((n) => n !== defaultFile) || defaultFile);
      this.activePane.set("primary");
      this.splitMode.set(false);
      this.splitRatio.set(0.6);
    }
    if (!preserveRunCode) {
      this.runCode.set(null);
    }
    this.contentVersion.set(this.contentVersion() + 1);
    this.modifiedFiles.set(/* @__PURE__ */ new Set());
  }
  getSnapshot() {
    return { ...this.contents() };
  }
  getEditorState() {
    return {
      splitMode: this.splitMode(),
      primaryFile: this.primaryFile(),
      secondaryFile: this.secondaryFile(),
      activePane: this.activePane(),
      splitRatio: this.splitRatio()
    };
  }
  selectFile(fileName) {
    if (this.activePane() === "primary") {
      this.primaryFile.set(fileName);
    } else {
      this.secondaryFile.set(fileName);
    }
  }
  addFile(fileName, select = true) {
    const type = getFileType(fileName);
    const defaultContent = type === "xml" ? "<templates>\n</templates>" : "";
    const files = [...this.files(), makeFileEntry(fileName)].sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    this.files.set(files);
    this.contents.set({ ...this.contents(), [fileName]: defaultContent });
    if (select) {
      this.selectFile(fileName);
    }
    const modified = new Set(this.modifiedFiles());
    modified.add(fileName);
    this.modifiedFiles.set(modified);
  }
  renameFile(oldName, newName) {
    const contents = { ...this.contents() };
    contents[newName] = contents[oldName];
    delete contents[oldName];
    const files = Object.keys(contents).sort().map(makeFileEntry);
    this.files.set(files);
    this.contents.set(contents);
    if (this.primaryFile() === oldName) this.primaryFile.set(newName);
    if (this.secondaryFile() === oldName) this.secondaryFile.set(newName);
    const modified = new Set(this.modifiedFiles());
    if (modified.has(oldName)) {
      modified.delete(oldName);
      modified.add(newName);
    } else {
      modified.add(newName);
    }
    this.modifiedFiles.set(modified);
  }
  deleteFile(fileName) {
    const contents = { ...this.contents() };
    delete contents[fileName];
    const files = Object.keys(contents).sort().map(makeFileEntry);
    this.files.set(files);
    this.contents.set(contents);
    const first = files[0]?.name || "";
    if (this.primaryFile() === fileName) this.primaryFile.set(first);
    if (this.secondaryFile() === fileName) this.secondaryFile.set(first);
    const modified = new Set(this.modifiedFiles());
    modified.delete(fileName);
    this.modifiedFiles.set(modified);
  }
  toggleSplit(targetFile = null) {
    const split = !this.splitMode();
    this.splitMode.set(split);
    if (split) {
      const files = this.files();
      const primary = this.primaryFile();
      this.secondaryFile.set(primary);
    } else {
      this.activePane.set("primary");
    }
  }
  run() {
    const snapshot = this.contents();
    const fileList = this.files();
    const jsFiles = {};
    let css = "";
    let xml = "";
    for (const f of fileList) {
      const content = snapshot[f.name] || "";
      if (f.type === "js") {
        jsFiles[f.name] = content;
      } else if (f.type === "css") {
        css += content + "\n";
      } else if (f.type === "xml") {
        const inner = content.replace(/<\/?templates>/g, "").trim();
        if (inner) xml += inner + "\n";
      }
    }
    xml = `<templates>
${xml}</templates>`;
    this.runCode.set({ jsFiles, css, xml });
  }
};
var TemplatePlugin = class extends Plugin {
  static id = "templates";
  examples = [];
  tutorials = [];
  list = [];
  categories = [];
  setup() {
    this.examples = EXAMPLES.map((example) => ({
      ...example,
      code: Object.keys(example.files).length === 0 ? () => Promise.resolve({ "main.js": HELLO_WORLD_JS }) : () => loadFilesFromMapping(example.files)
    }));
    this.tutorials = TUTORIALS.map((tutorial) => ({
      ...tutorial,
      isTutorial: true
    }));
    this.list = [...this.examples, ...this.tutorials];
    this.categories = [];
    for (const tmpl of this.examples) {
      let cat = this.categories.find((c) => c.name === tmpl.category);
      if (!cat) {
        cat = { name: tmpl.category, templates: [] };
        this.categories.push(cat);
      }
      cat.templates.push(tmpl);
    }
  }
  async openTutorial(tutorial) {
    const { steps, name, description, id: tutorialId } = tutorial;
    const project = this.__owl__.plugins["project"];
    const code = this.__owl__.plugins["code"];
    const stepsWithContent = await Promise.all(
      steps.map(async (step) => ({
        title: step.title,
        files: await loadFilesFromMapping(step.files),
        solution: step.solution ? await loadFilesFromMapping(step.solution) : null
      }))
    );
    const validSteps = stepsWithContent.filter((step) => Object.keys(step.files).length > 0);
    if (validSteps.length === 0) return;
    const projects = project.projects();
    const activeProject = project.activeProject();
    if (projects.length === 1 && activeProject && !project.isProjectDirty(activeProject)) {
      project.deleteProject(activeProject.id, true);
    }
    const projectId = project.createTutorialProject(
      name || description,
      validSteps,
      description,
      tutorialId
    );
    if (projectId) {
      const readmeFile = "readme.md";
      const proj = project.projects().find((p) => p.id === projectId);
      if (proj && proj.fileNames.includes(readmeFile)) {
        code.selectFile(readmeFile);
      }
    }
  }
};
var ProjectPlugin = class extends Plugin {
  static id = "project";
  code = plugin(CodePlugin);
  templates = plugin(TemplatePlugin);
  projects = signal([]);
  activeProjectId = signal(null);
  collapsedProjects = signal(/* @__PURE__ */ new Set());
  ranProjects = /* @__PURE__ */ new Set();
  tutorialCurrentStepSignal = signal(0);
  activeProject = computed(() => {
    const id = this.activeProjectId();
    return this.projects().find((p) => p.id === id) || null;
  });
  visibleProjects = computed(() => {
    return this.projects().filter((p) => p.visible !== false).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  });
  isTutorialProject = computed(() => {
    const project = this.activeProject();
    return project && project.tutorial === true;
  });
  tutorialName = computed(() => {
    const project = this.activeProject();
    return project && project.tutorial ? project.name : "";
  });
  tutorialStepCount = computed(() => {
    const project = this.activeProject();
    return project && project.steps ? project.steps.length : 0;
  });
  tutorialCurrentStep = computed(() => this.tutorialCurrentStepSignal());
  tutorialCurrentStepTitle = computed(() => {
    const project = this.activeProject();
    const stepIndex = this.tutorialCurrentStepSignal();
    if (!project || !project.tutorial || !project.steps) return "";
    const step = project.steps[stepIndex];
    return step ? step.title || "" : "";
  });
  tutorialSteps = computed(() => {
    const project = this.activeProject();
    if (!project || !project.tutorial || !project.steps) return [];
    return project.steps;
  });
  isProjectExpanded(projId) {
    return !this.collapsedProjects().has(projId);
  }
  toggleProjectExpanded(projId) {
    const set = new Set(this.collapsedProjects());
    if (set.has(projId)) set.delete(projId);
    else set.add(projId);
    this.collapsedProjects.set(set);
  }
  expandProject(projId) {
    const set = new Set(this.collapsedProjects());
    set.delete(projId);
    this.collapsedProjects.set(set);
  }
  collapseProject(projId) {
    const set = new Set(this.collapsedProjects());
    set.add(projId);
    this.collapsedProjects.set(set);
  }
  collapseProjects(projectIds) {
    const set = new Set(this.collapsedProjects());
    for (const id of projectIds) set.add(id);
    this.collapsedProjects.set(set);
  }
  createProject(name, fileNames, contents, templateDesc = null, description = "") {
    this._saveCurrentProject();
    const projects = this.projects();
    const project = {
      id: generateId(),
      name,
      description,
      fileNames,
      files: { ...contents },
      originalFiles: { ...contents },
      templateDesc,
      visible: true,
      lastUpdate: Date.now(),
      sequence: projects.length
    };
    this.projects.set([...projects, project]);
    this.activeProjectId.set(project.id);
    this.code.loadFiles(fileNames, contents);
    return project.id;
  }
  createProjects(projectSpecs) {
    this._saveCurrentProject();
    const projects = this.projects();
    const startIndex = projects.length;
    const ids = [];
    const now = Date.now();
    for (const spec of projectSpecs) {
      const project = {
        id: generateId(),
        name: spec.name,
        description: spec.description,
        fileNames: spec.fileNames,
        files: { ...spec.contents },
        originalFiles: { ...spec.contents },
        templateDesc: spec.templateDesc,
        visible: true,
        lastUpdate: now,
        sequence: startIndex + ids.length
      };
      projects.push(project);
      ids.push(project.id);
    }
    this.projects.set([...projects]);
    this.activeProjectId.set(ids[0]);
    this.code.loadFiles(projectSpecs[0].fileNames, projectSpecs[0].contents);
    return ids;
  }
  markProjectAsRun(id) {
    this.ranProjects.add(id);
  }
  switchProject(id) {
    if (id === this.activeProjectId()) return;
    this._saveCurrentProject();
    this.activeProjectId.set(id);
    const project = this.projects().find((p) => p.id === id);
    this.code.loadFiles(project.fileNames, project.files, project.editorState);
    if (project.tutorial && project.currentStep !== void 0) {
      this.tutorialCurrentStepSignal.set(project.currentStep);
    }
    if (this.ranProjects.has(id)) {
      this.code.run();
    }
  }
  renameProject(id, name) {
    const projects = this.projects();
    const project = projects.find((p) => p.id === id);
    if (project) {
      project.name = name;
      project.lastUpdate = Date.now();
      this.projects.set([...projects]);
    }
  }
  deleteProject(id, force = false) {
    const current = this.projects();
    if (!force && current.length <= 1) return;
    const filtered = current.filter((p) => p.id !== id);
    filtered.forEach((p, i) => p.sequence = i);
    this.projects.set(filtered);
    if (this.activeProjectId() === id && filtered.length > 0) {
      const first = this.projects()[0];
      this.activeProjectId.set(first.id);
      this.code.loadFiles(first.fileNames, first.files, first.editorState);
    }
  }
  setVisibility(id, visible) {
    const project = this.projects().find((p) => p.id === id);
    if (project) {
      project.visible = visible;
      this.projects.set([...this.projects()]);
    }
  }
  reorderProjects(draggedId, targetId) {
    const projects = this.projects();
    const draggedIdx = projects.findIndex((p) => p.id === draggedId);
    const targetIdx = projects.findIndex((p) => p.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const [dragged] = projects.splice(draggedIdx, 1);
    projects.splice(targetIdx, 0, dragged);
    projects.forEach((p, i) => p.sequence = i);
    this.projects.set([...projects]);
  }
  addFileToProject(fileName, select = true) {
    const project = this.activeProject();
    if (project) {
      project.fileNames = [...project.fileNames, fileName];
    }
    this.code.addFile(fileName, select);
  }
  renameFileInProject(oldName, newName) {
    const project = this.activeProject();
    if (project) {
      project.fileNames = project.fileNames.map((n) => n === oldName ? newName : n);
      if (project.files[oldName] !== void 0) {
        project.files[newName] = project.files[oldName];
        delete project.files[oldName];
      }
      if (project.originalFiles[oldName] !== void 0) {
        project.originalFiles[newName] = project.originalFiles[oldName];
        delete project.originalFiles[oldName];
      }
    }
    this.code.renameFile(oldName, newName);
  }
  deleteFileFromProject(fileName) {
    const project = this.activeProject();
    if (project) {
      project.fileNames = project.fileNames.filter((n) => n !== fileName);
      delete project.files[fileName];
      delete project.originalFiles[fileName];
    }
    this.code.deleteFile(fileName);
  }
  applyTemplate(fileNames, contents, templateDesc = null) {
    const project = this.activeProject();
    if (project) {
      project.fileNames = fileNames;
      project.files = { ...contents };
      project.originalFiles = { ...contents };
      project.templateDesc = templateDesc;
    }
    this.code.loadFiles(fileNames, contents);
  }
  isCurrentProjectDirty() {
    const project = this.activeProject();
    if (!project || !project.originalFiles) return true;
    const snapshot = this.code.getSnapshot();
    const original = project.originalFiles;
    return this._isFilesDifferent(snapshot, original);
  }
  isProjectDirty(project) {
    if (!project) return false;
    if (project.tutorial) {
      if (project.id === this.activeProjectId()) {
        const currentFiles = this.code.getSnapshot();
        const stepIndex = this.tutorialCurrentStepSignal();
        const savedFiles = project.stepModifiedFiles?.[stepIndex] || project.steps[stepIndex].files;
        return this._isFilesDifferent(currentFiles, savedFiles);
      }
      return false;
    }
    if (!project.originalFiles) return false;
    let current;
    if (project.id === this.activeProjectId()) {
      current = this.code.getSnapshot();
    } else {
      current = project.files || {};
    }
    return this._isFilesDifferent(current, project.originalFiles);
  }
  markProjectClean(project) {
    if (project.id === this.activeProjectId()) {
      project.files = this.code.getSnapshot();
    }
    if (project.tutorial) {
      const currentStepIndex = this.tutorialCurrentStepSignal();
      if (!project.stepModifiedFiles) {
        project.stepModifiedFiles = [];
      }
      project.stepModifiedFiles[currentStepIndex] = { ...project.files };
    } else {
      project.originalFiles = { ...project.files };
    }
    this.projects.set([...this.projects()]);
  }
  markProjectDirty(projectId) {
    const project = this.projects().find((p) => p.id === projectId);
    if (project) {
      project.originalFiles = {};
      this.projects.set([...this.projects()]);
    }
  }
  _saveCurrentProject() {
    const project = this.activeProject();
    if (project) {
      project.files = this.code.getSnapshot();
      project.editorState = this.code.getEditorState();
      project.lastUpdate = Date.now();
    }
  }
  serialize() {
    this._saveCurrentProject();
    return {
      projects: this.projects().map((p) => ({ ...p, files: { ...p.files } })),
      activeProjectId: this.activeProjectId()
    };
  }
  restore(data) {
    this.projects.set(data.projects || []);
    const activeId = data.activeProjectId;
    const project = (data.projects || []).find((p) => p.id === activeId);
    if (project) {
      this.activeProjectId.set(activeId);
      if (project.tutorial && project.currentStep !== void 0) {
        this.tutorialCurrentStepSignal.set(project.currentStep);
      }
      this.code.loadFiles(project.fileNames, project.files, project.editorState);
    }
  }
  createTutorialProject(name, steps, templateDesc = null, tutorialId = null) {
    this._saveCurrentProject();
    const projects = this.projects();
    if (steps.length === 0) return null;
    const firstStep = steps[0];
    const fileNames = Object.keys(firstStep.files);
    const project = {
      id: generateId(),
      name,
      fileNames,
      files: { ...firstStep.files },
      originalFiles: { ...firstStep.files },
      templateDesc,
      visible: true,
      lastUpdate: Date.now(),
      sequence: projects.length,
      tutorial: true,
      tutorialId,
      steps: steps.map((step) => ({
        title: step.title,
        files: { ...step.files },
        solution: step.solution ? { ...step.solution } : null
      })),
      stepModifiedFiles: [],
      currentStep: 0
    };
    this.projects.set([...projects, project]);
    this.activeProjectId.set(project.id);
    this.tutorialCurrentStepSignal.set(0);
    this.code.loadFiles(fileNames, firstStep.files);
    return project.id;
  }
  _saveTutorialStepModifications() {
    const project = this.activeProject();
    if (!project || !project.tutorial) return;
    const currentStepIndex = this.tutorialCurrentStepSignal();
    const currentFiles = this.code.getSnapshot();
    const stepOriginal = project.steps[currentStepIndex].files;
    const isDirty = this._isFilesDifferent(currentFiles, stepOriginal);
    if (!project.stepModifiedFiles) {
      project.stepModifiedFiles = [];
    }
    if (isDirty) {
      project.stepModifiedFiles[currentStepIndex] = { ...currentFiles };
    } else {
      delete project.stepModifiedFiles[currentStepIndex];
    }
    this.projects.set([...this.projects()]);
  }
  _isFilesDifferent(files1, files2) {
    const keys1 = Object.keys(files1);
    const keys2 = Object.keys(files2);
    if (keys1.length !== keys2.length) return true;
    const allKeys = /* @__PURE__ */ new Set([...keys1, ...keys2]);
    if (allKeys.size !== keys1.length) return true;
    for (const key of allKeys) {
      if ((files1[key] || "") !== (files2[key] || "")) return true;
    }
    return false;
  }
  isCurrentTutorialStepDirty = computed(() => {
    const project = this.activeProject();
    if (!project || !project.tutorial) return false;
    this.code.contents();
    const stepIndex = this.tutorialCurrentStepSignal();
    const stepOriginal = project.steps[stepIndex].files;
    const currentFiles = this.code.getSnapshot();
    return this._isFilesDifferent(currentFiles, stepOriginal);
  });
  hasCurrentStepSolution() {
    const project = this.activeProject();
    if (!project || !project.tutorial) return false;
    const stepIndex = this.tutorialCurrentStepSignal();
    const step = project.steps[stepIndex];
    return step && step.solution && Object.keys(step.solution).length > 0;
  }
  matchesCurrentStepSolution = computed(() => {
    const project = this.activeProject();
    if (!project || !project.tutorial) return false;
    const stepIndex = this.tutorialCurrentStepSignal();
    const step = project.steps[stepIndex];
    if (!step || !step.solution) return false;
    this.code.contents();
    const currentFiles = this.code.getSnapshot();
    for (const key of Object.keys(step.solution)) {
      if ((currentFiles[key] || "") !== (step.solution[key] || "")) {
        return false;
      }
    }
    return true;
  });
  solveTutorialStep() {
    const project = this.activeProject();
    if (!project || !project.tutorial) return;
    const stepIndex = this.tutorialCurrentStepSignal();
    const step = project.steps[stepIndex];
    if (!step || !step.solution) return;
    const currentPrimary = this.code.primaryFile();
    const currentSecondary = this.code.secondaryFile();
    const currentSplit = this.code.splitMode();
    const wasRunning = this.code.runCode() !== null;
    const solutionFiles = step.solution;
    const filesToRemove = [];
    for (const [key, value] of Object.entries(solutionFiles)) {
      if (value === null) {
        filesToRemove.push(key);
        delete project.files[key];
      } else {
        project.files[key] = value;
      }
    }
    const allNames = [.../* @__PURE__ */ new Set([...project.fileNames, ...Object.keys(solutionFiles)])];
    project.fileNames = allNames.filter((name) => !filesToRemove.includes(name));
    if (project.stepModifiedFiles) {
      delete project.stepModifiedFiles[stepIndex];
    }
    this.projects.set([...this.projects()]);
    this.code.loadFiles(project.fileNames, project.files, null, { preserveRunCode: true });
    if (wasRunning) {
      this.code.run();
    }
    if (project.fileNames.includes(currentPrimary)) {
      this.code.primaryFile.set(currentPrimary);
    }
    if (currentSplit && project.fileNames.includes(currentSecondary)) {
      this.code.secondaryFile.set(currentSecondary);
    }
  }
  setTutorialStep(stepIndex) {
    const project = this.activeProject();
    if (!project || !project.tutorial) return;
    if (stepIndex < 0 || stepIndex >= project.steps.length) return;
    this._saveTutorialStepModifications();
    const currentPrimary = this.code.primaryFile();
    const currentSecondary = this.code.secondaryFile();
    const currentSplit = this.code.splitMode();
    const wasRunning = this.code.runCode() !== null;
    const step = project.steps[stepIndex];
    const modifiedFiles = project.stepModifiedFiles?.[stepIndex];
    const filesToLoad = modifiedFiles || step.files;
    project.files = { ...filesToLoad };
    project.fileNames = Object.keys(filesToLoad);
    project.currentStep = stepIndex;
    this.code.loadFiles(project.fileNames, filesToLoad, null, { preserveRunCode: true });
    if (wasRunning) {
      this.code.run();
    }
    this.tutorialCurrentStepSignal.set(stepIndex);
    this.projects.set([...this.projects()]);
    const newFileNames = project.fileNames;
    if (newFileNames.includes(currentPrimary)) {
      this.code.primaryFile.set(currentPrimary);
    }
    if (currentSplit && newFileNames.includes(currentSecondary)) {
      this.code.secondaryFile.set(currentSecondary);
    }
  }
  nextTutorialStep() {
    const project = this.activeProject();
    if (!project || !project.tutorial) return;
    const nextStep = this.tutorialCurrentStepSignal() + 1;
    if (nextStep < project.steps.length) {
      this.setTutorialStep(nextStep);
    }
  }
  prevTutorialStep() {
    const project = this.activeProject();
    if (!project || !project.tutorial) return;
    const prevStep = this.tutorialCurrentStepSignal() - 1;
    if (prevStep >= 0) {
      this.setTutorialStep(prevStep);
    }
  }
  canGoToNextStep = computed(() => {
    const project = this.activeProject();
    if (!project || !project.tutorial) return false;
    return this.tutorialCurrentStepSignal() < project.steps.length - 1;
  });
  canGoToPrevStep = computed(() => {
    const project = this.activeProject();
    if (!project || !project.tutorial) return false;
    return this.tutorialCurrentStepSignal() > 0;
  });
  resetTutorialStep() {
    const project = this.activeProject();
    if (!project || !project.tutorial) return;
    const stepIndex = this.tutorialCurrentStepSignal();
    const step = project.steps[stepIndex];
    if (!step) return;
    if (project.stepModifiedFiles) {
      delete project.stepModifiedFiles[stepIndex];
    }
    const currentPrimary = this.code.primaryFile();
    const currentSecondary = this.code.secondaryFile();
    const currentSplit = this.code.splitMode();
    const wasRunning = this.code.runCode() !== null;
    project.files = { ...step.files };
    project.fileNames = Object.keys(step.files);
    this.code.loadFiles(project.fileNames, step.files, null, { preserveRunCode: true });
    if (wasRunning) {
      this.code.run();
    }
    this.projects.set([...this.projects()]);
    const newFileNames = project.fileNames;
    if (newFileNames.includes(currentPrimary)) {
      this.code.primaryFile.set(currentPrimary);
    }
    if (currentSplit && newFileNames.includes(currentSecondary)) {
      this.code.secondaryFile.set(currentSecondary);
    }
  }
};
var LocalStoragePlugin = class extends Plugin {
  static id = "localStorage";
  code = plugin(CodePlugin);
  project = plugin(ProjectPlugin);
  version = signal(0);
  setup() {
  }
  saveProject(proj) {
    const existingData = this.load();
    const existingProjects = existingData?.projects || [];
    const currentStep = proj.tutorial ? proj.id === this.project.activeProjectId() ? this.project.tutorialCurrentStepSignal() : proj.currentStep || 0 : 0;
    const projectData = {
      id: proj.id,
      name: proj.name,
      description: proj.description || "",
      fileNames: proj.fileNames,
      files: { ...proj.files },
      originalFiles: { ...proj.files },
      visible: proj.visible !== false,
      lastUpdate: Date.now(),
      sequence: proj.sequence ?? existingProjects.length,
      editorState: proj.editorState || null,
      templateDesc: proj.templateDesc || null,
      tutorial: !!proj.tutorial,
      currentStep,
      steps: proj.steps || null,
      stepModifiedFiles: proj.stepModifiedFiles || null
    };
    const idx = existingProjects.findIndex((p) => p.id === proj.id);
    if (idx >= 0) {
      existingProjects[idx] = projectData;
    } else {
      existingProjects.push(projectData);
    }
    try {
      localStorage.setItem(
        "owl-playground-projects",
        JSON.stringify({ projects: existingProjects })
      );
      this.version.set(this.version() + 1);
    } catch (e) {
      console.error("Failed to save project:", e);
    }
  }
  updateProjectDescription(projectId, description) {
    const data = this.load();
    if (!data || !data.projects) return;
    const project = data.projects.find((p) => p.id === projectId);
    if (project) {
      project.description = description;
      localStorage.setItem("owl-playground-projects", JSON.stringify({ projects: data.projects }));
      this.version.set(this.version() + 1);
    }
  }
  deleteFromStorage(projectId) {
    const data = this.load();
    if (data && data.projects) {
      const filtered = data.projects.filter((p) => p.id !== projectId);
      localStorage.setItem("owl-playground-projects", JSON.stringify({ projects: filtered }));
      this.version.set(this.version() + 1);
    }
  }
  load() {
    const newData = localStorage.getItem("owl-playground-projects");
    if (newData) {
      try {
        const data = JSON.parse(newData);
        this._migrateProjects(data.projects);
        return data;
      } catch {
        return null;
      }
    }
    const oldData = localStorage.getItem("owl-playground-local-sample");
    if (oldData) {
      try {
        const { js, css, xml } = JSON.parse(oldData);
        const fileNames = [];
        const files = {};
        if (js) {
          fileNames.push("main.js");
          files["main.js"] = js;
        }
        if (xml && xml !== "<templates>\n</templates>") {
          fileNames.push("main.xml");
          files["main.xml"] = xml;
        }
        if (css) {
          fileNames.push("main.css");
          files["main.css"] = css;
        }
        if (fileNames.length === 0) {
          fileNames.push("main.js");
          files["main.js"] = "";
        }
        const id = generateId();
        return {
          projects: [{ id, name: "Migrated Project", fileNames, files }],
          activeProjectId: id
        };
      } catch {
        return null;
      }
    }
    return null;
  }
  _migrateProjects(projects) {
    if (!projects) return;
    const nameMap = { js: "main.js", css: "main.css", xml: "main.xml", md: "README.md" };
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (p.fileTypes && !p.fileNames) {
        p.fileNames = p.fileTypes.map((t) => nameMap[t]);
        const newFiles = {};
        for (const [type, content] of Object.entries(p.files || {})) {
          newFiles[nameMap[type] || `main.${type}`] = content;
        }
        p.files = newFiles;
        if (p.originalFiles) {
          const newOrig = {};
          for (const [type, content] of Object.entries(p.originalFiles)) {
            newOrig[nameMap[type] || `main.${type}`] = content;
          }
          p.originalFiles = newOrig;
        }
        delete p.fileTypes;
      }
      if (p.visible === void 0) p.visible = true;
      if (p.lastUpdate === void 0) p.lastUpdate = Date.now();
      if (p.sequence === void 0) p.sequence = i;
    }
  }
  clear() {
    localStorage.removeItem("owl-playground-projects");
    localStorage.removeItem("owl-playground-local-sample");
  }
};
var SettingsPlugin = class extends Plugin {
  static id = "settings";
  fontSize = signal(parseInt(localStorage.getItem("owl-playground-font-size")) || 13);
  autoRun = signal(localStorage.getItem("owl-playground-auto-run") === "true");
  darkMode = signal(localStorage.getItem("owl-playground-dark-mode") !== "false");
  fullscreen = signal(false);
  leftPaneWidth = signal(Math.ceil((window.innerWidth + 160) / 2));
  sidebarWidth = signal(180);
  leftPaneStyle = computed(() => `width:${this.leftPaneWidth()}px`);
  sidebarStyle = computed(() => `width:${this.sidebarWidth()}px`);
  setup() {
    this._applyTheme(this.darkMode());
  }
  _applyTheme(isDark) {
    document.documentElement.classList.toggle("light-mode", !isDark);
  }
  setDarkMode(value) {
    this.darkMode.set(value);
    localStorage.setItem("owl-playground-dark-mode", String(value));
    this._applyTheme(value);
  }
  setFontSize(size) {
    this.fontSize.set(size);
    localStorage.setItem("owl-playground-font-size", String(size));
  }
  setAutoRun(value) {
    this.autoRun.set(value);
    localStorage.setItem("owl-playground-auto-run", String(value));
  }
  setLeftPaneWidth(width) {
    this.leftPaneWidth.set(width);
  }
  setSidebarWidth(width) {
    const clampedWidth = Math.max(120, Math.min(400, width));
    this.sidebarWidth.set(clampedWidth);
  }
};
var DialogPlugin = class extends Plugin {
  static id = "dialog";
  dialogComponent = signal(null);
  dialogProps = signal({});
  showDialog(Component3, props2 = {}) {
    this.dialogProps.set(props2);
    this.dialogComponent.set(Component3);
  }
  closeDialog() {
    this.dialogComponent.set(null);
    this.dialogProps.set({});
  }
};
var ViewPlugin = class extends Plugin {
  static id = "view";
  showProjectManager = signal(false);
  showHelp = signal(false);
  toggleProjectManager() {
    this.showProjectManager.set(!this.showProjectManager());
  }
  setShowProjectManager(value) {
    this.showProjectManager.set(value);
  }
  toggleHelp() {
    this.showHelp.set(!this.showHelp());
  }
  setShowHelp(value) {
    this.showHelp.set(value);
  }
};

// src/components.js
var CodeEditor = class extends Component {
  static template = "CodeEditor";
  code = plugin2(CodePlugin);
  settings = plugin2(SettingsPlugin);
  project = plugin2(ProjectPlugin);
  view = plugin2(ViewPlugin);
  setup() {
    this.primaryEditorNode = signal2(null);
    this.secondaryEditorNode = signal2(null);
    this.primaryMarkdownPreview = signal2(null);
    this.secondaryMarkdownPreview = signal2(null);
    this.fontSizeCompartment = new Compartment();
    this.themeCompartment = new Compartment();
    this.panes = {
      primary: { view: null, states: {}, scrolls: {}, lastFile: null },
      secondary: { view: null, states: {}, scrolls: {}, lastFile: null }
    };
    let lastVersion = null;
    onMounted(() => {
      const fileName = this.code.primaryFile();
      const pane = this.panes.primary;
      const state = this.createEditorState(this.code.getContent(fileName), fileName, "primary");
      pane.view = new EditorView2({ parent: this.primaryEditorNode(), state });
      pane.states[fileName] = state;
      pane.lastFile = fileName;
      lastVersion = this.code.contentVersion();
    });
    useEffect(() => {
      this.code.focusRequest();
      if (this.panes.primary.view) {
        this.panes.primary.view.focus();
      }
    });
    useEffect(() => {
      const version = this.code.contentVersion();
      if (version === lastVersion) return;
      lastVersion = version;
      this._resetPane(
        "primary",
        untrack(() => this.code.primaryFile())
      );
      if (this.panes.secondary.view) {
        this._resetPane(
          "secondary",
          untrack(() => this.code.secondaryFile())
        );
      }
    });
    useEffect(() => {
      const fileName = this.code.primaryFile();
      this._switchPaneFile("primary", fileName);
    });
    useEffect(() => {
      const split = this.code.splitMode();
      const node = this.secondaryEditorNode();
      if (split && node && !this.panes.secondary.view) {
        const fileName = untrack(() => this.code.secondaryFile());
        const content = untrack(() => this.code.getContent(fileName));
        const pane = this.panes.secondary;
        const state = this.createEditorState(content, fileName, "secondary");
        pane.view = new EditorView2({ parent: node, state });
        pane.states[fileName] = state;
        pane.lastFile = fileName;
      }
      if (!split && this.panes.secondary.view) {
        this.panes.secondary.view.destroy();
        this.panes.secondary = { view: null, states: {}, scrolls: {}, lastFile: null };
      }
    });
    useEffect(() => {
      if (!this.code.splitMode()) return;
      const fileName = this.code.secondaryFile();
      this._switchPaneFile("secondary", fileName);
    });
    useEffect(() => {
      if (!this.code.splitMode()) return;
      const contents = this.code.contents();
      const primaryFile = this.code.primaryFile();
      const secondaryFile = this.code.secondaryFile();
      if (primaryFile !== secondaryFile) return;
      const content = contents[primaryFile] || "";
      for (const pane of Object.values(this.panes)) {
        if (pane.view && pane.view.state.doc.toString() !== content) {
          pane.view.dispatch({
            changes: { from: 0, to: pane.view.state.doc.length, insert: content }
          });
        }
      }
    });
    useEffect(() => {
      const size = this.settings.fontSize();
      const theme = EditorView2.theme({ "&": { fontSize: size + "px" } });
      for (const pane of Object.values(this.panes)) {
        if (pane.view) {
          pane.view.dispatch({ effects: this.fontSizeCompartment.reconfigure(theme) });
        }
      }
    });
    useEffect(() => {
      const isDark = this.settings.darkMode();
      const ext = isDark ? oneDark : [];
      for (const pane of Object.values(this.panes)) {
        if (pane.view) {
          pane.view.dispatch({ effects: this.themeCompartment.reconfigure(ext) });
        }
      }
    });
    useEffect(() => {
      const fileName = this.code.primaryFile();
      const previewNode = this.primaryMarkdownPreview();
      if (!previewNode || !this.code.isMarkdownFile(fileName)) return;
      if (!this.code.isMarkdownPreview(fileName)) return;
      this.code.contents();
      const content = this.code.getContent(fileName);
      parseMarkdown(content).then((html) => {
        if (this.primaryMarkdownPreview() === previewNode) {
          previewNode.innerHTML = html;
        }
      });
    });
    useEffect(() => {
      if (!this.code.splitMode()) return;
      const fileName = this.code.secondaryFile();
      const previewNode = this.secondaryMarkdownPreview();
      if (!previewNode || !this.code.isMarkdownFile(fileName)) return;
      if (!this.code.isMarkdownPreview(fileName)) return;
      this.code.contents();
      const content = this.code.getContent(fileName);
      parseMarkdown(content).then((html) => {
        if (this.secondaryMarkdownPreview() === previewNode) {
          previewNode.innerHTML = html;
        }
      });
    });
    onWillUnmount(() => {
      for (const pane of Object.values(this.panes)) {
        if (pane.view) pane.view.destroy();
      }
    });
  }
  isPrimaryMarkdownPreview = computed2(() => {
    const fileName = this.code.primaryFile();
    return this.code.isMarkdownFile(fileName) && this.code.isMarkdownPreview(fileName);
  });
  isSecondaryMarkdownPreview = computed2(() => {
    if (!this.code.splitMode()) return false;
    const fileName = this.code.secondaryFile();
    return this.code.isMarkdownFile(fileName) && this.code.isMarkdownPreview(fileName);
  });
  toggleMarkdownPreview(pane) {
    const fileName = pane === "primary" ? this.code.primaryFile() : this.code.secondaryFile();
    this.code.toggleMarkdownPreview(fileName);
  }
  isPrimaryMarkdownFile = computed2(() => {
    return this.code.isMarkdownFile(this.code.primaryFile());
  });
  isSecondaryMarkdownFile = computed2(() => {
    if (!this.code.splitMode()) return false;
    return this.code.isMarkdownFile(this.code.secondaryFile());
  });
  _resetPane(paneId, fileName) {
    const pane = this.panes[paneId];
    if (!pane.view) return;
    pane.states = {};
    pane.scrolls = {};
    pane.lastFile = fileName;
    const content = this.code.getContent(fileName);
    const newState = this.createEditorState(content, fileName, paneId);
    pane.states[fileName] = newState;
    pane.view.setState(newState);
  }
  _switchPaneFile(paneId, fileName) {
    const pane = this.panes[paneId];
    if (!pane.view || fileName === pane.lastFile) return;
    if (pane.lastFile) {
      pane.states[pane.lastFile] = pane.view.state;
      pane.scrolls[pane.lastFile] = pane.view.scrollDOM.scrollTop;
    }
    pane.lastFile = fileName;
    if (!pane.states[fileName]) {
      pane.states[fileName] = this.createEditorState(
        this.code.getContent(fileName),
        fileName,
        paneId
      );
    }
    pane.view.setState(pane.states[fileName]);
    const content = this.code.getContent(fileName);
    if (pane.view.state.doc.toString() !== content) {
      pane.view.dispatch({
        changes: { from: 0, to: pane.view.state.doc.length, insert: content }
      });
    }
    const scrollTop = pane.scrolls[fileName] || 0;
    requestAnimationFrame(() => {
      if (pane.view) pane.view.scrollDOM.scrollTop = scrollTop;
    });
    pane.view.focus();
  }
  primaryPaneStyle = computed2(() => {
    if (!this.code.splitMode()) return "";
    return `flex: ${this.code.splitRatio()} 1 0%`;
  });
  secondaryPaneStyle = computed2(() => {
    return `flex: ${1 - this.code.splitRatio()} 1 0%`;
  });
  setActivePane(paneId) {
    this.code.activePane.set(paneId);
  }
  toggleSplit() {
    this.code.toggleSplit();
  }
  isIdealSplit = computed2(() => {
    if (!this.code.splitMode()) return false;
    const primary = this.code.primaryFile();
    const secondary = this.code.secondaryFile();
    if (getFileType(primary) !== "js") return false;
    const baseName = primary.replace(/\.[^.]+$/, "");
    return secondary === `${baseName}.xml`;
  });
  _getCompanion(file) {
    const type = getFileType(file);
    if (type !== "js" && type !== "xml") return null;
    const baseName = file.replace(/\.[^.]+$/, "");
    const otherExt = type === "js" ? "xml" : "js";
    const companionName = `${baseName}.${otherExt}`;
    const files = this.code.files();
    return files.some((f) => f.name === companionName) ? companionName : null;
  }
  primaryCompanionFile = computed2(() => {
    if (this.isIdealSplit()) return null;
    return this._getCompanion(this.code.primaryFile());
  });
  secondaryCompanionFile = computed2(() => {
    if (this.isIdealSplit()) return null;
    return this._getCompanion(this.code.secondaryFile());
  });
  splitWithCompanion(file) {
    const companion = this._getCompanion(file);
    if (!companion) return;
    const type = getFileType(file);
    this.code.splitMode.set(true);
    if (type === "js") {
      this.code.primaryFile.set(file);
      this.code.secondaryFile.set(companion);
    } else {
      this.code.primaryFile.set(companion);
      this.code.secondaryFile.set(file);
    }
  }
  onSplitSeparatorMouseDown(ev) {
    ev.preventDefault();
    const area = ev.target.closest(".editor-area");
    const rect = area.getBoundingClientRect();
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.cursor = "row-resize";
    for (const iframe of document.getElementsByTagName("iframe")) {
      iframe.classList.add("disabled");
    }
    const onMouseMove = (e) => {
      const ratio = (e.clientY - rect.top) / rect.height;
      this.code.splitRatio.set(Math.max(0.2, Math.min(0.8, ratio)));
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener(
      "mouseup",
      () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.documentElement.style.userSelect = "";
        document.documentElement.style.cursor = "";
        for (const iframe of document.getElementsByTagName("iframe")) {
          iframe.classList.remove("disabled");
        }
      },
      { once: true }
    );
  }
  createEditorState(content, fileName, paneId) {
    const lang = getFileType(fileName);
    const tabSize = TAB_SIZES[lang];
    return EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        Prec.highest(
          keymap.of([
            {
              key: "Tab",
              run: (view) => acceptCompletion(view) || lang === "xml" && expandAbbreviation(view) || indentMore(view),
              shift: indentLess
            },
            {
              key: "Mod-Enter",
              run: () => {
                this.view.setShowHelp(false);
                this.code.run();
                const activeId = this.project.activeProjectId();
                if (activeId) {
                  this.project.markProjectAsRun(activeId);
                }
                return true;
              }
            }
          ])
        ),
        new Compartment().of(LANGUAGES[lang]()),
        new Compartment().of(indentUnit.of(" ".repeat(tabSize))),
        EditorState.tabSize.of(tabSize),
        ...lang === "md" ? [EditorView2.lineWrapping] : [],
        ...lang === "js" ? [createOwlCompletions()] : [],
        ...lang === "xml" ? [abbreviationTracker(), xmlTagRename()] : [],
        this.fontSizeCompartment.of(
          EditorView2.theme({ "&": { fontSize: this.settings.fontSize() + "px" } })
        ),
        this.themeCompartment.of(this.settings.darkMode() ? oneDark : []),
        EditorView2.updateListener.of((update) => {
          if (update.docChanged) {
            const value = update.state.doc.toString();
            const pane = this.panes[paneId];
            const file = pane.lastFile;
            if (file && this.code.getContent(file) !== value) {
              this.code.setContent(file, value);
            }
          }
        })
      ]
    });
  }
};
var ConfirmDialog = class extends Component {
  static template = "ConfirmDialog";
  props = props(["message", "confirmLabel?", "confirmClass?", "onConfirm"], {
    confirmLabel: "Confirm",
    confirmClass: "primary"
  });
  dialog = plugin2(DialogPlugin);
  confirm() {
    this.props.onConfirm();
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
};
var ProjectDialog = class extends Component {
  static template = "ProjectDialog";
  props = props(["name", "canDelete", "onRename", "onDelete"]);
  dialog = plugin2(DialogPlugin);
  setup() {
    this.nameRef = signal2(null);
    useEffect(() => {
      const el = this.nameRef();
      if (el) {
        el.focus();
        el.select();
      }
    });
  }
  onKeydown(ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      this.confirm();
    }
  }
  confirm() {
    const name = this.nameRef()?.value.trim();
    if (name) this.props.onRename(name);
    this.dialog.closeDialog();
  }
  delete() {
    this.props.onDelete();
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
};
var NewProjectDialog = class extends Component {
  static template = "NewProjectDialog";
  props = props(["templates", "onConfirm"]);
  dialog = plugin2(DialogPlugin);
  setup() {
    this.nameRef = signal2(null);
    this.templateRef = signal2(null);
    useEffect(() => {
      const el = this.nameRef();
      if (el) el.focus();
    });
  }
  onKeydown(ev) {
    if (ev.key === "Enter") {
      this.confirm();
    }
  }
  async confirm() {
    const nameEl = this.nameRef();
    const templateEl = this.templateRef();
    if (!nameEl || !templateEl) return;
    const name = nameEl.value.trim() || "Untitled";
    const templateDesc = templateEl.value;
    this.props.onConfirm(name, templateDesc);
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
};
var SettingsDialog = class extends Component {
  static template = "SettingsDialog";
  dialog = plugin2(DialogPlugin);
  settings = plugin2(SettingsPlugin);
  onFontSizeChange(ev) {
    this.settings.setFontSize(parseInt(ev.target.value));
  }
  onDarkModeChange(ev) {
    this.settings.setDarkMode(ev.target.checked);
  }
  close() {
    this.dialog.closeDialog();
  }
};
var ProjectManager = class extends Component {
  static template = "ProjectManager";
  project = plugin2(ProjectPlugin);
  code = plugin2(CodePlugin);
  localStorage = plugin2(LocalStoragePlugin);
  dialog = plugin2(DialogPlugin);
  view = plugin2(ViewPlugin);
  setup() {
    this.templatePlugin = plugin2(TemplatePlugin);
  }
  storedProjects = computed2(() => {
    this.localStorage.version();
    const data = this.localStorage.load();
    if (!data || !data.projects) return [];
    return data.projects;
  });
  activeProjects = computed2(() => {
    const sessionProjects = this.project.projects();
    const activeId = this.project.activeProjectId();
    return sessionProjects.map((proj) => {
      const stored = this.storedProjects().find((p) => p.id === proj.id);
      return {
        id: proj.id,
        name: proj.name,
        description: proj.description || stored?.description || "",
        lastUpdate: proj.lastUpdate || stored?.lastUpdate,
        isInLocalStorage: !!stored,
        isActive: proj.id === activeId,
        isDirty: this.project.isProjectDirty(proj),
        project: proj
      };
    });
  });
  archivedProjects = computed2(() => {
    const sessionIds = new Set(this.project.projects().map((p) => p.id));
    const stored = this.storedProjects();
    const activeId = this.project.activeProjectId();
    return stored.filter((proj) => !sessionIds.has(proj.id)).map((proj) => ({
      id: proj.id,
      name: proj.name,
      description: proj.description || "",
      lastUpdate: proj.lastUpdate,
      isActive: proj.id === activeId,
      isDirty: false,
      isArchived: true,
      project: proj
    }));
  });
  getProjectDisplayName(proj) {
    if (!proj.project.tutorial) return proj.name;
    const project = proj.project;
    const currentStep = (project.currentStep || 0) + 1;
    const totalSteps = project.steps ? project.steps.length : 0;
    return `${proj.name} (${currentStep}/${totalSteps})`;
  }
  formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const seconds = Math.floor((Date.now() - timestamp) / 1e3);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }
  loadProject(proj) {
    const existing = this.project.projects().find((p) => p.id === proj.id);
    if (existing) {
      this.project.switchProject(proj.id);
    } else {
      this.project.projects.set([...this.project.projects(), proj]);
      this.project.activeProjectId.set(proj.id);
      this.code.loadFiles(proj.fileNames, proj.files, proj.editorState);
    }
    this.view.setShowProjectManager(false);
  }
  archiveProject(proj) {
    if (proj.isDirty) {
      this.dialog.showDialog(ConfirmDialog, {
        message: `Archive "${proj.name}"? Unsaved changes will be lost.`,
        confirmLabel: "Archive",
        confirmClass: "danger",
        onConfirm: () => {
          this._archiveProject(proj);
        }
      });
    } else {
      this._archiveProject(proj);
    }
  }
  _archiveProject(proj) {
    if (this.project.projects().length > 1) {
      this.project.deleteProject(proj.id);
    }
  }
  deleteProject(proj) {
    this.dialog.showDialog(ConfirmDialog, {
      message: `Delete project "${proj.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmClass: "danger",
      onConfirm: () => {
        this.localStorage.deleteFromStorage(proj.id);
        const sessionProj = this.project.projects().find((p) => p.id === proj.id);
        if (sessionProj && this.project.projects().length > 1) {
          this.project.deleteProject(proj.id);
        }
      }
    });
  }
  saveProject(proj) {
    const sessionProj = this.project.projects().find((p) => p.id === proj.id);
    if (sessionProj) {
      if (this.project.activeProjectId() === proj.id) {
        sessionProj.files = this.code.getSnapshot();
      }
      this.project.markProjectClean(sessionProj);
      this.localStorage.saveProject(sessionProj);
    }
  }
  activateProject(proj) {
    if (!proj.project) return;
    const wasArchived = proj.isArchived;
    if (!this.project.projects().find((p) => p.id === proj.id)) {
      this.project.projects.set([...this.project.projects(), proj.project]);
    }
    this.project.switchProject(proj.id);
    const fileNames = proj.project.fileNames;
    let targetFile = fileNames.find((f) => f === "main.js");
    if (!targetFile) {
      targetFile = fileNames.find((f) => f.toLowerCase() === "readme.md");
    }
    if (!targetFile && fileNames.length > 0) {
      targetFile = fileNames[0];
    }
    if (targetFile) {
      this.code.primaryFile.set(targetFile);
    }
    if (!wasArchived) {
      this.view.setShowProjectManager(false);
    }
  }
  updateDescription(proj, description) {
    const sessionProj = this.project.projects().find((p) => p.id === proj.id);
    if (sessionProj) {
      sessionProj.description = description;
    }
    const stored = this.storedProjects().find((p) => p.id === proj.id);
    if (stored) {
      this.localStorage.updateProjectDescription(proj.id, description);
    }
  }
  openNewProjectDialog() {
    this.dialog.showDialog(NewProjectDialog, {
      templates: this.templatePlugin.list,
      onConfirm: async (name, templateDesc) => {
        const template = this.templatePlugin.list.find((t) => t.description === templateDesc);
        const contents = template ? await template.code() : { "main.js": HELLO_WORLD_JS };
        const fileNames = Object.keys(contents);
        this.project.createProject(name, fileNames, contents, templateDesc);
      }
    });
  }
};
var NewFileDialog = class extends Component {
  static template = "NewFileDialog";
  props = props(["existingFiles", "onConfirm", "folder?"], {
    folder: ""
  });
  dialog = plugin2(DialogPlugin);
  setup() {
    this.fileName = signal2("");
    this.nameRef = signal2(null);
    this.typeRef = signal2(null);
    this.error = signal2("");
    useEffect(() => {
      const el = this.nameRef();
      if (el) el.focus();
    });
  }
  onKeydown(ev) {
    if (ev.key === "Enter") {
      this.confirm();
    }
  }
  confirm() {
    const nameEl = this.nameRef();
    const typeEl = this.typeRef();
    if (!nameEl || !typeEl) return;
    const name = nameEl.value.trim();
    if (!name) return;
    const ext = typeEl.value;
    const fileName = name.endsWith(`.${ext}`) ? name : `${name}.${ext}`;
    const fullPath = this.props.folder ? `${this.props.folder}/${fileName}` : fileName;
    if (this.props.existingFiles.includes(fullPath)) {
      this.error.set(`"${fullPath}" already exists`);
      return;
    }
    this.props.onConfirm(fullPath);
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
};
var NewFolderDialog = class extends Component {
  static template = "NewFolderDialog";
  props = props(["existingFiles", "onConfirm"]);
  dialog = plugin2(DialogPlugin);
  setup() {
    this.nameRef = signal2(null);
    this.error = signal2("");
    useEffect(() => {
      const el = this.nameRef();
      if (el) el.focus();
    });
  }
  onKeydown(ev) {
    if (ev.key === "Enter") {
      this.confirm();
    }
  }
  confirm() {
    const nameEl = this.nameRef();
    if (!nameEl) return;
    const name = nameEl.value.trim();
    if (!name) {
      this.error.set("Name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_/]*$/.test(name)) {
      this.error.set(
        "Name must start with a letter and contain only letters, numbers, and underscores"
      );
      return;
    }
    if (this.props.existingFiles.some((f) => f.startsWith(name + "/"))) {
      this.error.set(`Folder "${name}" already exists`);
      return;
    }
    this.props.onConfirm(name);
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
};
var NewComponentDialog = class extends Component {
  static template = "NewComponentDialog";
  props = props(["existingFiles", "onConfirm", "folder?"]);
  dialog = plugin2(DialogPlugin);
  setup() {
    this.nameRef = signal2(null);
    this.error = signal2("");
    useEffect(() => {
      const el = this.nameRef();
      if (el) el.focus();
    });
  }
  onKeydown(ev) {
    if (ev.key === "Enter") {
      this.confirm();
    }
  }
  confirm() {
    const nameEl = this.nameRef();
    if (!nameEl) return;
    const input = nameEl.value.trim();
    if (!input) {
      this.error.set("Name is required");
      return;
    }
    let folder = this.props.folder || "";
    let componentName = input;
    if (!folder) {
      const slashIndex = input.lastIndexOf("/");
      if (slashIndex >= 0) {
        folder = input.substring(0, slashIndex);
        componentName = input.substring(slashIndex + 1);
      }
    }
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(componentName)) {
      this.error.set("Component name must be PascalCase (e.g., ProductCard)");
      return;
    }
    const baseFileName = this.toSnakeCase(componentName);
    const jsFileName = folder ? `${folder}/${baseFileName}.js` : `${baseFileName}.js`;
    const xmlFileName = folder ? `${folder}/${baseFileName}.xml` : `${baseFileName}.xml`;
    if (this.props.existingFiles.includes(jsFileName)) {
      this.error.set(`"${jsFileName}" already exists`);
      return;
    }
    if (this.props.existingFiles.includes(xmlFileName)) {
      this.error.set(`"${xmlFileName}" already exists`);
      return;
    }
    this.props.onConfirm(componentName, jsFileName, xmlFileName);
    this.dialog.closeDialog();
  }
  toSnakeCase(name) {
    return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
  }
  close() {
    this.dialog.closeDialog();
  }
};
var FileDialog = class extends Component {
  static template = "FileDialog";
  props = props(["fileName", "existingFiles", "canDelete", "onRename", "onDelete"]);
  dialog = plugin2(DialogPlugin);
  setup() {
    this.nameRef = signal2(null);
    this.typeRef = signal2(null);
    this.error = signal2("");
    useEffect(() => {
      const el = this.nameRef();
      if (el) {
        el.focus();
        el.select();
      }
    });
  }
  baseName() {
    return this.props.fileName.replace(/\.[^.]+$/, "");
  }
  currentType() {
    return getFileType(this.props.fileName);
  }
  confirm() {
    const nameEl = this.nameRef();
    const typeEl = this.typeRef();
    if (!nameEl || !typeEl) return;
    const name = nameEl.value.trim();
    if (!name) return;
    const ext = typeEl.value;
    const newFileName = name.endsWith(`.${ext}`) ? name : `${name}.${ext}`;
    if (newFileName !== this.props.fileName && this.props.existingFiles.includes(newFileName)) {
      this.error.set(`"${newFileName}" already exists`);
      return;
    }
    if (newFileName !== this.props.fileName) {
      this.props.onRename(newFileName);
    }
    this.dialog.closeDialog();
  }
  delete() {
    this.props.onDelete();
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
};
var Explorer = class extends Component {
  static template = "Explorer";
  code = plugin2(CodePlugin);
  project = plugin2(ProjectPlugin);
  dialog = plugin2(DialogPlugin);
  localStorage = plugin2(LocalStoragePlugin);
  templatePlugin = plugin2(TemplatePlugin);
  view = plugin2(ViewPlugin);
  setup() {
    this.expandedFolders = signal2(/* @__PURE__ */ new Set());
    this.collapsedFolders = signal2(/* @__PURE__ */ new Set());
    this.sidebarContextMenu = signal2({ visible: false, x: 0, y: 0 });
    this.projectContextMenu = signal2({ visible: false, project: null, x: 0, y: 0 });
    this.fileContextMenu = signal2({
      visible: false,
      project: null,
      fileName: null,
      canDelete: false,
      x: 0,
      y: 0
    });
    this.folderContextMenu = signal2({
      visible: false,
      project: null,
      folder: null,
      x: 0,
      y: 0
    });
    useEffect(() => {
      const handler = () => this.hideContextMenu();
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    });
  }
  toggleProjectManager() {
    this.view.toggleProjectManager();
  }
  isExpanded(projId) {
    return this.project.isProjectExpanded(projId);
  }
  isProjectDirty(proj) {
    if (proj.id === this.project.activeProjectId()) {
      this.code.contents();
    }
    return this.project.isProjectDirty(proj);
  }
  getProjectDisplayName(proj) {
    if (!proj.tutorial) return proj.name;
    const currentStep = proj.id === this.project.activeProjectId() ? this.project.tutorialCurrentStep() + 1 : (proj.currentStep || 0) + 1;
    const totalSteps = proj.steps ? proj.steps.length : 0;
    return `${proj.name} (${currentStep}/${totalSteps})`;
  }
  canSaveProject(proj) {
    if (this.isProjectDirty(proj)) return true;
    const data = this.localStorage.load();
    if (!data || !data.projects) return true;
    return !data.projects.some((p) => p.id === proj.id);
  }
  toggleExpand(projId) {
    this.project.toggleProjectExpanded(projId);
  }
  selectProject(projId) {
    this.project.expandProject(projId);
    this.project.switchProject(projId);
    this.view.setShowProjectManager(false);
  }
  getProjectFiles(proj) {
    if (proj.id === this.project.activeProjectId()) {
      return this.code.files();
    }
    return [...proj.fileNames].sort((a, b) => a.localeCompare(b)).map(makeFileEntry);
  }
  getProjectFilesWithFolders(proj) {
    const files = this.getProjectFiles(proj);
    const parsed = parseFilePaths(files);
    return parsed;
  }
  isFolderExpanded(folder) {
    const expanded = this.expandedFolders();
    const collapsed = this.collapsedFolders();
    if (collapsed.has(folder)) return false;
    if (expanded.has(folder)) return true;
    return true;
  }
  toggleFolder(folder) {
    const expanded = new Set(this.expandedFolders());
    const collapsed = new Set(this.collapsedFolders());
    if (this.isFolderExpanded(folder)) {
      expanded.delete(folder);
      collapsed.add(folder);
    } else {
      expanded.add(folder);
      collapsed.delete(folder);
    }
    this.expandedFolders.set(expanded);
    this.collapsedFolders.set(collapsed);
  }
  onDragStartFile(ev, fullName) {
    if (fullName === "main.js") {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.setData("text/plain", fullName);
    ev.dataTransfer.effectAllowed = "move";
  }
  onDragOverFolder(ev) {
    ev.dataTransfer.dropEffect = "move";
    const row = ev.currentTarget;
    row.classList.add("drop-target");
  }
  onDragLeaveFolder(ev) {
    const row = ev.currentTarget;
    if (!row.contains(ev.relatedTarget)) {
      row.classList.remove("drop-target");
    }
  }
  onDropOnFolder(ev, proj, folderPath) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.currentTarget.classList.remove("drop-target");
    let parent = ev.currentTarget.parentElement;
    while (parent) {
      if (parent.classList.contains("drop-target")) {
        parent.classList.remove("drop-target");
      }
      parent = parent.parentElement;
    }
    const sourcePath = ev.dataTransfer.getData("text/plain");
    if (!sourcePath) return;
    if (this.project.activeProjectId() !== proj.id) return;
    const fileName = sourcePath.split("/").pop();
    const targetPath = folderPath ? `${folderPath}/${fileName}` : fileName;
    if (targetPath === sourcePath) return;
    const files = this.code.files();
    if (files.some((f) => f.name === targetPath)) return;
    this.project.renameFileInProject(sourcePath, targetPath);
  }
  selectFile(projId, fileName) {
    if (this.project.activeProjectId() !== projId) {
      const set = new Set(this.project.collapsedProjects());
      set.delete(projId);
      this.project.collapsedProjects.set(set);
      this.project.switchProject(projId);
    }
    this.code.selectFile(fileName);
    this.view.setShowProjectManager(false);
  }
  getCompanionFile(proj, fileName) {
    const type = getFileType(fileName);
    if (type !== "js" && type !== "xml") return null;
    const baseName = fileName.replace(/\.[^.]+$/, "");
    const otherExt = type === "js" ? "xml" : "js";
    const companionName = `${baseName}.${otherExt}`;
    const files = proj.id === this.project.activeProjectId() ? this.code.files() : proj.fileNames.map(makeFileEntry);
    return files.some((f) => (f.name || f) === companionName) ? companionName : null;
  }
  splitWithCompanion(projId, fileName) {
    if (this.project.activeProjectId() !== projId) {
      this.project.switchProject(projId);
    }
    const companion = this.getCompanionFile(
      this.project.projects().find((p) => p.id === projId),
      fileName
    );
    if (!companion) return;
    const type = getFileType(fileName);
    this.code.splitMode.set(true);
    if (type === "js") {
      this.code.primaryFile.set(fileName);
      this.code.secondaryFile.set(companion);
    } else {
      this.code.primaryFile.set(companion);
      this.code.secondaryFile.set(fileName);
    }
    this.view.setShowProjectManager(false);
  }
  canDeleteProject(proj) {
    return this.project.projects().length > 1;
  }
  deleteProject(proj) {
    if (this.isProjectDirty(proj)) {
      this.dialog.showDialog(ConfirmDialog, {
        message: `Delete project "${proj.name}"? Unsaved changes will be lost.`,
        confirmLabel: "Delete",
        confirmClass: "danger",
        onConfirm: () => {
          this.project.deleteProject(proj.id, true);
          this.localStorage.deleteFromStorage(proj.id);
        }
      });
    } else {
      this.project.deleteProject(proj.id, true);
      this.localStorage.deleteFromStorage(proj.id);
    }
  }
  editProject(id) {
    const project = this.project.projects().find((p) => p.id === id);
    this.dialog.showDialog(ProjectDialog, {
      name: project.name,
      canDelete: this.project.projects().length > 1,
      onRename: (name) => {
        this.project.renameProject(id, name);
        this.localStorage.saveProject(project);
      },
      onDelete: () => {
        this.project.deleteProject(id);
        this.localStorage.deleteFromStorage(id);
      }
    });
  }
  editFile(projId, fileName) {
    if (this.project.activeProjectId() !== projId) return;
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    const isMainJs = fileName === "main.js";
    this.dialog.showDialog(FileDialog, {
      fileName,
      existingFiles,
      canDelete: !isMainJs && files.length > 1,
      onRename: isMainJs ? null : (newName) => {
        this.project.renameFileInProject(fileName, newName);
      },
      onDelete: isMainJs ? null : () => {
        this.project.deleteFileFromProject(fileName);
      }
    });
  }
  showNewFileDialog() {
    const existingFiles = this.code.files().map((f) => f.name);
    this.dialog.showDialog(NewFileDialog, {
      existingFiles,
      onConfirm: (fileName) => {
        this.project.addFileToProject(fileName);
      }
    });
  }
  hideContextMenu() {
    this.sidebarContextMenu.set({ visible: false, x: 0, y: 0 });
    this.projectContextMenu.set({ visible: false, project: null, x: 0, y: 0 });
    this.fileContextMenu.set({
      visible: false,
      project: null,
      fileName: null,
      canDelete: false,
      x: 0,
      y: 0
    });
    this.folderContextMenu.set({
      visible: false,
      project: null,
      folder: null,
      x: 0,
      y: 0
    });
  }
  showSidebarContextMenu(ev) {
    this.hideContextMenu();
    if (ev.target.closest(".explorer-project") || ev.target.closest(".project-files")) {
      return;
    }
    this.sidebarContextMenu.set({ visible: true, x: ev.clientX, y: ev.clientY });
  }
  sidebarContextMenuStyle() {
    const { x, y } = this.sidebarContextMenu();
    return `left: ${x}px; top: ${y}px;`;
  }
  sidebarContextMenuNewProject() {
    this.hideContextMenu();
    this.dialog.showDialog(NewProjectDialog, {
      templates: this.templatePlugin.list,
      onConfirm: async (name, templateDesc) => {
        const template = this.templatePlugin.list.find((t) => t.description === templateDesc);
        const contents = template ? await template.code() : { "main.js": HELLO_WORLD_JS };
        const fileNames = Object.keys(contents);
        this.project.createProject(name, fileNames, contents, templateDesc);
      }
    });
  }
  showProjectContextMenu(ev, proj) {
    this.hideContextMenu();
    this.projectContextMenu.set({ visible: true, project: proj, x: ev.clientX, y: ev.clientY });
  }
  projectContextMenuStyle() {
    const { x, y } = this.projectContextMenu();
    return `left: ${x}px; top: ${y}px;`;
  }
  canDeleteContextProject() {
    return this.project.projects().length > 1;
  }
  contextMenuAddFile() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(NewFileDialog, {
      existingFiles,
      onConfirm: (fileName) => {
        this.project.addFileToProject(fileName);
      }
    });
  }
  contextMenuNewFolder() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(NewFolderDialog, {
      existingFiles,
      onConfirm: (folderName) => {
        const placeholderFile = `${folderName}/.gitkeep`;
        this.project.addFileToProject(placeholderFile, false);
      }
    });
  }
  contextMenuNewComponent() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(NewComponentDialog, {
      existingFiles,
      onConfirm: (componentName, jsFileName, xmlFileName) => {
        this.createComponent(componentName, jsFileName, xmlFileName);
      }
    });
  }
  createComponent(componentName, jsFileName, xmlFileName) {
    const jsContent = `import { Component } from "@odoo/owl";

export class ${componentName} extends Component {
    static template = "example.${componentName}";
}
`;
    const xmlContent = `<templates>
    <t t-name="example.${componentName}">
        <div>Hello from ${componentName}!</div>
    </t>
</templates>
`;
    this.project.addFileToProject(jsFileName);
    this.project.addFileToProject(xmlFileName);
    this.code.setContent(jsFileName, jsContent);
    this.code.setContent(xmlFileName, xmlContent);
    this.code.splitMode.set(true);
    this.code.primaryFile.set(jsFileName);
    this.code.secondaryFile.set(xmlFileName);
  }
  contextMenuRename() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    this.editProject(proj.id);
  }
  contextMenuClone() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    const name = proj.name + " (copy)";
    const fileNames = [...proj.fileNames];
    const isActiveProject = this.project.activeProjectId() === proj.id;
    const contents = isActiveProject ? this.code.getSnapshot() : { ...proj.files };
    const projectId = this.project.createProject(name, fileNames, contents, null);
    this.project.markProjectDirty(projectId);
  }
  contextMenuSave() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    if (this.project.activeProjectId() === proj.id) {
      proj.files = this.code.getSnapshot();
    }
    this.localStorage.saveProject(proj);
    this.project.markProjectClean(proj);
  }
  contextMenuDelete() {
    const proj = this.projectContextMenu().project;
    this.hideContextMenu();
    this.dialog.showDialog(ConfirmDialog, {
      message: `Delete project "${proj.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmClass: "danger",
      onConfirm: () => {
        this.project.deleteProject(proj.id);
        this.localStorage.deleteFromStorage(proj.id);
      }
    });
  }
  showFileContextMenu(ev, proj, fileName) {
    ev.stopPropagation();
    const files = proj.id === this.project.activeProjectId() ? this.code.files() : proj.fileNames;
    const canDelete = fileName !== "main.js" && files.length > 1;
    this.fileContextMenu.set({
      visible: true,
      project: proj,
      fileName,
      canDelete,
      x: ev.clientX,
      y: ev.clientY
    });
  }
  fileContextMenuStyle() {
    const { x, y } = this.fileContextMenu();
    return `left: ${x}px; top: ${y}px;`;
  }
  fileContextMenuRename() {
    const { project: proj, fileName } = this.fileContextMenu();
    this.hideContextMenu();
    if (fileName === "main.js") return;
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(FileDialog, {
      fileName,
      existingFiles,
      canDelete: files.length > 1,
      onRename: (newName) => {
        this.project.renameFileInProject(fileName, newName);
      },
      onDelete: () => {
        this.project.deleteFileFromProject(fileName);
      }
    });
  }
  fileContextMenuDelete() {
    const { project: proj, fileName } = this.fileContextMenu();
    this.hideContextMenu();
    if (fileName === "main.js") return;
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    this.dialog.showDialog(ConfirmDialog, {
      message: `Delete file "${fileName}"?`,
      confirmLabel: "Delete",
      confirmClass: "danger",
      onConfirm: () => {
        this.project.deleteFileFromProject(fileName);
      }
    });
  }
  showFolderContextMenu(ev, proj, folder) {
    this.hideContextMenu();
    ev.preventDefault();
    ev.stopPropagation();
    this.folderContextMenu.set({
      visible: true,
      project: proj,
      folder,
      x: ev.clientX,
      y: ev.clientY
    });
  }
  folderContextMenuStyle() {
    const { x, y } = this.folderContextMenu();
    return `left: ${x}px; top: ${y}px;`;
  }
  folderContextMenuDelete() {
    const { project: proj, folder } = this.folderContextMenu();
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const folderFiles = files.filter((f) => f.name.startsWith(folder + "/"));
    this.dialog.showDialog(ConfirmDialog, {
      message: `Delete folder "${folder}" and all its contents (${folderFiles.length} files)?`,
      confirmLabel: "Delete",
      confirmClass: "danger",
      onConfirm: () => {
        for (const file of folderFiles) {
          this.project.deleteFileFromProject(file.name);
        }
      }
    });
  }
  folderContextMenuNewFile() {
    const { project: proj, folder } = this.folderContextMenu();
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(NewFileDialog, {
      existingFiles,
      folder,
      onConfirm: (fileName) => {
        this.project.addFileToProject(fileName);
      }
    });
  }
  folderContextMenuNewFolder() {
    const { project: proj, folder } = this.folderContextMenu();
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(NewFolderDialog, {
      existingFiles,
      onConfirm: (folderName) => {
        const placeholderFile = `${folder}/${folderName}/.gitkeep`;
        this.project.addFileToProject(placeholderFile, false);
      }
    });
  }
  folderContextMenuNewComponent() {
    const { project: proj, folder } = this.folderContextMenu();
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    const files = this.code.files();
    const existingFiles = files.map((f) => f.name);
    this.dialog.showDialog(NewComponentDialog, {
      existingFiles,
      folder,
      onConfirm: (componentName, jsFileName, xmlFileName) => {
        this.createComponent(componentName, jsFileName, xmlFileName);
      }
    });
  }
};
function useAutoscroll() {
  const target = signal2();
  let isScrolledToBottom = true;
  onWillPatch(() => {
    const el = target();
    if (el) {
      isScrolledToBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 5;
    }
  });
  onPatched(() => {
    if (isScrolledToBottom) {
      const el = target();
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });
  return target;
}
var ContentView = class extends Component {
  static template = "ContentView";
  code = plugin2(CodePlugin);
  settings = plugin2(SettingsPlugin);
  project = plugin2(ProjectPlugin);
  dialog = plugin2(DialogPlugin);
  view = plugin2(ViewPlugin);
  templatePlugin = plugin2(TemplatePlugin);
  messageList = useAutoscroll();
  setup() {
    this.displayWelcome = signal2(true);
    this.content = signal2(null);
    this.consoleMessages = signal2.Array([]);
    this.showConsole = signal2(false);
    this.version = __info__.version;
    useEffect(() => {
      const code = this.code.runCode();
      if (!this.content()) return;
      if (!code) {
        this.content().innerHTML = "";
        this.displayWelcome.set(true);
        this.consoleMessages.set([]);
        this.showConsole.set(false);
        return;
      }
      this.run(code);
    });
    const debouncedRun = debounce(() => this.code.run(), 500);
    useEffect(() => {
      this.code.contents();
      const autoRun = this.settings.autoRun();
      if (!autoRun) return;
      const modifiedFiles = untrack(() => this.code.modifiedFiles());
      if (modifiedFiles.size === 0) return;
      let hasNonMdModified = false;
      for (const file of modifiedFiles) {
        if (!file.endsWith(".md")) {
          hasNonMdModified = true;
          break;
        }
      }
      if (!hasNonMdModified) return;
      const activeId = this.project.activeProjectId();
      if (!activeId || !this.project.ranProjects.has(activeId)) return;
      debouncedRun();
    });
  }
  runCode() {
    this.view.setShowHelp(false);
    this.code.run();
    const activeId = this.project.activeProjectId();
    if (activeId) {
      this.project.markProjectAsRun(activeId);
    }
  }
  onHibouClick(ev) {
    ev.currentTarget.classList.remove("spin");
    void ev.currentTarget.offsetWidth;
    ev.currentTarget.classList.add("spin");
  }
  async startTutorial(tutorial) {
    await this.templatePlugin.openTutorial(tutorial);
    this.view.setShowProjectManager(false);
  }
  onAutoRunChange(ev) {
    this.settings.setAutoRun(ev.target.checked);
  }
  addMessage(type, text, cause = null) {
    this.consoleMessages().push({ type, text, cause });
    if (type === "error") {
      this.showConsole.set(true);
    }
  }
  formatErrorCause(cause, indent = "  ") {
    if (!cause) return [];
    const messages = [];
    let current = cause;
    while (current) {
      const causeText = current instanceof Error ? current.message : String(current);
      messages.push({ type: "error", text: indent + "Caused by: " + causeText });
      current = current.cause;
      indent += "  ";
    }
    return messages;
  }
  clearConsole() {
    this.consoleMessages.set([]);
  }
  toggleConsole() {
    this.showConsole.set(!this.showConsole());
  }
  toggleFullscreen() {
    this.settings.fullscreen.set(!this.settings.fullscreen());
  }
  errorCount = computed2(() => this.consoleMessages().filter((m) => m.type === "error").length);
  formatArgs(args) {
    return args.map((a) => {
      if (a === null) return "null";
      if (a === void 0) return "undefined";
      if (typeof a === "object") {
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      }
      return String(a);
    }).join(" ");
  }
  run({ jsFiles, css, xml }) {
    this.content().innerHTML = "";
    this.displayWelcome.set(false);
    this.consoleMessages.set([]);
    const iframe = document.createElement("iframe");
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      iframeWindow.addEventListener("error", (e) => {
        this.addMessage("error", e.message, e.error?.cause);
        for (const msg of this.formatErrorCause(e.error?.cause)) {
          this.consoleMessages().push(msg);
        }
      });
      iframeWindow.addEventListener("unhandledrejection", (e) => {
        const reason = e.reason;
        const text = reason instanceof Error ? reason.message : String(reason);
        this.addMessage("error", text, reason?.cause);
        for (const msg of this.formatErrorCause(reason?.cause)) {
          this.consoleMessages().push(msg);
        }
      });
      const origConsole = iframeWindow.console;
      iframeWindow.console = {
        ...origConsole,
        log: (...args) => {
          this.addMessage("log", this.formatArgs(args));
          origConsole.log(...args);
        },
        warn: (...args) => {
          this.addMessage("warn", this.formatArgs(args));
          origConsole.warn(...args);
        },
        error: (...args) => {
          this.addMessage("error", this.formatArgs(args));
          origConsole.error(...args);
        },
        info: (...args) => {
          this.addMessage("log", this.formatArgs(args));
          origConsole.info(...args);
        }
      };
      function resolveImport(specifier, fromFile, fileUrlMap2) {
        const dir = fromFile.includes("/") ? fromFile.substring(0, fromFile.lastIndexOf("/")) : "";
        let resolvedPath = dir ? `${dir}/${specifier}` : specifier;
        const parts = resolvedPath.split("/");
        const normalized = [];
        for (const part of parts) {
          if (part === "..") {
            normalized.pop();
          } else if (part !== ".") {
            normalized.push(part);
          }
        }
        resolvedPath = "./" + normalized.join("/");
        return fileUrlMap2[resolvedPath] ?? fileUrlMap2[resolvedPath + ".js"] ?? fileUrlMap2[resolvedPath + "/index.js"];
      }
      function rewriteImports(code, fromFile, urlMap) {
        return code.replace(
          /((?:import|export)[^'"]*from\s*)(['"])(\.+\/[^'"]+)\2/g,
          (match, prefix, quote, specifier) => {
            const resolved = resolveImport(specifier, fromFile, urlMap);
            return resolved ? `${prefix}${quote}${resolved}${quote}` : match;
          }
        ).replace(
          /\bimport\s*(['"])(\.+\/[^'"]+)\1/g,
          (match, quote, specifier) => {
            const resolved = resolveImport(specifier, fromFile, urlMap);
            return resolved ? `import ${quote}${resolved}${quote}` : match;
          }
        ).replace(/\bimport\s*\(\s*(['"])(\.+\/[^'"]+)\1\s*\)/g, (match, quote, specifier) => {
          const resolved = resolveImport(specifier, fromFile, urlMap);
          return resolved ? `import(${quote}${resolved}${quote})` : match;
        });
      }
      const imports = { "@odoo/owl": "../owl.js" };
      const blobUrls = [];
      const jsFileNames = Object.keys(jsFiles);
      const mainJsName = jsFileNames.find((n) => n === "main.js");
      if (!mainJsName) {
        this.addMessage(
          "error",
          "main.js not found \u2014 every project must have a main.js entry point"
        );
        if (jsFileNames.length === 0) return;
        const fallback = jsFileNames[0];
        this.addMessage("log", `Falling back to ${fallback}`);
      }
      const entryPoint = mainJsName || jsFileNames[0];
      const nonMainFiles = Object.entries(jsFiles).filter(([name]) => name !== entryPoint);
      const fileUrlMap = {};
      for (let pass = 0; pass < 4; pass++) {
        for (const [name, code] of nonMainFiles) {
          const src = pass === 0 ? code : rewriteImports(code, name, fileUrlMap);
          const blob = new Blob([src], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          blobUrls.push(url);
          fileUrlMap["./" + name] = url;
          if (name.endsWith(".js")) fileUrlMap["./" + name.slice(0, -3)] = url;
        }
      }
      Object.assign(imports, fileUrlMap);
      const importMap = doc.createElement("script");
      importMap.type = "importmap";
      importMap.textContent = JSON.stringify({ imports });
      doc.head.appendChild(importMap);
      const script = doc.createElement("script");
      script.type = "module";
      const escapedXml = xml.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/, "\\${");
      const mainJs = rewriteImports(jsFiles[entryPoint] || "", entryPoint, fileUrlMap);
      script.textContent = `const TEMPLATES = \`${escapedXml}\`
${mainJs}`;
      script.addEventListener("error", () => {
        this.addMessage("error", "Failed to load module \u2014 check your import paths");
      });
      doc.body.appendChild(script);
      const baseStyle = document.createElement("style");
      baseStyle.textContent = "body { font-family: system-ui, sans-serif; margin: 0; }";
      doc.head.appendChild(baseStyle);
      const style = document.createElement("style");
      style.innerText = css;
      doc.head.appendChild(style);
    };
    this.content().appendChild(iframe);
  }
};
var TutorialBar = class extends Component {
  static template = "TutorialBar";
  project = plugin2(ProjectPlugin);
  dialog = plugin2(DialogPlugin);
  get steps() {
    return this.project.tutorialSteps();
  }
  get currentStep() {
    return this.project.tutorialCurrentStep() + 1;
  }
  get isStepDirty() {
    return this.project.isCurrentTutorialStepDirty();
  }
  get hasSolution() {
    return this.project.hasCurrentStepSolution();
  }
  get matchesSolution() {
    return this.project.matchesCurrentStepSolution();
  }
  nextStep() {
    this.project.nextTutorialStep();
  }
  prevStep() {
    this.project.prevTutorialStep();
  }
  onStepChange(ev) {
    const stepIndex = parseInt(ev.target.value, 10);
    if (!isNaN(stepIndex) && stepIndex !== this.project.tutorialCurrentStep()) {
      this.project.setTutorialStep(stepIndex);
    }
  }
  solveStep() {
    this.project.solveTutorialStep();
  }
  resetStep() {
    this.project.resetTutorialStep();
  }
};

// src/playground.js
var Playground = class extends Component2 {
  static template = "Playground";
  static components = { CodeEditor, ContentView, Explorer, ProjectManager, TutorialBar };
  setup() {
    this.version = __info__2.version;
    providePlugins([
      CodePlugin,
      TemplatePlugin,
      ProjectPlugin,
      LocalStoragePlugin,
      SettingsPlugin,
      DialogPlugin,
      ViewPlugin
    ]);
    this.code = plugin3(CodePlugin);
    this.project = plugin3(ProjectPlugin);
    this.templatePlugin = plugin3(TemplatePlugin);
    this.localStorage = plugin3(LocalStoragePlugin);
    this.settings = plugin3(SettingsPlugin);
    this.dialog = plugin3(DialogPlugin);
    this.view = plugin3(ViewPlugin);
    this.templates = this.templatePlugin.list;
    this.categories = this.templatePlugin.categories;
    this.tutorials = computed3(() => this.templatePlugin.list.filter((t) => t.isTutorial));
    this.nonTutorialCategories = computed3(
      () => this.templatePlugin.categories.filter((cat) => cat.name !== "Tutorials").map((cat) => ({
        ...cat,
        templates: cat.templates.filter((t) => !t.isTutorial)
      }))
    );
    this.copied = signal3(null);
    this.templateSelectRef = signal3(null);
    this.currentTemplateValue = computed3(() => {
      const project = this.project.activeProject();
      if (!project || !project.templateDesc) return "";
      if (this.project.isCurrentProjectDirty()) return "";
      return project.templateDesc;
    });
    useEffect2(() => {
      const el = this.templateSelectRef();
      const val = this.currentTemplateValue();
      if (el) el.value = val;
    });
    this.hashData = null;
    this.hashTutorial = null;
    if (window.location.hash) {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const tutorial = this.templatePlugin.tutorials.find((t) => t.id === hash);
      if (tutorial) {
        this.hashTutorial = tutorial;
      } else {
        try {
          const parsed = JSON.parse(atob(hash));
          if ("js" in parsed && typeof parsed.js === "string") {
            const { js, css, xml } = parsed;
            const fileNames = [];
            const contents = {};
            if (js) {
              fileNames.push("main.js");
              contents["main.js"] = js;
            }
            if (xml && xml !== "<templates>\n</templates>") {
              fileNames.push("main.xml");
              contents["main.xml"] = xml;
            }
            if (css) {
              fileNames.push("main.css");
              contents["main.css"] = css;
            }
            if (fileNames.length === 0) {
              fileNames.push("main.js");
              contents["main.js"] = "";
            }
            this.hashData = { fileNames, contents };
          } else {
            this.hashData = { fileNames: Object.keys(parsed), contents: parsed };
          }
        } catch {
        }
      }
    }
    onWillStart(async () => {
      if (this.hashTutorial) {
        await this.openTutorial(this.hashTutorial);
      } else if (this.hashData) {
        const { fileNames, contents } = this.hashData;
        this.project.createProject("shared_code", fileNames, contents);
      } else {
        this.project.createProject(
          "hello_world",
          ["main.js"],
          {
            "main.js": HELLO_WORLD_JS
          },
          "Hello World"
        );
      }
    });
    this.hashHandled = false;
    useEffect2(() => {
      const project = this.project.activeProject();
      if (!project) return;
      if (project.tutorial && project.tutorialId) {
        history.replaceState(null, "", "#" + project.tutorialId);
      } else if (this.hashHandled) {
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
      this.hashHandled = true;
    });
    this.exportStandaloneApp = debounce(this.exportStandaloneApp, 250, true);
    const onKeyDown = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        this.view.setShowHelp(false);
        this.code.run();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    onWillDestroy(() => document.removeEventListener("keydown", onKeyDown));
  }
  async onTemplateChange(ev) {
    const desc = ev.target.value;
    ev.target.value = this.currentTemplateValue();
    ev.target.blur();
    if (!desc) return;
    if (desc.startsWith("tutorial:")) {
      const tutorialDesc = desc.slice(9);
      const tutorial = this.tutorials().find((t) => t.description === tutorialDesc);
      if (tutorial) {
        await this.openTutorial(tutorial);
        this.code.requestFocus();
      }
      return;
    }
    const template = this.templates.find((t) => t.description === desc);
    if (!template) return;
    const projects = this.project.projects();
    const activeProject = this.project.activeProject();
    if (projects.length === 1 && activeProject && !this.project.isProjectDirty(activeProject)) {
      this.project.deleteProject(activeProject.id, true);
    }
    const contents = await template.code();
    const fileNames = Object.keys(contents);
    const projectId = template.id || desc.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    this.project.createProject(projectId, fileNames, contents, desc);
    this.view.setShowProjectManager(false);
    this.code.requestFocus();
  }
  async openTutorial(tutorial) {
    await this.templatePlugin.openTutorial(tutorial);
    this.view.setShowProjectManager(false);
  }
  toggleHelp() {
    this.view.toggleHelp();
  }
  shareCode() {
    const snapshot = this.code.getSnapshot();
    const state = btoa(JSON.stringify(snapshot));
    const link = new URL(window.location.href);
    link.hash = state;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link.href);
      clearTimeout(this.copied());
      this.copied.set(setTimeout(() => this.copied.set(null), 2e3));
    }
    window.location.href = link.href;
  }
  onMouseDown() {
    const resizer = (ev) => this.settings.setLeftPaneWidth(ev.clientX);
    document.body.addEventListener("mousemove", resizer);
    for (const iframe of document.getElementsByTagName("iframe")) {
      iframe.classList.add("disabled");
    }
    document.body.addEventListener(
      "mouseup",
      () => {
        document.body.removeEventListener("mousemove", resizer);
        for (const iframe of document.getElementsByTagName("iframe")) {
          iframe.classList.remove("disabled");
        }
      },
      { once: true }
    );
  }
  onSidebarMouseDown() {
    const resizer = (ev) => this.settings.setSidebarWidth(ev.clientX);
    document.body.addEventListener("mousemove", resizer);
    for (const iframe of document.getElementsByTagName("iframe")) {
      iframe.classList.add("disabled");
    }
    document.body.addEventListener(
      "mouseup",
      () => {
        document.body.removeEventListener("mousemove", resizer);
        for (const iframe of document.getElementsByTagName("iframe")) {
          iframe.classList.remove("disabled");
        }
      },
      { once: true }
    );
  }
  openSettings() {
    this.dialog.showDialog(SettingsDialog);
  }
  onDialogKeydown(ev) {
    if (ev.key !== "Tab") return;
    const overlay = ev.currentTarget;
    const focusable = overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }
  async exportStandaloneApp() {
    const snapshot = this.code.getSnapshot();
    await loadJS("libs/jszip.min.js");
    const zip = new JSZip();
    for (const [fileName, content] of Object.entries(snapshot)) {
      zip.file(fileName, content);
    }
    await loadJS("libs/FileSaver.min.js");
    const project = this.project.activeProject();
    const zipName = (project ? project.name : "app").replace(/[^a-zA-Z0-9_-]/g, "_") + ".zip";
    saveAs(await zip.generateAsync({ type: "blob" }), zipName);
  }
};
async function start() {
  document.title = `${document.title} (v${__info__2.version})`;
  const commit = `https://github.com/odoo/owl/commit/${__info__2.hash}`;
  console.info(`This application is using Owl built with the following commit:`, commit);
  const templates = await loadFile("templates.xml");
  await mount(Playground, document.body, {
    name: "Owl Playground",
    templates
  });
}
start();
