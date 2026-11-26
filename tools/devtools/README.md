# Owl DevTools

A browser extension for inspecting and profiling Owl applications. It adds an **Owl** panel to the browser's built-in DevTools with two tabs: a component tree inspector and a rendering profiler.

Supports Chrome (Manifest V3) and Firefox (Manifest V2).

## Features

- **Component tree**: browse the full hierarchy of Owl components on the current page.
- **Props & state inspector**: select any component to view and explore its current props and state in an expandable tree.
- **Component search**: filter the component tree by name with fuzzy matching.
- **Highlight in page**: clicking a component in the tree scrolls the corresponding DOM element into view.
- **Profiler**: record rendering events, browse their timing and call counts, and filter by name.
- **Multi-frame support**: switch between iframes via a frame selector dropdown.

## Architecture

The extension uses a three-process model required by browser extension APIs:

| Script | Context | Role |
|---|---|---|
| `src/background.js` | Service worker | Central message hub; manages tab lifecycle, detects Owl presence, updates extension icon |
| `src/content.js` | Page content script | Relays messages between the page and the background script |
| `page_scripts/owl_devtools_global_hook.js` | Injected into page | Directly accesses Owl instances to extract component tree data |

The UI is itself an Owl application, built from components under `src/devtools_app/`.

## Building

```sh
npm install

# Chrome
npm run build:chrome

# Firefox
npm run build:firefox
```

Output is written to `dist/chrome/` or `dist/firefox/`. Load it as an unpacked extension from the browser's extension management page.

## Development

```sh
# Chrome (watch mode)
npm run dev:chrome

# Firefox (watch mode)
npm run dev:firefox
```
