import {
  __info__,
  Component,
  computed,
  effect,
  mount,
  onMounted,
  onPatched,
  onWillDestroy,
  onWillPatch,
  onWillStart,
  onWillUnmount,
  Plugin,
  plugin,
  props,
  providePlugins,
  signal,
  untrack,
  useEffect,
  useListener,
} from "../owl.js";
import {
  autocompletion,
  basicSetup,
  Compartment,
  css as cssLang,
  EditorState,
  EditorView,
  indentUnit,
  acceptCompletion,
  indentLess,
  indentMore,
  javascript,
  keymap,
  markdown,
  oneDark,
  Prec,
  snippet,
  xml as xmlLang,
} from "./libs/codemirror.bundle.js";
import { debounce, loadJS } from "./utils.js";

//------------------------------------------------------------------------------
// Constants, helpers, utils
//------------------------------------------------------------------------------

const LANGUAGES = {
  js: () => javascript(),
  css: () => cssLang(),
  xml: () => xmlLang(),
  md: () => markdown(),
};

const TAB_SIZES = { js: 4, css: 4, xml: 2, md: 2 };

const FILE_ICON_CLASSES = {
  js: "file-icon-js",
  xml: "file-icon-xml",
  css: "file-icon-css",
  md: "file-icon-md",
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
  const folders = new Map();
  const rootFiles = [];

  for (const file of files) {
    const parts = file.name.split("/");
    if (parts.length === 1) {
      rootFiles.push(file);
    } else {
      const folderName = parts[0];
      if (!folders.has(folderName)) {
        folders.set(folderName, []);
      }
      folders.get(folderName).push({
        ...file,
        name: parts.slice(1).join("/"),
        fullName: file.name,
      });
    }
  }

  const sortedFolders = [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, folderFiles] of sortedFolders) {
    folderFiles.sort((a, b) => a.name.localeCompare(b.name));
  }
  rootFiles.sort((a, b) => a.name.localeCompare(b.name));

  return { folders: sortedFolders, rootFiles };
}

const HELLO_WORLD_JS = `import { Component, mount, xml } from "@odoo/owl";

class Root extends Component {
    static template = xml\`<div>Hello Owl!</div>\`;
}

mount(Root, document.body);
`;

//------------------------------------------------------------------------------
// OWL Autocompletion
//------------------------------------------------------------------------------

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

const TEMPLATES = [
  { category: "Examples", description: "Hello World", files: ["main.js"] },
  {
    category: "Examples",
    description: "Simple component",
    folder: "components",
    files: ["main.js", "main.css"],
  },
  {
    category: "Examples",
    description: "Props and list of components",
    folder: "product_card",
    files: ["main.js", "main.css", "product_card.js", "product_card.xml"],
  },
  {
    category: "Examples",
    description: "Component Lifecycle, hooks",
    folder: "lifecycle_demo",
    files: ["helpers.js", "chat_window.js", "main.js", "main.xml"],
  },
  {
    category: "Examples",
    description: "Signals, proxy, computed, effects",
    folder: "reactivity",
    files: ["main.js", "main.xml"],
  },
  {
    category: "Examples",
    description: "Accessing the DOM (t-ref)",
    folder: "canvas",
    files: ["main.js"],
  },
  {
    category: "Examples",
    description: "Form Controls (t-model)",
    folder: "form",
    files: ["main.js", "main.xml"],
  },
  {
    category: "Examples",
    description: "Generic components (slots)",
    folder: "slots",
    files: ["dialog.css", "dialog.js", "dialog.xml", "main.js"],
  },
  {
    category: "Examples",
    description: "Coordinating code (Plugins)",
    folder: "plugins",
    files: ["core_plugins.js", "form_view.js", "main.js"],
  },
  {
    category: "Demos",
    description: "Kanban Board",
    folder: "kanban_board",
    files: ["main.js", "main.xml", "main.css"],
  },
  {
    category: "Demos",
    description: "HTML Editor",
    folder: "html_editor",
    files: ["main.js", "main.css", "html_editor/html_editor.js", "html_editor/html_editor.xml"],
  },
  {
    category: "Demos",
    description: "Web Client",
    folder: "web_client",
    files: ["main.js", "main.xml", "main.css"],
  },
  {
    category: "Tutorials",
    description: "Todo List",
    folder: "todo_app",
    files: ["main.js", "main.xml", "main.css"],
  },
  {
    category: "Tutorials",
    description: "Time Tracker",
    folder: "timer_app",
    files: ["readme.md", "main.js", "main.xml"],
  },
];

const fileCache = {};
const loadFile = (path) => {
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

//------------------------------------------------------------------------------
// Plugins
//------------------------------------------------------------------------------

class CodePlugin extends Plugin {
  static id = "code";

  files = signal([]);
  contents = signal({});
  primaryFile = signal("");
  secondaryFile = signal("");
  activePane = signal("primary");
  splitMode = signal(false);
  splitRatio = signal(0.5);
  contentVersion = signal(0);
  runCode = signal(null);
  userModified = signal(false);

  currentFile = computed(() =>
    this.activePane() === "primary" ? this.primaryFile() : this.secondaryFile()
  );
  currentFileName = computed(() => this.currentFile());

  getContent(fileName) {
    return this.contents()[fileName] || "";
  }

  setContent(fileName, value) {
    this.contents.set({ ...this.contents(), [fileName]: value });
    this.userModified.set(true);
  }

  loadFiles(fileNames, contents, editorState = null) {
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
      this.splitRatio.set(editorState.splitRatio ?? 0.5);
    } else {
      const defaultFile = fileNames.includes("main.js") ? "main.js" : sorted[0] || "";
      this.primaryFile.set(defaultFile);
      this.secondaryFile.set(sorted.find((n) => n !== defaultFile) || defaultFile);
      this.activePane.set("primary");
      this.splitMode.set(false);
      this.splitRatio.set(0.5);
    }
    this.runCode.set(null);
    this.contentVersion.set(this.contentVersion() + 1);
    this.userModified.set(false);
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
      splitRatio: this.splitRatio(),
    };
  }

  selectFile(fileName) {
    if (this.activePane() === "primary") {
      this.primaryFile.set(fileName);
    } else {
      this.secondaryFile.set(fileName);
    }
  }

  addFile(fileName) {
    const type = getFileType(fileName);
    const defaultContent = type === "xml" ? "<templates>\n</templates>" : "";
    const files = [...this.files(), makeFileEntry(fileName)].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    this.files.set(files);
    this.contents.set({ ...this.contents(), [fileName]: defaultContent });
    this.selectFile(fileName);
    this.userModified.set(true);
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
    this.userModified.set(true);
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
    this.userModified.set(true);
  }

  toggleSplit(targetFile = null) {
    const split = !this.splitMode();
    this.splitMode.set(split);
    if (split) {
      const files = this.files();
      const primary = this.primaryFile();
      this.secondaryFile.set(primary);
    } else {
      this.primaryFile.set(targetFile || this.currentFile());
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
    xml = `<templates>\n${xml}</templates>`;
    this.runCode.set({ jsFiles, css, xml });
  }
}

class TemplatePlugin extends Plugin {
  static id = "templates";

  list = [];

  setup() {
    this.list = TEMPLATES.map(({ category, description, folder, files }) => ({
      category,
      description,
      files,
      isTutorial: category === "Tutorials",
      code: folder
        ? async () =>
            Object.fromEntries(
              await Promise.all(
                files.map(async (name) => [name, await loadFile(`./samples/${folder}/${name}`)])
              )
            )
        : () => Promise.resolve({ "main.js": HELLO_WORLD_JS }),
    }));
    this.categories = [];
    for (const tmpl of this.list) {
      let cat = this.categories.find((c) => c.name === tmpl.category);
      if (!cat) {
        cat = { name: tmpl.category, templates: [] };
        this.categories.push(cat);
      }
      cat.templates.push(tmpl);
    }
  }
}

class ProjectPlugin extends Plugin {
  static id = "project";

  code = plugin(CodePlugin);
  templates = plugin(TemplatePlugin);

  projects = signal([]);
  activeProjectId = signal(null);

  activeProject = computed(() => {
    const id = this.activeProjectId();
    return this.projects().find((p) => p.id === id) || null;
  });

  visibleProjects = computed(() => {
    return this.projects()
      .filter((p) => p.visible !== false)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  });

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
      sequence: projects.length,
    };
    this.projects.set([...projects, project]);
    this.activeProjectId.set(project.id);
    this.code.loadFiles(fileNames, contents);
  }

  switchProject(id) {
    if (id === this.activeProjectId()) return;
    this._saveCurrentProject();
    this.activeProjectId.set(id);
    const project = this.projects().find((p) => p.id === id);
    this.code.loadFiles(project.fileNames, project.files, project.editorState);
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

  deleteProject(id) {
    const current = this.projects();
    if (current.length <= 1) return;
    const filtered = current.filter((p) => p.id !== id);
    filtered.forEach((p, i) => (p.sequence = i));
    this.projects.set(filtered);
    if (this.activeProjectId() === id) {
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
    projects.forEach((p, i) => (p.sequence = i));
    this.projects.set([...projects]);
  }

  addFileToProject(fileName) {
    const project = this.activeProject();
    if (project) {
      project.fileNames = [...project.fileNames, fileName];
    }
    this.code.addFile(fileName);
  }

  renameFileInProject(oldName, newName) {
    const project = this.activeProject();
    if (project) {
      project.fileNames = project.fileNames.map((n) => (n === oldName ? newName : n));
      if (project.files[oldName] !== undefined) {
        project.files[newName] = project.files[oldName];
        delete project.files[oldName];
      }
      if (project.originalFiles[oldName] !== undefined) {
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
    const allKeys = new Set([...Object.keys(snapshot), ...Object.keys(original)]);
    for (const key of allKeys) {
      if ((snapshot[key] || "") !== (original[key] || "")) return true;
    }
    return false;
  }

  isProjectDirty(project) {
    if (!project || !project.originalFiles) return false;
    let current;
    if (project.id === this.activeProjectId()) {
      current = this.code.getSnapshot();
    } else {
      current = project.files || {};
    }
    const original = project.originalFiles;
    const allKeys = new Set([...Object.keys(current), ...Object.keys(original)]);
    for (const key of allKeys) {
      if ((current[key] || "") !== (original[key] || "")) return true;
    }
    return false;
  }

  markProjectClean(project) {
    if (project.id === this.activeProjectId()) {
      project.files = this.code.getSnapshot();
    }
    project.originalFiles = { ...project.files };
    this.projects.set([...this.projects()]);
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
      activeProjectId: this.activeProjectId(),
    };
  }

  restore(data) {
    this.projects.set(data.projects || []);
    const activeId = data.activeProjectId;
    const project = (data.projects || []).find((p) => p.id === activeId);
    if (project) {
      this.activeProjectId.set(activeId);
      this.code.loadFiles(project.fileNames, project.files, project.editorState);
    }
  }
}

class LocalStoragePlugin extends Plugin {
  static id = "localStorage";

  code = plugin(CodePlugin);
  project = plugin(ProjectPlugin);
  version = signal(0);

  setup() {}

  saveProject(proj) {
    const existingData = this.load();
    const existingProjects = existingData?.projects || [];
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
    };
    const idx = existingProjects.findIndex((p) => p.id === proj.id);
    if (idx >= 0) {
      existingProjects[idx] = projectData;
    } else {
      existingProjects.push(projectData);
    }
    localStorage.setItem("owl-playground-projects", JSON.stringify({ projects: existingProjects }));
    this.version.set(this.version() + 1);
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
          activeProjectId: id,
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
      if (p.visible === undefined) p.visible = true;
      if (p.lastUpdate === undefined) p.lastUpdate = Date.now();
      if (p.sequence === undefined) p.sequence = i;
    }
  }

  clear() {
    localStorage.removeItem("owl-playground-projects");
    localStorage.removeItem("owl-playground-local-sample");
  }
}

class SettingsPlugin extends Plugin {
  static id = "settings";

  fontSize = signal(parseInt(localStorage.getItem("owl-playground-font-size")) || 13);
  autoRun = signal(localStorage.getItem("owl-playground-auto-run") === "true");
  fullscreen = signal(false);
  leftPaneWidth = signal(Math.ceil((window.innerWidth + 160) / 2));

  leftPaneStyle = computed(() => `width:${this.leftPaneWidth()}px`);

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
}

class DialogPlugin extends Plugin {
  static id = "dialog";

  dialogComponent = signal(null);
  dialogProps = signal({});

  showDialog(Component, props = {}) {
    this.dialogProps.set(props);
    this.dialogComponent.set(Component);
  }

  closeDialog() {
    this.dialogComponent.set(null);
    this.dialogProps.set({});
  }
}

//------------------------------------------------------------------------------
// Components
//------------------------------------------------------------------------------

class CodeEditor extends Component {
  static template = "CodeEditor";

  code = plugin(CodePlugin);
  settings = plugin(SettingsPlugin);

  setup() {
    this.primaryEditorNode = signal(null);
    this.secondaryEditorNode = signal(null);

    this.fontSizeCompartment = new Compartment();
    this.panes = {
      primary: { view: null, states: {}, scrolls: {}, lastFile: null },
      secondary: { view: null, states: {}, scrolls: {}, lastFile: null },
    };

    let lastVersion = null;

    onMounted(() => {
      const fileName = this.code.primaryFile();
      const pane = this.panes.primary;
      const state = this.createEditorState(this.code.getContent(fileName), fileName, "primary");
      pane.view = new EditorView({ parent: this.primaryEditorNode(), state });
      pane.states[fileName] = state;
      pane.lastFile = fileName;
      lastVersion = this.code.contentVersion();
    });

    // Content version changes (project/template switch) — reset all panes
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

    // Primary file switch
    useEffect(() => {
      const fileName = this.code.primaryFile();
      this._switchPaneFile("primary", fileName);
    });

    // Split mode toggle — create/destroy secondary editor
    useEffect(() => {
      const split = this.code.splitMode();
      const node = this.secondaryEditorNode();
      if (split && node && !this.panes.secondary.view) {
        const fileName = untrack(() => this.code.secondaryFile());
        const content = untrack(() => this.code.getContent(fileName));
        const pane = this.panes.secondary;
        const state = this.createEditorState(content, fileName, "secondary");
        pane.view = new EditorView({ parent: node, state });
        pane.states[fileName] = state;
        pane.lastFile = fileName;
      }
      if (!split && this.panes.secondary.view) {
        this.panes.secondary.view.destroy();
        this.panes.secondary = { view: null, states: {}, scrolls: {}, lastFile: null };
      }
    });

    // Secondary file switch
    useEffect(() => {
      if (!this.code.splitMode()) return;
      const fileName = this.code.secondaryFile();
      this._switchPaneFile("secondary", fileName);
    });

    // Sync same-file content between split panes
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
            changes: { from: 0, to: pane.view.state.doc.length, insert: content },
          });
        }
      }
    });

    // Font size
    useEffect(() => {
      const size = this.settings.fontSize();
      const theme = EditorView.theme({ "&": { fontSize: size + "px" } });
      for (const pane of Object.values(this.panes)) {
        if (pane.view) {
          pane.view.dispatch({ effects: this.fontSizeCompartment.reconfigure(theme) });
        }
      }
    });

    onWillUnmount(() => {
      for (const pane of Object.values(this.panes)) {
        if (pane.view) pane.view.destroy();
      }
    });
  }

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
        changes: { from: 0, to: pane.view.state.doc.length, insert: content },
      });
    }
    const scrollTop = pane.scrolls[fileName] || 0;
    requestAnimationFrame(() => {
      if (pane.view) pane.view.scrollDOM.scrollTop = scrollTop;
    });
    pane.view.focus();
  }

  primaryPaneStyle = computed(() => {
    if (!this.code.splitMode()) return "";
    return `flex: ${this.code.splitRatio()} 1 0%`;
  });

  secondaryPaneStyle = computed(() => {
    return `flex: ${1 - this.code.splitRatio()} 1 0%`;
  });

  setActivePane(paneId) {
    this.code.activePane.set(paneId);
  }

  toggleSplit() {
    const currentFile = this.code.currentFile();
    this.code.toggleSplit(currentFile);
  }

  isIdealSplit = computed(() => {
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

  primaryCompanionFile = computed(() => {
    if (this.isIdealSplit()) return null;
    return this._getCompanion(this.code.primaryFile());
  });

  secondaryCompanionFile = computed(() => {
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
              run: (view) => acceptCompletion(view) || indentMore(view),
              shift: indentLess,
            },
            {
              key: "Mod-Enter",
              run: () => {
                this.tab.setTab("sandbox");
                this.code.run();
                return true;
              },
            },
          ])
        ),
        new Compartment().of(LANGUAGES[lang]()),
        new Compartment().of(indentUnit.of(" ".repeat(tabSize))),
        EditorState.tabSize.of(tabSize),
        ...(lang === "md" ? [EditorView.lineWrapping] : []),
        ...(lang === "js" ? [createOwlCompletions()] : []),
        this.fontSizeCompartment.of(
          EditorView.theme({ "&": { fontSize: this.settings.fontSize() + "px" } })
        ),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const value = update.state.doc.toString();
            const pane = this.panes[paneId];
            const file = pane.lastFile;
            if (file && this.code.getContent(file) !== value) {
              this.code.setContent(file, value);
            }
          }
        }),
      ],
    });
  }
}

class ConfirmDialog extends Component {
  static template = "ConfirmDialog";
  props = props(["message", "confirmLabel?", "confirmClass?", "onConfirm"], {
    confirmLabel: "Confirm",
    confirmClass: "primary",
  });
  dialog = plugin(DialogPlugin);

  confirm() {
    this.props.onConfirm();
    this.dialog.closeDialog();
  }
  close() {
    this.dialog.closeDialog();
  }
}

class ProjectDialog extends Component {
  static template = "ProjectDialog";
  props = props(["name", "canDelete", "onRename", "onDelete"]);
  dialog = plugin(DialogPlugin);

  setup() {
    this.nameRef = signal(null);
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
}

class NewProjectDialog extends Component {
  static template = "NewProjectDialog";
  props = props(["templates", "onConfirm"]);
  dialog = plugin(DialogPlugin);

  setup() {
    this.nameRef = signal(null);
    this.templateRef = signal(null);
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
}

class SettingsDialog extends Component {
  static template = "SettingsDialog";
  dialog = plugin(DialogPlugin);
  settings = plugin(SettingsPlugin);

  onFontSizeChange(ev) {
    this.settings.setFontSize(parseInt(ev.target.value));
  }
  onAutoRunChange(ev) {
    this.settings.setAutoRun(ev.target.checked);
  }
  close() {
    this.dialog.closeDialog();
  }
}

class TutorialsDialog extends Component {
  static template = "TutorialsDialog";
  props = props(["tutorials", "onCreateProject"]);
  dialog = plugin(DialogPlugin);

  close() {
    this.dialog.closeDialog();
  }
}

class NewFileDialog extends Component {
  static template = "NewFileDialog";
  props = props(["existingFiles", "onConfirm"]);
  dialog = plugin(DialogPlugin);

  setup() {
    this.nameRef = signal(null);
    this.typeRef = signal(null);
    this.error = signal("");
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
    if (this.props.existingFiles.includes(fileName)) {
      this.error.set(`"${fileName}" already exists`);
      return;
    }
    this.props.onConfirm(fileName);
    this.dialog.closeDialog();
  }

  close() {
    this.dialog.closeDialog();
  }
}

class NewComponentDialog extends Component {
  static template = "NewComponentDialog";
  props = props(["existingFiles", "onConfirm"]);
  dialog = plugin(DialogPlugin);

  setup() {
    this.nameRef = signal(null);
    this.error = signal("");
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
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      this.error.set("Name must be PascalCase (e.g., ProductCard)");
      return;
    }
    const jsFileName = this.toSnakeCase(name) + ".js";
    const xmlFileName = this.toSnakeCase(name) + ".xml";
    if (this.props.existingFiles.includes(jsFileName)) {
      this.error.set(`"${jsFileName}" already exists`);
      return;
    }
    if (this.props.existingFiles.includes(xmlFileName)) {
      this.error.set(`"${xmlFileName}" already exists`);
      return;
    }
    this.props.onConfirm(name, jsFileName, xmlFileName);
    this.dialog.closeDialog();
  }

  toSnakeCase(name) {
    return name
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
  }

  close() {
    this.dialog.closeDialog();
  }
}

class FileDialog extends Component {
  static template = "FileDialog";
  props = props(["fileName", "existingFiles", "canDelete", "onRename", "onDelete"]);
  dialog = plugin(DialogPlugin);

  setup() {
    this.nameRef = signal(null);
    this.typeRef = signal(null);
    this.error = signal("");
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
}

class Explorer extends Component {
  static template = "Explorer";

  code = plugin(CodePlugin);
  project = plugin(ProjectPlugin);
  dialog = plugin(DialogPlugin);
  localStorage = plugin(LocalStoragePlugin);
  templatePlugin = plugin(TemplatePlugin);

  setup() {
    this.collapsedProjects = signal(new Set());
    this.expandedFolders = signal(new Set());
    this.sidebarContextMenu = signal({ visible: false, x: 0, y: 0 });
    this.projectContextMenu = signal({ visible: false, project: null, x: 0, y: 0 });
    this.fileContextMenu = signal({
      visible: false,
      project: null,
      fileName: null,
      canDelete: false,
      x: 0,
      y: 0,
    });

    useEffect(() => {
      const handler = () => this.hideContextMenu();
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    });
  }

  isExpanded(projId) {
    return !this.collapsedProjects().has(projId);
  }

  isProjectDirty(proj) {
    if (proj.id === this.project.activeProjectId()) {
      this.code.contents();
    }
    return this.project.isProjectDirty(proj);
  }

  canSaveProject(proj) {
    if (this.isProjectDirty(proj)) return true;
    const data = this.localStorage.load();
    if (!data || !data.projects) return true;
    return !data.projects.some((p) => p.id === proj.id);
  }

  toggleExpand(projId) {
    const set = new Set(this.collapsedProjects());
    if (set.has(projId)) set.delete(projId);
    else set.add(projId);
    this.collapsedProjects.set(set);
  }

  selectProject(projId) {
    const set = new Set(this.collapsedProjects());
    set.delete(projId);
    this.collapsedProjects.set(set);
    this.project.switchProject(projId);
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

    // Initialize all folders as expanded
    const current = this.expandedFolders();
    const newSet = new Set(current);
    for (const [folder] of parsed.folders) {
      newSet.add(folder);
    }
    if (newSet.size !== current.size) {
      this.expandedFolders.set(newSet);
    }

    return parsed;
  }

  isFolderExpanded(folder) {
    return this.expandedFolders().has(folder);
  }

  toggleFolder(folder) {
    const set = new Set(this.expandedFolders());
    if (set.has(folder)) {
      set.delete(folder);
    } else {
      set.add(folder);
    }
    this.expandedFolders.set(set);
  }

  selectFile(projId, fileName) {
    if (this.project.activeProjectId() !== projId) {
      const set = new Set(this.collapsedProjects());
      set.delete(projId);
      this.collapsedProjects.set(set);
      this.project.switchProject(projId);
    }
    this.code.selectFile(fileName);
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
      },
    });
  }

  editFile(projId, fileName) {
    if (this.project.activeProjectId() !== projId) return;
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
      },
    });
  }

  showNewFileDialog() {
    const existingFiles = this.code.files().map((f) => f.name);
    this.dialog.showDialog(NewFileDialog, {
      existingFiles,
      onConfirm: (fileName) => {
        this.project.addFileToProject(fileName);
      },
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
      y: 0,
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
        const fileNames = template ? template.files : ["main.js"];
        this.project.createProject(name, fileNames, contents, templateDesc);
      },
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
      },
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
      },
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
    const contents = { ...proj.files };
    this.project.createProject(name, fileNames, contents, null);
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
      },
    });
  }

  showFileContextMenu(ev, proj, fileName) {
    ev.stopPropagation();
    const files = proj.id === this.project.activeProjectId() ? this.code.files() : proj.fileNames;
    const canDelete = files.length > 1;
    this.fileContextMenu.set({
      visible: true,
      project: proj,
      fileName,
      canDelete,
      x: ev.clientX,
      y: ev.clientY,
    });
  }

  fileContextMenuStyle() {
    const { x, y } = this.fileContextMenu();
    return `left: ${x}px; top: ${y}px;`;
  }

  fileContextMenuRename() {
    const { project: proj, fileName } = this.fileContextMenu();
    this.hideContextMenu();
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
      },
    });
  }

  fileContextMenuDelete() {
    const { project: proj, fileName } = this.fileContextMenu();
    this.hideContextMenu();
    if (this.project.activeProjectId() !== proj.id) {
      this.project.switchProject(proj.id);
    }
    this.dialog.showDialog(ConfirmDialog, {
      message: `Delete file "${fileName}"?`,
      confirmLabel: "Delete",
      confirmClass: "danger",
      onConfirm: () => {
        this.project.deleteFileFromProject(fileName);
      },
    });
  }
}

function useAutoscroll() {
  const target = signal();
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

class TabPlugin extends Plugin {
  static id = "tab";

  activeTab = signal("sandbox");

  setTab(tab) {
    this.activeTab.set(tab);
  }
}

class ContentView extends Component {
  static template = "ContentView";

  code = plugin(CodePlugin);
  settings = plugin(SettingsPlugin);
  project = plugin(ProjectPlugin);
  tab = plugin(TabPlugin);
  localStorage = plugin(LocalStoragePlugin);
  dialog = plugin(DialogPlugin);

  messageList = useAutoscroll();

  setup() {
    this.displayWelcome = signal(true);
    this.content = signal(null);
    this.consoleMessages = signal.Array([]);
    this.showConsole = signal(false);
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
      if (!autoRun || !untrack(() => this.code.userModified())) return;
      debouncedRun();
    });
  }

  setTab(tab) {
    this.tab.setTab(tab);
  }

  storedProjects = computed(() => {
    this.localStorage.version();
    const data = this.localStorage.load();
    if (!data || !data.projects) return [];
    return data.projects;
  });

  allProjects = computed(() => {
    const stored = this.storedProjects();
    const sessionProjects = this.project.projects();
    const sessionIds = new Set(sessionProjects.map((p) => p.id));
    const storedIds = new Set(stored.map((p) => p.id));
    const activeId = this.project.activeProjectId();

    const result = [];
    let newProjectIndex = stored.length;

    for (const proj of stored) {
      const isInSession = sessionIds.has(proj.id);
      const sessionProj = isInSession ? sessionProjects.find((p) => p.id === proj.id) : null;

      result.push({
        id: proj.id,
        name: proj.name,
        description: isInSession
          ? sessionProj.description || proj.description || ""
          : proj.description || "",
        lastUpdate: proj.lastUpdate,
        sequence: proj.sequence ?? result.length,
        isInSession,
        isInLocalStorage: true,
        isActive: proj.id === activeId,
        isDirty: isInSession ? this.project.isProjectDirty(sessionProj) : false,
        project: isInSession ? sessionProj : proj,
      });
    }

    for (const proj of sessionProjects) {
      if (storedIds.has(proj.id)) continue;

      result.push({
        id: proj.id,
        name: proj.name,
        description: proj.description || "",
        lastUpdate: null,
        sequence: newProjectIndex++,
        isInSession: true,
        isInLocalStorage: false,
        isActive: proj.id === activeId,
        isDirty: this.project.isProjectDirty(proj),
        project: proj,
      });
    }

    return result;
  });

  formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
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
  }

  deleteProject(proj) {
    const projectData = proj.project || proj;
    this.dialog.showDialog(ConfirmDialog, {
      message: `Delete project "${proj.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmClass: "danger",
      onConfirm: () => {
        if (proj.isInLocalStorage) {
          this.localStorage.deleteFromStorage(proj.id);
        }
        const sessionProj = this.project.projects().find((p) => p.id === proj.id);
        if (sessionProj && this.project.projects().length > 1) {
          this.project.deleteProject(proj.id);
        }
      },
    });
  }

  saveProject(proj) {
    const sessionProj = this.project.projects().find((p) => p.id === proj.id);
    if (sessionProj) {
      if (this.project.activeProjectId() === proj.id) {
        sessionProj.files = this.code.getSnapshot();
      }
      this.localStorage.saveProject(sessionProj);
      this.project.markProjectClean(sessionProj);
    }
  }

  activateProject(proj) {
    if (!proj.isInSession) {
      this.loadProject(proj.project);
    } else {
      this.project.switchProject(proj.id);
    }
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
  }

  updateDescription(proj, description) {
    const sessionProj = this.project.projects().find((p) => p.id === proj.id);
    if (sessionProj) {
      sessionProj.description = description;
    }
    if (proj.isInLocalStorage) {
      this.localStorage.updateProjectDescription(proj.id, description);
    }
  }

  openNewProjectDialog() {
    this.dialog.showDialog(NewProjectDialog, {
      templates: this.project.templates.list,
      onConfirm: async (name, templateDesc) => {
        const template = this.project.templates.list.find((t) => t.description === templateDesc);
        const contents = template ? await template.code() : { "main.js": HELLO_WORLD_JS };
        const fileNames = template ? template.files : ["main.js"];
        this.project.createProject(name, fileNames, contents, templateDesc);
      },
    });
  }

  runCode() {
    this.code.run();
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

  errorCount = computed(() => this.consoleMessages().filter((m) => m.type === "error").length);

  formatArgs(args) {
    return args
      .map((a) => {
        if (a === null) return "null";
        if (a === undefined) return "undefined";
        if (typeof a === "object") {
          try {
            return JSON.stringify(a, null, 2);
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(" ");
  }

  run({ jsFiles, css, xml }) {
    this.content().innerHTML = "";
    this.displayWelcome.set(false);
    this.consoleMessages.set([]);
    const iframe = document.createElement("iframe");
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;

      // Capture errors
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

      // Override console to capture output
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
        },
      };

      function rewriteImports(code, urlMap) {
        // Handles: import … from "./x" / export … from "./x" / import("./x")
        return code
          .replace(
            /((?:import|export)[^'"]*from\s*)(['"])(\.\/[^'"]+)\2/g,
            (match, prefix, quote, specifier) => {
              const resolved =
                urlMap[specifier] ?? urlMap[specifier + ".js"] ?? urlMap[specifier + "/index.js"];
              return resolved ? `${prefix}${quote}${resolved}${quote}` : match;
            }
          )
          .replace(/\bimport\s*\(\s*(['"])(\.\/[^'"]+)\1\s*\)/g, (match, quote, specifier) => {
            const resolved =
              urlMap[specifier] ?? urlMap[specifier + ".js"] ?? urlMap[specifier + "/index.js"];
            return resolved ? `import(${quote}${resolved}${quote})` : match;
          });
      }

      const imports = { "@odoo/owl": "../owl.js" };
      const blobUrls = [];

      const mainJsName =
        Object.keys(jsFiles).find((n) => n === "main.js") || Object.keys(jsFiles)[0];

      const nonMainFiles = Object.entries(jsFiles).filter(([name]) => name !== mainJsName);

      // Pass 1 – create placeholder blob URLs so every file has an address
      const fileUrlMap = {}; // "./foo.js" → blobUrl
      for (const [name, code] of nonMainFiles) {
        const blob = new Blob([code], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        blobUrls.push(url);
        fileUrlMap["./" + name] = url;
        if (name.endsWith(".js")) fileUrlMap["./" + name.slice(0, -3)] = url;
      }

      // Pass 2 – rewrite imports inside each file, recreate blobs, update map
      for (const [name, code] of nonMainFiles) {
        const rewritten = rewriteImports(code, fileUrlMap);
        const blob = new Blob([rewritten], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        blobUrls.push(url); // track for later revocation
        fileUrlMap["./" + name] = url;
        if (name.endsWith(".js")) fileUrlMap["./" + name.slice(0, -3)] = url;
      }

      // Merge into the import map (main.js itself still uses the import map normally)
      Object.assign(imports, fileUrlMap);
      console.log(imports);

      const importMap = doc.createElement("script");
      importMap.type = "importmap";
      importMap.textContent = JSON.stringify({ imports });
      doc.head.appendChild(importMap);

      const script = doc.createElement("script");
      script.type = "module";
      const escapedXml = xml.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/, "\\${");
      const mainJs = jsFiles[mainJsName] || "";
      script.textContent = `const TEMPLATES = \`${escapedXml}\`\n${mainJs}`;
      script.addEventListener("error", () => {
        this.addMessage("error", "Failed to load module — check your import paths");
      });
      doc.body.appendChild(script);

      const baseStyle = document.createElement("style");
      baseStyle.textContent = "body { font-family: system-ui, sans-serif; }";
      doc.head.appendChild(baseStyle);

      const style = document.createElement("style");
      style.innerText = css;
      doc.head.appendChild(style);
    };
    this.content().appendChild(iframe);
  }
}

//------------------------------------------------------------------------------
// Main App
//------------------------------------------------------------------------------
class Playground extends Component {
  static template = "Playground";
  static components = { CodeEditor, ContentView, Explorer, TutorialsDialog };

  setup() {
    this.version = __info__.version;
    providePlugins([
      CodePlugin,
      TemplatePlugin,
      ProjectPlugin,
      LocalStoragePlugin,
      SettingsPlugin,
      DialogPlugin,
      TabPlugin,
    ]);

    this.code = plugin(CodePlugin);
    this.project = plugin(ProjectPlugin);
    this.templatePlugin = plugin(TemplatePlugin);
    this.localStorage = plugin(LocalStoragePlugin);
    this.settings = plugin(SettingsPlugin);
    this.dialog = plugin(DialogPlugin);
    this.tab = plugin(TabPlugin);

    this.templates = this.templatePlugin.list;
    this.categories = this.templatePlugin.categories;
    this.tutorials = computed(() => this.templatePlugin.list.filter((t) => t.isTutorial));
    this.nonTutorialCategories = computed(() =>
      this.templatePlugin.categories
        .filter((cat) => cat.name !== "Tutorials")
        .map((cat) => ({
          ...cat,
          templates: cat.templates.filter((t) => !t.isTutorial),
        }))
    );
    this.copied = signal(null);
    this.templateSelectRef = signal(null);

    this.currentTemplateValue = computed(() => {
      const project = this.project.activeProject();
      if (!project || !project.templateDesc) return "";
      if (this.project.isCurrentProjectDirty()) return "";
      return project.templateDesc;
    });

    useEffect(() => {
      const el = this.templateSelectRef();
      const val = this.currentTemplateValue();
      if (el) el.value = val;
    });

    this.hashData = null;
    if (window.location.hash) {
      try {
        const parsed = JSON.parse(atob(decodeURIComponent(window.location.hash.slice(1))));
        // Support old format { js, css, xml } and new format { "main.js": "...", ... }
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
      } catch {}
    }

    onWillStart(() => {
      if (this.hashData) {
        const { fileNames, contents } = this.hashData;
        this.project.createProject("Shared Code", fileNames, contents);
      } else {
        this.project.createProject(
          "playground",
          ["main.js"],
          {
            "main.js": HELLO_WORLD_JS,
          },
          "Hello World"
        );
      }
    });

    this.exportStandaloneApp = debounce(this.exportStandaloneApp, 250, true);

    const onKeyDown = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        this.tab.setTab("sandbox");
        this.code.run();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    onWillDestroy(() => document.removeEventListener("keydown", onKeyDown));
  }

  onTemplateChange(ev) {
    const desc = ev.target.value;
    ev.target.value = this.currentTemplateValue();
    if (!desc) return;

    const template = this.templates.find((t) => t.description === desc);
    if (!template) return;

    const apply = async () => {
      const contents = await template.code();
      this.project.applyTemplate(template.files, contents, desc);
    };

    if (!this.project.isCurrentProjectDirty()) {
      apply();
    } else {
      this.dialog.showDialog(ConfirmDialog, {
        message: `Replace current project files with "${desc}" preset?`,
        onConfirm: apply,
      });
    }
  }

  async createTutorialProject(template) {
    const contents = await template.code();
    this.project.createProject(
      template.description,
      template.files,
      contents,
      template.description,
      "Tutorial"
    );
  }

  openTutorialsDialog() {
    this.dialog.showDialog(TutorialsDialog, {
      tutorials: this.tutorials(),
      onCreateProject: async (template) => {
        await this.createTutorialProject(template);
        this.dialog.closeDialog();
      },
    });
  }

  runCode() {
    this.tab.setTab("sandbox");
    this.code.run();
  }

  shareCode() {
    const snapshot = this.code.getSnapshot();
    const state = btoa(JSON.stringify(snapshot));
    const link = new URL(window.location.href);
    link.hash = state;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link.href);
      clearTimeout(this.copied());
      this.copied.set(setTimeout(() => this.copied.set(null), 2000));
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

  openSettings() {
    this.dialog.showDialog(SettingsDialog);
  }

  async exportStandaloneApp() {
    const snapshot = this.code.getSnapshot();
    const fileList = this.code.files();
    let jsContent = "";
    let cssContent = "";
    let xmlContent = "";
    for (const f of fileList) {
      const content = snapshot[f.name] || "";
      if (f.type === "js") {
        jsContent += content + "\n";
      } else if (f.type === "css") {
        cssContent += content + "\n";
      } else if (f.type === "xml") {
        const inner = content.replace(/<\/?templates>/g, "").trim();
        if (inner) xmlContent += inner + "\n";
      }
    }
    xmlContent = `<templates>\n${xmlContent}</templates>`;

    await loadJS("libs/jszip.min.js");
    const zip = new JSZip();
    zip.file("app.py", await loadFile("./standalone_app/app.py"));
    zip.file("index.html", await loadFile("./standalone_app/index.html"));
    zip.file("owl.js", await loadFile("../owl.js"));
    zip.file("app.js", `const TEMPLATES = await (await fetch('app.xml')).text();\n${jsContent}`);
    zip.file("app.css", cssContent);
    zip.file("app.xml", xmlContent);

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
  const templates = await loadFile("templates.xml");
  await mount(Playground, document.body, {
    name: "Owl Playground",
    templates,
  });
}

start();
