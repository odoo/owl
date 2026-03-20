import { Plugin, computed, plugin, signal } from "../owl.js";
import { generateId, getFileType, makeFileEntry } from "./file_utils.js";
import { EXAMPLES, HELLO_WORLD_JS, TUTORIALS, loadFilesFromMapping } from "./samples.js";

class CodePlugin extends Plugin {
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
  modifiedFiles = signal(new Set());
  markdownPreviewMode = signal({});
  focusRequest = signal(0);

  currentFile = computed(() =>
    this.activePane() === "primary" ? this.primaryFile() : this.secondaryFile()
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
    if (mode !== undefined) return mode;
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
    this.modifiedFiles.set(new Set());
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

  addFile(fileName, select = true) {
    const type = getFileType(fileName);
    const defaultContent = type === "xml" ? "<templates>\n</templates>" : "";
    const files = [...this.files(), makeFileEntry(fileName)].sort((a, b) =>
      a.name.localeCompare(b.name)
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
    xml = `<templates>\n${xml}</templates>`;
    this.runCode.set({ jsFiles, css, xml });
  }
}

class TemplatePlugin extends Plugin {
  static id = "templates";

  examples = [];
  tutorials = [];
  list = [];
  categories = [];

  setup() {
    this.examples = EXAMPLES.map((example) => ({
      ...example,
      code:
        Object.keys(example.files).length === 0
          ? () => Promise.resolve({ "main.js": HELLO_WORLD_JS })
          : () => loadFilesFromMapping(example.files),
    }));
    this.tutorials = TUTORIALS.map((tutorial) => ({
      ...tutorial,
      isTutorial: true,
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
        solution: step.solution ? await loadFilesFromMapping(step.solution) : null,
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
}

class ProjectPlugin extends Plugin {
  static id = "project";

  code = plugin(CodePlugin);
  templates = plugin(TemplatePlugin);

  projects = signal([]);
  activeProjectId = signal(null);
  collapsedProjects = signal(new Set());
  ranProjects = new Set();
  tutorialCurrentStepSignal = signal(0);

  activeProject = computed(() => {
    const id = this.activeProjectId();
    return this.projects().find((p) => p.id === id) || null;
  });

  visibleProjects = computed(() => {
    return this.projects()
      .filter((p) => p.visible !== false)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
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
      sequence: projects.length,
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
        sequence: startIndex + ids.length,
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
    filtered.forEach((p, i) => (p.sequence = i));
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
    projects.forEach((p, i) => (p.sequence = i));
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
      activeProjectId: this.activeProjectId(),
    };
  }

  restore(data) {
    this.projects.set(data.projects || []);
    const activeId = data.activeProjectId;
    const project = (data.projects || []).find((p) => p.id === activeId);
    if (project) {
      this.activeProjectId.set(activeId);
      if (project.tutorial && project.currentStep !== undefined) {
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
        solution: step.solution ? { ...step.solution } : null,
      })),
      stepModifiedFiles: [],
      currentStep: 0,
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
    const allKeys = new Set([...keys1, ...keys2]);
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
    project.files = { ...project.files, ...solutionFiles };
    project.fileNames = [...new Set([...project.fileNames, ...Object.keys(solutionFiles)])];

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
    const currentStep = proj.tutorial
      ? proj.id === this.project.activeProjectId()
        ? this.project.tutorialCurrentStepSignal()
        : proj.currentStep || 0
      : 0;
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
      stepModifiedFiles: proj.stepModifiedFiles || null,
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

class ViewPlugin extends Plugin {
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
}

export {
  CodePlugin,
  DialogPlugin,
  LocalStoragePlugin,
  Plugin,
  ProjectPlugin,
  SettingsPlugin,
  TemplatePlugin,
  ViewPlugin,
};
