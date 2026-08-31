# OWL Playground - Architecture & Design Reference

## Overview

Interactive IDE for learning and prototyping with the Owl framework. Runs entirely in the browser, executes user code in a sandboxed iframe, and edits with the Monaco editor (the same editor that powers VS Code). It can run either the current Owl v3 (bundled from this repo) or Owl v2 (loaded from a CDN), switchable per project.

**Note:** There is no need to run the tests (`npm run test`), because they only test Owl itself, not the playground.

**Note:** There is no need to run `npm run build`, because it only builds Owl and not the playground.

## Architecture

### Entry Points

- `static/index.html` - Main entry, loads `playground.js` as ES module
- `src/playground.js` - Root `Playground` component and application bootstrap
- `src/plugins.js` - State management via 8 Owl plugins
- `src/components.js` - All UI components (CodeEditor, Explorer, ContentView, TutorialBar, dialogs)
- `src/samples.js` - Example and tutorial catalogs (per Owl version) and file loading
- `src/code_utils.js` - Markdown rendering for readmes (`marked` + `highlight.js`)
- `src/file_utils.js` - File-related helpers (`getFileType`, `makeFileEntry`, path-tree parsing)
- `src/versions.js` - The v2/v3 version catalog used by the version switcher
- `src/monaco/` - Monaco setup: TypeScript-powered auto-import completions
  (`auto_import.js`), Vim keybindings, snippets, and XML tag-rename support

`src/playground.js` is bundled by `build.mjs` (esbuild) into `dist/playground.js`,
which is what `static/index.html` actually loads at runtime — `static/` and
`dist/` are served together (see `server.py`).

### Component Hierarchy

```
Playground (root)
├── Explorer (sidebar)
│   └── Project/file tree with expand/collapse, context menus
├── CodeEditor (split-pane)
│   ├── primary editor pane
│   └── secondary editor pane (optional, split mode)
├── ContentView (preview area)
│   ├── iframe (user code execution sandbox)
│   └── console pane (log/error/warn output)
├── TutorialBar (step navigation for tutorial projects)
├── ProjectManager (template/tutorial picker dialog)
└── Dialog overlays (settings, new file/folder/component, project, confirm)
```

### Plugin System

8 plugins provided via `providePlugins()` at Playground mount (`src/plugins.js`):

#### 1. CodePlugin (`code`)

Manages file content and editor state.

**State signals:**

- `files` - Array of `{name, type, iconClass}`
- `contents` - Object mapping filename → content
- `primaryFile`, `secondaryFile` - Current file per pane
- `activePane` - 'primary' or 'secondary'
- `splitMode`, `splitRatio` - Split-pane state
- `contentVersion` - Increments on file load
- `runCode` - Snapshot passed to `ContentView` to trigger execution
- `modifiedFiles` - Set of dirty filenames
- `markdownPreviewMode` - Per-file preview/edit toggle for `.md` files

**Key methods:**

- `loadFiles(fileNames, contents, editorState?)` - Load a project
- `setContent(fileName, value)` - Update file content
- `run()` - Collects js/css/xml file contents and publishes them to `runCode`
- `getSnapshot()` - Get all file contents (used by export and localStorage)
- `addFile()`, `renameFile()`, `deleteFile()`

#### 2. VersionPlugin (`version`)

Tracks which Owl version (`v3` or `v2`) the current project runs against.
`src/versions.js` maps each version to a `path` (`../owl.js` for v3, an
`esm.sh` CDN URL for v2) used to build the preview iframe's import map, and a
`types` URL used to feed Monaco's TypeScript autocompletion the matching
`.d.ts`.

#### 3. TemplatePlugin (`templates`)

Exposes the example/tutorial catalog for the active Owl version (from
`EXAMPLES`/`TUTORIALS` in `samples.js`), grouped by category, plus
`openTutorial()` to load a tutorial's steps into a new project.

#### 4. ProjectPlugin (`project`)

Multi-project management with dirty tracking.

**State:**

- `projects` - Array of project objects
- `activeProjectId` - Current project

**Key methods:**

- `createProject()`, `createTutorialProject()`, `switchProject()`, `deleteProject()`
- `addFileToProject()`, `renameFileInProject()`, `deleteFileFromProject()`
- `applyTemplate()` - Replace files with a template's
- `isProjectDirty()` - Compare current files against the originals
- `markProjectAsRun()` - Tracked so auto-run only kicks in after a first manual run

#### 5. LocalStoragePlugin (`localStorage`)

Persists projects to `localStorage`.

#### 6. SettingsPlugin (`settings`)

**State**, each persisted to `localStorage`:

- `fontSize` - Number, editor font size
- `autoRun` - Boolean, run on change with a 500ms debounce
- `darkMode` - Boolean, toggles the `light-mode` class on `<html>` and the
  Monaco theme (`slate-dark` / `github-light`)
- `vimMode` - Boolean, attaches Vim keybindings to the editor
- `fullscreen`, `leftPaneWidth`, `sidebarWidth` - Layout state

#### 7. DialogPlugin (`dialog`)

Modal management (`showDialog(Component, props)` / `closeDialog()`).

#### 8. ViewPlugin (`view`)

Small bit of shared UI state — currently just whether the `ProjectManager`
dialog is open (`showProjectManager`).

### Key Components

All in `src/components.js` (1995 lines):

#### CodeEditor (`components.js:34-509`)

Monaco integration with split-pane support.

**Features:**

- Language support: js, css, xml, md (`LANGUAGES` map in `file_utils.js`)
- Tab sizes: js/css=4, xml/md=2 (`TAB_SIZES` in `file_utils.js`)
- Theme follows dark mode: `slate-dark` (dark) / `github-light` (light)
- Optional Vim mode per pane, with its own status bar
- Markdown files can toggle between an editable view and a rendered preview
- State preservation per file (Monaco model, scroll position)

**Effects:**

- Content version change → reset panes
- Primary/secondary file change → switch pane file, reapply Vim mode
- Split mode toggle → create/destroy secondary editor
- Dark mode change → reconfigure Monaco theme

#### ContentView (`components.js:1648-1929`)

User code execution in a sandboxed iframe.

**Features:**

- Console capture: log/warn/error/info, with `cause` chains for errors
- Welcome screen when no code has run yet
- Auto-run (debounced) once a project has been run manually at least once

**`run({ jsFiles, css, xml })` (`components.js:1776`):**

1. Creates an iframe
2. Builds an import map: `{ "@odoo/owl": <path for the active version> }`,
   plus a blob URL per non-entry JS file (rewriting each file's relative
   imports across several passes to support import chains between them)
3. Injects a `<script type="module">` defining a `TEMPLATES` global followed
   by the entry file's (`main.js`) content
4. Injects the collected CSS as a `<style>` tag

The js/css/xml collection itself happens in `CodePlugin.run()`
(`plugins.js:177`).

#### Explorer (`components.js:1027-1647`)

Sidebar with the project/file tree.

**Features:**

- Expand/collapse folders, per-file and per-folder context menus
- New file / new folder / new component dialogs
- Template/tutorial picker via `ProjectManager`

#### TutorialBar (`components.js:1930-1995`)

Step navigation (previous/next, jump to step) shown for projects created
from a tutorial, plus buttons to reveal the current step's solution or reset
it back to the step's starting files.

## Sample Applications

Catalogs live in `src/samples.js`. Examples are split per Owl version
(`EXAMPLES_V3` / `EXAMPLES_V2`); tutorials only exist for v3 (`TUTORIALS_V3`).
The tables below are the v3 catalog, the default and the one under active
development.

### Examples

| ID               | Description                | Files                                                          |
| ---------------- | --------------------------- | --------------------------------------------------------------- |
| hello_world      | Hello World                 | main.js                                                          |
| sub_component    | Sub-component                | main.js                                                          |
| props             | Props and validation         | main.js, main.css, product_card.js/xml                          |
| list_reactivity  | Reactive list (proxy + computed) | main.js                                                     |
| form_binding     | Form binding (t-model)       | main.js, main.xml                                                |
| dom_ref          | DOM access (t-ref)           | main.js                                                          |
| slots            | Slots (default + named)      | dialog.css/js/xml, main.js                                       |
| plugins          | Plugins (shared state)       | main.js                                                          |
| async_suspense   | Async + Suspense             | main.js                                                          |

Two more samples, `kanban_board` and `web_client`, still have their source
under `samples/v3/`, but their catalog entries in `samples.js` are commented
out ("not ready yet, ... re-enable these entries once the demos are
polished"), so they don't appear in the picker today.

### Tutorials

| ID              | Name           | Steps | Description                          |
| ---------------- | -------------- | ----- | -------------------------------------- |
| getting_started  | Getting Started | 5     | Owl fundamentals, step by step         |
| todo_list        | Todo List       | 10    | Build a complete todo app with Owl     |
| hibou_os         | Hibou OS        | 15    | Build a mini desktop environment       |

Each tutorial step can carry its own `readme.md`, starting files, and an
optional solution; `TemplatePlugin.openTutorial()` loads all of a tutorial's
steps into one project, and `TutorialBar` walks between them.

## File Structure

```
tools/playground/
├── build.mjs                # esbuild bundling of src/playground.js → dist/
├── build_monaco.mjs         # Bundles Monaco + Shiki into libs/monaco/
├── server.py                # Dev server (serves static/, dist/, and repo-root owl.js)
├── src/
│   ├── playground.js        # Root component + bootstrap (343 lines)
│   ├── plugins.js           # All 8 Owl plugins (1117 lines)
│   ├── components.js        # All UI components + hooks (1995 lines)
│   ├── samples.js           # EXAMPLES/TUTORIALS catalogs, file loading (1091 lines)
│   ├── code_utils.js        # Markdown rendering (marked + highlight.js)
│   ├── file_utils.js        # LANGUAGES, TAB_SIZES, getFileType, path-tree helpers
│   ├── versions.js          # v2/v3 version catalog
│   ├── utils.js             # debounce, loadJS
│   ├── asset_url.js         # Resolves an asset path relative to this module
│   └── monaco/              # Monaco setup: auto-import, Vim mode, snippets, XML rename
├── static/
│   ├── index.html           # Served entry point
│   ├── playground.css       # Styles
│   ├── monaco.bundle.css    # Monaco's own stylesheet
│   ├── templates.xml        # Owl templates, one per component
│   ├── playground.md        # This file
│   └── tutorials.md         # How to write a tutorial
├── libs/
│   ├── jszip.min.js          # ZIP creation for export
│   ├── FileSaver.min.js      # File download helper
│   ├── marked.min.js         # Markdown parser (vendored, was CDN)
│   ├── marked-highlight.min.js # marked <-> highlight.js bridge (vendored, was CDN)
│   ├── highlight.min.js      # Syntax highlighting (vendored, was CDN)
│   └── monaco/                # Bundled Monaco + Shiki (via build_monaco.mjs)
└── samples/
    └── v3/                   # One folder per example id, plus tutorials/<name>/<step>/
```

## Important Implementation Details

### Auto-run Feature

When `SettingsPlugin.autoRun()` is true and the current project has already
been run manually at least once, editing a non-markdown file triggers a
debounced (500ms) `code.run()`.

### Code Sharing

`ProjectPlugin` supports `serialize()`/`restore()` for `localStorage`
persistence (via `LocalStoragePlugin`), keyed per project.

### Standalone Export

`exportStandaloneApp()` (`playground.js:318-329`) is deliberately simple: it
snapshots the current project's files (`code.getSnapshot()`) and zips them
as-is with `jszip`, then triggers a download via `FileSaver`. It does not
bundle Owl, does not produce combined `app.js`/`app.css`/`app.xml` files,
and there is no companion server or standalone-app template anywhere in the
repo — the ZIP just contains the project's own files.

## Key Imports from Owl

`playground.js`, `components.js`, and `plugins.js` import from `@odoo/owl`,
including:

```javascript
import {
  // Core
  __info__, // Version info
  Component, // Base class
  mount, // Mount function

  // Reactivity
  signal, // Reactive value
  computed, // Computed value
  untrack, // Untracked read

  // Lifecycle hooks
  onMounted,
  onPatched,
  onWillDestroy,
  onWillPatch,
  onWillStart,
  onWillUnmount,

  // Effects
  useEffect,

  // Plugin system
  Plugin, // Base plugin class
  usePlugin, // Import a plugin dependency
  providePlugins, // Provide plugins to a subtree

  // Props
  useProps, // Props declaration hook
  t, // Type-validation builders
} from "@odoo/owl";
```

## Templates (templates.xml)

One template per component, matched by name:

| Template Name     | Component         |
| ------------------ | ------------------ |
| CodeEditor          | CodeEditor          |
| TutorialBar         | TutorialBar         |
| ConfirmDialog        | ConfirmDialog        |
| NewProjectDialog     | NewProjectDialog     |
| SettingsDialog       | SettingsDialog       |
| NewFileDialog        | NewFileDialog        |
| NewFolderDialog      | NewFolderDialog      |
| NewComponentDialog   | NewComponentDialog   |
| FileDialog           | FileDialog           |
| ProjectDialog        | ProjectDialog        |
| ProjectManager       | ProjectManager       |
| Explorer             | Explorer             |
| ContentView          | ContentView          |
| Playground           | Playground           |

## CSS Architecture (playground.css)

### Layout

```css
.playground {
  display: grid;
  grid-template-columns: auto 4px 1fr;
  grid-template-rows: auto 1fr;
}
```

### Theming

There's no CSS custom-property theme layer: colors are set per-selector, and
dark/light mode is a single `light-mode` class toggled on `<html>` by
`SettingsPlugin._applyTheme()` — most rules are written dark-first, with
`.light-mode` overrides layered on top (see `.light-mode .editor-area`,
`.light-mode .sidebar`, etc.). The Monaco editor tracks the same toggle via
its own `slate-dark`/`github-light` themes (see CodeEditor above).

### Key Classes

- `.editor-area` - Flex column for the split editor
- `.editor-pane` - Single editor pane
- `.editor-split-separator` - Draggable divider
- `.file-icon-{js,xml,css,md}` - File type icons
- `.console-msg` - Log output with type-specific colors
