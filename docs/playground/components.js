import {
  __info__,
  Component,
  computed,
  onMounted,
  onPatched,
  onWillPatch,
  onWillUnmount,
  plugin,
  props,
  signal,
  untrack,
  useEffect,
} from "../owl.js";
import { createOwlCompletions, parseMarkdown, xmlTagRename } from "./code_utils.js";
import { getFileType, LANGUAGES, makeFileEntry, parseFilePaths, TAB_SIZES } from "./file_utils.js";
import {
  abbreviationTracker,
  acceptCompletion,
  basicSetup,
  Compartment,
  EditorState,
  EditorView,
  expandAbbreviation,
  indentLess,
  indentMore,
  indentUnit,
  keymap,
  oneDark,
  Prec,
} from "./libs/codemirror.bundle.js";
import {
  CodePlugin,
  DialogPlugin,
  LocalStoragePlugin,
  ProjectPlugin,
  SettingsPlugin,
  TemplatePlugin,
  ViewPlugin,
} from "./plugins.js";
import { HELLO_WORLD_JS } from "./samples.js";
import { debounce } from "./utils.js";

class CodeEditor extends Component {
  static template = "CodeEditor";

  code = plugin(CodePlugin);
  settings = plugin(SettingsPlugin);
  project = plugin(ProjectPlugin);
  view = plugin(ViewPlugin);

  setup() {
    this.primaryEditorNode = signal(null);
    this.secondaryEditorNode = signal(null);
    this.primaryMarkdownPreview = signal(null);
    this.secondaryMarkdownPreview = signal(null);

    this.fontSizeCompartment = new Compartment();
    this.themeCompartment = new Compartment();
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
        pane.view = new EditorView({ parent: node, state });
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
            changes: { from: 0, to: pane.view.state.doc.length, insert: content },
          });
        }
      }
    });

    useEffect(() => {
      const size = this.settings.fontSize();
      const theme = EditorView.theme({ "&": { fontSize: size + "px" } });
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

  isPrimaryMarkdownPreview = computed(() => {
    const fileName = this.code.primaryFile();
    return this.code.isMarkdownFile(fileName) && this.code.isMarkdownPreview(fileName);
  });

  isSecondaryMarkdownPreview = computed(() => {
    if (!this.code.splitMode()) return false;
    const fileName = this.code.secondaryFile();
    return this.code.isMarkdownFile(fileName) && this.code.isMarkdownPreview(fileName);
  });

  toggleMarkdownPreview(pane) {
    const fileName = pane === "primary" ? this.code.primaryFile() : this.code.secondaryFile();
    this.code.toggleMarkdownPreview(fileName);
  }

  isPrimaryMarkdownFile = computed(() => {
    return this.code.isMarkdownFile(this.code.primaryFile());
  });

  isSecondaryMarkdownFile = computed(() => {
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
    this.code.toggleSplit();
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
              run: (view) =>
                acceptCompletion(view) ||
                (lang === "xml" && expandAbbreviation(view)) ||
                indentMore(view),
              shift: indentLess,
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
              },
            },
          ])
        ),
        new Compartment().of(LANGUAGES[lang]()),
        new Compartment().of(indentUnit.of(" ".repeat(tabSize))),
        EditorState.tabSize.of(tabSize),
        ...(lang === "md" ? [EditorView.lineWrapping] : []),
        ...(lang === "js" ? [createOwlCompletions()] : []),
        ...(lang === "xml" ? [abbreviationTracker(), xmlTagRename()] : []),
        this.fontSizeCompartment.of(
          EditorView.theme({ "&": { fontSize: this.settings.fontSize() + "px" } })
        ),
        this.themeCompartment.of(this.settings.darkMode() ? oneDark : []),
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
  onDarkModeChange(ev) {
    this.settings.setDarkMode(ev.target.checked);
  }
  close() {
    this.dialog.closeDialog();
  }
}

class ProjectManager extends Component {
  static template = "ProjectManager";
  project = plugin(ProjectPlugin);
  code = plugin(CodePlugin);
  localStorage = plugin(LocalStoragePlugin);
  dialog = plugin(DialogPlugin);
  view = plugin(ViewPlugin);

  setup() {
    this.templatePlugin = plugin(TemplatePlugin);
  }

  storedProjects = computed(() => {
    this.localStorage.version();
    const data = this.localStorage.load();
    if (!data || !data.projects) return [];
    return data.projects;
  });

  activeProjects = computed(() => {
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
        project: proj,
      };
    });
  });

  archivedProjects = computed(() => {
    const sessionIds = new Set(this.project.projects().map((p) => p.id));
    const stored = this.storedProjects();
    const activeId = this.project.activeProjectId();

    return stored
      .filter((proj) => !sessionIds.has(proj.id))
      .map((proj) => ({
        id: proj.id,
        name: proj.name,
        description: proj.description || "",
        lastUpdate: proj.lastUpdate,
        isActive: proj.id === activeId,
        isDirty: false,
        isArchived: true,
        project: proj,
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
        },
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
      },
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
      },
    });
  }
}

class NewFileDialog extends Component {
  static template = "NewFileDialog";
  props = props(["existingFiles", "onConfirm", "folder?"], {
    folder: "",
  });
  dialog = plugin(DialogPlugin);

  setup() {
    this.fileName = signal("");
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
}

class NewFolderDialog extends Component {
  static template = "NewFolderDialog";
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
}

class NewComponentDialog extends Component {
  static template = "NewComponentDialog";
  props = props(["existingFiles", "onConfirm", "folder?"]);
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
  view = plugin(ViewPlugin);

  setup() {
    this.expandedFolders = signal(new Set());
    this.collapsedFolders = signal(new Set());
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
    this.folderContextMenu = signal({
      visible: false,
      project: null,
      folder: null,
      x: 0,
      y: 0,
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
    const currentStep =
      proj.id === this.project.activeProjectId()
        ? this.project.tutorialCurrentStep() + 1
        : (proj.currentStep || 0) + 1;
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

    // Check if target already exists
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
    const files =
      proj.id === this.project.activeProjectId()
        ? this.code.files()
        : proj.fileNames.map(makeFileEntry);
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
        },
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
      },
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
    this.folderContextMenu.set({
      visible: false,
      project: null,
      folder: null,
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
        const fileNames = Object.keys(contents);
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
      },
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
      },
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
      },
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
      y: ev.clientY,
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
      },
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
      },
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
      },
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

class ContentView extends Component {
  static template = "ContentView";

  code = plugin(CodePlugin);
  settings = plugin(SettingsPlugin);
  project = plugin(ProjectPlugin);
  dialog = plugin(DialogPlugin);
  view = plugin(ViewPlugin);
  templatePlugin = plugin(TemplatePlugin);

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
        },
      };

      function resolveImport(specifier, fromFile, fileUrlMap) {
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

        return (
          fileUrlMap[resolvedPath] ??
          fileUrlMap[resolvedPath + ".js"] ??
          fileUrlMap[resolvedPath + "/index.js"]
        );
      }

      function rewriteImports(code, fromFile, urlMap) {
        return code
          .replace(
            /((?:import|export)[^'"]*from\s*)(['"])(\.+\/[^'"]+)\2/g,
            (match, prefix, quote, specifier) => {
              const resolved = resolveImport(specifier, fromFile, urlMap);
              return resolved ? `${prefix}${quote}${resolved}${quote}` : match;
            }
          )
          .replace(
            /\bimport\s*(['"])(\.+\/[^'"]+)\1/g,
            (match, quote, specifier) => {
              const resolved = resolveImport(specifier, fromFile, urlMap);
              return resolved ? `import ${quote}${resolved}${quote}` : match;
            }
          )
          .replace(/\bimport\s*\(\s*(['"])(\.+\/[^'"]+)\1\s*\)/g, (match, quote, specifier) => {
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
          "main.js not found — every project must have a main.js entry point"
        );
        if (jsFileNames.length === 0) return;
        const fallback = jsFileNames[0];
        this.addMessage("log", `Falling back to ${fallback}`);
      }

      const entryPoint = mainJsName || jsFileNames[0];

      const nonMainFiles = Object.entries(jsFiles).filter(([name]) => name !== entryPoint);

      // Build blob URLs in multiple passes. Each pass creates blobs with
      // imports rewritten to the previous pass's URLs. Pass 0 uses original
      // code, subsequent passes rewrite relative imports to blob URLs.
      // N passes support import chains N-1 levels deep among non-main files.
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
      script.textContent = `const TEMPLATES = \`${escapedXml}\`\n${mainJs}`;
      script.addEventListener("error", () => {
        this.addMessage("error", "Failed to load module — check your import paths");
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
}

class TutorialBar extends Component {
  static template = "TutorialBar";

  project = plugin(ProjectPlugin);
  dialog = plugin(DialogPlugin);

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
}

export {
  CodeEditor,
  ConfirmDialog,
  ContentView,
  Explorer,
  FileDialog,
  NewComponentDialog,
  NewFileDialog,
  NewFolderDialog,
  NewProjectDialog,
  ProjectDialog,
  ProjectManager,
  SettingsDialog,
  TutorialBar,
  useAutoscroll,
};
