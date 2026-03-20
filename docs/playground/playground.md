# OWL Playground - Architecture & Design Reference

## Overview

Interactive IDE for learning and prototyping with the Owl framework. Runs entirely in the browser, executes user code in a sandboxed iframe with CodeMirror 6 for editing.

**Note:** There is no need to run the tests (`npm run test`), because they only test Owl itself, not the playground.

**Note:** There is no need to run `npm run build`, because it only builds Owl and not the playground.

## Architecture

### Entry Points

- `index.html` - Main entry, loads `playground.js` as ES module
- `playground.js` - Root `Playground` component and application bootstrap

### Component Hierarchy

```
Playground (root)
├── Explorer (sidebar)
│   └── Project/file tree with expand/collapse
├── CodeEditor (split-pane)
│   ├── primary editor pane
│   └── secondary editor pane (optional, split mode)
├── ContentView (preview area)
│   ├── iframe (user code execution sandbox)
│   └── console pane (log/error/warn output)
└── Dialog overlays (settings, new file, project dialogs)
```

### Plugin System

Six plugins provided via `providePlugins()` at Playground mount:

#### 1. CodePlugin (`code`)

Manages file content and editor state.

**State signals:**

- `files` - Array of `{name, type, iconClass}`
- `contents` - Object mapping filename → content
- `primaryFile`, `secondaryFile` - Current file per pane
- `activePane` - 'primary' or 'secondary'
- `splitMode` - Boolean
- `splitRatio` - Number (0.2-0.8)
- `contentVersion` - Increments on file load
- `runCode` - Triggers execution
- `userModified` - Dirty flag

**Key methods:**

- `loadFiles(fileNames, contents, editorState?)` - Load project
- `setContent(fileName, value)` - Update file content
- `run()` - Execute code (collects js/css/xml, creates iframe)
- `getSnapshot()` - Get all file contents
- `addFile()`, `renameFile()`, `deleteFile()`

#### 2. TemplatePlugin (`templates`)

Lists sample templates from `samples/` directory.

**Structure:**

```javascript
{
  category: "Examples" | "Demos" | "Tutorials",
  description: "Display name",
  files: ["main.js", ...],
  isTutorial: boolean,
  code: async () => { filename: content }
}
```

#### 3. ProjectPlugin (`project`)

Multi-project management with dirty tracking.

**State:**

- `projects` - Array of project objects
- `activeProjectId` - Current project

**Project object:**

```javascript
{
  id: string,
  name: string,
  fileNames: string[],
  readonly: boolean,
  files: { filename: content },
  originalFiles: { filename: content }, // for dirty check
  templateDesc: string | null,
  editorState: { splitMode, primaryFile, secondaryFile, activePane, splitRatio }
}
```

**Key methods:**

- `createProject()`, `switchProject()`, `deleteProject()`
- `addFileToProject()`, `renameFileInProject()`, `deleteFileFromProject()`
- `applyTemplate()` - Replace files with template
- `isCurrentProjectDirty()` - Compare against originalFiles
- `serialize()`, `restore()` - For localStorage persistence

#### 4. LocalStoragePlugin (`localStorage`)

Auto-saves to `localStorage` every 1s when dirty.

**Key:**

- `owl-playground-projects` - New format (multi-project)
- `owl-playground-local-sample` - Legacy format (migrated automatically)

#### 5. SettingsPlugin (`settings`)

**State:**

- `fontSize` - Number (10-20), persisted to localStorage
- `autoRun` - Boolean, run on change with 500ms debounce
- `fullscreen` - Boolean, hide editor
- `leftPaneWidth` - Number (pixels)

#### 6. DialogPlugin (`dialog`)

Modal management.

**State:**

- `dialogComponent` - Component class or null
- `dialogProps` - Props object

**Methods:**

- `showDialog(Component, props)` - Open modal
- `closeDialog()` - Close modal

### Key Components

#### CodeEditor (`playground.js:658-934`)

CodeMirror 6 integration with split-pane support.

**Features:**

- Language support: js, css, xml, md (via `LANGUAGES` map)
- Tab sizes: js/css=4, xml/md=2
- OneDark theme
- State preservation per file (scroll position, editor state)
- Companion file detection (js↔xml pairing)

**Key signals:**

- `primaryEditorNode`, `secondaryEditorNode` - DOM refs
- `panes` - `{primary, secondary}` each with `{view, states, scrolls, lastFile}`

**Effects:**

- Content version change → reset panes
- Primary/secondary file change → switch pane file
- Split mode toggle → create/destroy secondary editor
- Font size change → reconfigure theme

#### ContentView (`playground.js:1267-1460`)

User code execution in sandboxed iframe.

**Features:**

- Console capture: log/warn/error/info
- Error count badge
- Welcome screen when no code run
- Fullscreen toggle

**run() method:**

1. Creates iframe
2. Builds import map with `@odoo/owl` → `../owl.js`
3. Rewrites relative imports to blob URLs
4. Injects templates as `TEMPLATES` global
5. Captures console methods and errors

#### Explorer (`playground.js:1130-1242`)

Sidebar with project tree.

**Features:**

- Expand/collapse projects
- File selection with active highlighting
- Double-click to edit project/file
- Template preset dropdown
- New file/project buttons

## Code Execution System

### How User Code Runs

1. `CodePlugin.run()` collects js, css, xml files
2. Creates iframe with base styles
3. Builds import map:
   ```javascript
   {
     imports: {
       "@odoo/owl": "../owl.js",
       "./otherFile.js": "blob:...",
       ...
     }
   }
   ```
4. For multi-file projects:
   - Non-main files converted to blob URLs
   - Import statements rewritten to use blob URLs
5. Injects `<script type="module">` with:
   ```javascript
   const TEMPLATES = `...xml...`;
   // main.js content
   ```

### Import Rewriting

The `rewriteImports()` function handles:

- `import ... from "./x"` → `import ... from "blob:..."`
- `export ... from "./x"` → `export ... from "blob:..."`
- `import("./x")` → `import("blob:...")`

## Sample Applications

### Examples Category

| Sample           | Files                                   | Demonstrates                                                                        |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| Hello World      | main.js                                 | Basic mount, inline xml template                                                    |
| Simple Component | main.js, main.css                       | Component class, static template, styling                                           |
| Props/List       | main.js, product_card.js/xml, main.css  | Parent-child props, component reuse, XML templates                                  |
| Lifecycle Demo   | helpers.js, chat_window.js, main.js/xml | Hooks: onMounted, onPatched, onWillDestroy, onWillPatch, onWillStart, onWillUnmount |
| Reactivity       | main.js/xml                             | signal(), proxy(), computed(), effect(), reactive state patterns                    |
| Canvas           | main.js                                 | t-ref for DOM access, useEffect for side effects                                    |
| Form             | main.js/xml                             | t-model two-way binding                                                             |
| Slots            | dialog.js/xml/css, main.js              | Generic components, slot content projection                                         |
| Plugins          | core_plugins.js, form_view.js, main.js  | Plugin system, dependency injection, cross-plugin communication                     |

### Demos Category

| Sample       | Files                                       | Description                             |
| ------------ | ------------------------------------------- | --------------------------------------- |
| Kanban Board | main.js/xml/css                             | Multi-column task board with add/delete |
| HTML Editor  | html_editor/html_editor.js/xml, main.js/css | Contenteditable with formatting toolbar |
| Web Client   | main.js/xml/css                             | Mock Odoo-style web client with navbar  |

### Tutorials Category

| Sample       | Files                 | Description                                               |
| ------------ | --------------------- | --------------------------------------------------------- |
| Todo List    | main.js/xml/css       | Full TodoMVC implementation with localStorage persistence |
| Time Tracker | readme.md/main.js/xml | Timer with step-by-step tutorial (7 progressive steps)    |

**Time Tracker Tutorial:** The `readme.md` file contains a comprehensive tutorial building a Pomodoro timer in 7 incremental steps, each introducing core Owl concepts:

1. Static Display - Component, xml template, mount
2. Reactive State - signal(), computed()
3. Start/Pause - Event handlers, onWillUnmount
4. Reset - Multiple signals, state coordination
5. Work/Break Phases - Conditional rendering, t-att-class
6. Progress Bar - Computed + styling, t-att-style
7. Session History - signal.Array, t-foreach

## File Structure

```
docs/playground/
├── index.html              # Entry point
├── playground.js           # Main application (~1694 lines)
├── playground.css          # Styles (~981 lines)
├── templates.xml           # Owl templates (~256 lines)
├── utils.js                # debounce, loadJS utilities
├── libs/
│   ├── codemirror.bundle.js  # CodeMirror 6 editor bundle
│   ├── jszip.min.js          # ZIP creation for export
│   └── FileSaver.min.js      # File download helper
├── standalone_app/
│   ├── app.py              # Python HTTP server (port 3600)
│   └── index.html          # Standalone app template
└── samples/
    ├── components/         # Simple component example
    ├── product_card/       # Props and list example
    ├── lifecycle_demo/     # Hooks demonstration
    ├── reactivity/          # Signals and proxy
    ├── canvas/              # t-ref and DOM access
    ├── form/                # t-model binding
    ├── slots/               # Slot content projection
    ├── plugins/             # Plugin system example
    ├── kanban_board/        # Kanban demo
    ├── html_editor/         # HTML editor demo
    ├── web_client/          # Web client demo
    ├── todo_app/            # TodoMVC tutorial
    └── timer_app/           # Timer tutorial
```

## Important Implementation Details

### Split Editor State Management

Each pane maintains separate state:

```javascript
panes: {
  primary: { view: EditorView, states: {}, scrolls: {}, lastFile: string },
  secondary: { view: EditorView, states: {}, scrolls: {}, lastFile: string }
}
```

When switching files:

1. Save current state to `states[lastFile]`
2. Save scroll position to `scrolls[lastFile]`
3. Load or create state for new file
4. Restore scroll position

### File Companion Detection

`_getCompanion(file)` finds matching js/xml pair:

- For `foo.js` → looks for `foo.xml`
- For `foo.xml` → looks for `foo.js`

Shows companion button (icon) to auto-split editor.

### Auto-run Feature

When `SettingsPlugin.autoRun()` is true:

- Debounced (500ms) `run()` triggers on content change
- Only runs if `userModified` is true

### Code Sharing (URL Hash)

`shareCode()` encodes snapshot to base64 URL hash:

```javascript
window.location.hash = btoa(JSON.stringify({ "main.js": "...", ... }));
```

On load, `hashData` is parsed and creates "Shared Code" project.

Supports legacy format: `{js, css, xml}` → migrated to new format.

### Standalone Export

`exportStandaloneApp()` creates ZIP:

1. Loads JSZip and FileSaver libraries dynamically
2. Fetches standalone app template files
3. Bundles user code:
   - `app.js` - All JS with template import
   - `app.css` - All CSS concatenated
   - `app.xml` - All templates wrapped
4. Adds `owl.js`, `index.html`, `app.py`

## Key Imports from Owl

```javascript
import {
  // Core
  __info__, // Version info
  Component, // Base class
  mount, // Mount function
  xml, // Template tag

  // Reactivity
  signal, // Reactive value
  computed, // Computed value
  effect, // Side effect
  proxy, // Reactive proxy

  // Lifecycle hooks
  onMounted,
  onPatched,
  onWillDestroy,
  onWillPatch,
  onWillStart,
  onWillUnmount,

  // Effect hooks
  useEffect,
  untrack, // Untracked read

  // Plugin system
  Plugin, // Base plugin class
  plugin, // Plugin decorator
  providePlugins, // Provide plugins to subtree

  // Props
  props, // Props definition helper
} from "../owl.js";
```

## Templates (templates.xml)

### Component Templates

| Template Name    | Component        | Purpose                      |
| ---------------- | ---------------- | ---------------------------- |
| CodeEditor       | CodeEditor       | Split-pane editor UI         |
| ConfirmDialog    | ConfirmDialog    | Yes/No confirmation          |
| NewProjectDialog | NewProjectDialog | Create project with template |
| SettingsDialog   | SettingsDialog   | Font size, auto-run          |
| NewFileDialog    | NewFileDialog    | Create new file              |
| FileDialog       | FileDialog       | Rename/delete file           |
| ProjectDialog    | ProjectDialog    | Rename/delete project        |
| Explorer         | Explorer         | Sidebar project tree         |
| ProjectManager   | ProjectManager   | Project list dialog          |
| ContentView      | ContentView      | Preview + console            |
| Playground       | Playground       | Root layout                  |

## CSS Architecture (playground.css)

### Layout

```css
.playground {
  display: grid;
  grid-template-columns: auto 4px 1fr;
  grid-template-rows: auto 1fr;
}
```

### Color Scheme

Dark theme for editor (OneDark):

- Background: `#21252b`, `#282c34`
- Text: `#abb2bf`, `#e6edf3`
- Accent: `#58a6ff`
- Border: `#181a1f`

Light theme for preview:

- Background: `#f8f9fa`
- Border: `#d0d0d0`

### Key Classes

- `.editor-area` - Flex column for split editor
- `.editor-pane` - Single editor pane
- `.editor-split-separator` - Draggable divider
- `.file-icon-{js,xml,css,md}` - File type icons (colored squares)
- `.console-msg` - Log output with type-specific colors

## Standalone App (standalone_app/)

### app.py

Simple Python HTTP server:

- Port 3600
- Sets `.js` MIME type to `application/javascript`
- Run with `python3 app.py`

### index.html

Template for exported apps:

```html
<script type="importmap">
  { "imports": { "@odoo/owl": "./owl.js" } }
</script>
<script type="module" src="app.js"></script>
```

Checks for `file://` protocol and shows instructions.
