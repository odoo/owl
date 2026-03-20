import {
  __info__,
  Component,
  computed,
  mount,
  onWillDestroy,
  onWillStart,
  plugin,
  providePlugins,
  signal,
  useEffect,
} from "../owl.js";
import {
  CodeEditor,
  ContentView,
  Explorer,
  ProjectManager,
  SettingsDialog,
  TutorialBar,
} from "./components.js";
import {
  CodePlugin,
  DialogPlugin,
  LocalStoragePlugin,
  ProjectPlugin,
  SettingsPlugin,
  TemplatePlugin,
  ViewPlugin,
} from "./plugins.js";
import { HELLO_WORLD_JS, loadFile } from "./samples.js";
import { debounce, loadJS } from "./utils.js";

class Playground extends Component {
  static template = "Playground";
  static components = { CodeEditor, ContentView, Explorer, ProjectManager, TutorialBar };

  setup() {
    this.version = __info__.version;
    providePlugins([
      CodePlugin,
      TemplatePlugin,
      ProjectPlugin,
      LocalStoragePlugin,
      SettingsPlugin,
      DialogPlugin,
      ViewPlugin,
    ]);

    this.code = plugin(CodePlugin);
    this.project = plugin(ProjectPlugin);
    this.templatePlugin = plugin(TemplatePlugin);
    this.localStorage = plugin(LocalStoragePlugin);
    this.settings = plugin(SettingsPlugin);
    this.dialog = plugin(DialogPlugin);
    this.view = plugin(ViewPlugin);

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
        this.project.createProject("shared_code", fileNames, contents);
      } else {
        this.project.createProject(
          "hello_world",
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
