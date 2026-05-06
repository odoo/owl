# {{PROJECT_NAME}}

An [Owl](https://github.com/odoo/owl) project.

## Scripts

```bash
npm run dev       # start the Vite dev server with HMR
npm run build     # produce a production bundle in dist/
npm run preview   # preview the production bundle locally
```

## Where things live

- `src/App.js` / `src/App.xml` — the root component and its template (colocated).
- `src/main.jit.js` — JIT entry point: templates compiled in the browser.
- `src/main.aot.js` — AOT entry point: templates precompiled at build time.
- `index.html` — picks which entry point runs (defaults to JIT).
- `vite.config.js` — Vite configuration.

## Adding components

Each component lives next to its template:

```
src/some_widget.js
src/some_widget.xml
```

`*.xml` files anywhere under `src/` are discovered automatically (recursive glob in JIT, recursive walk by `compile_owl_templates` in AOT).

## JIT vs AOT

By default the project uses **JIT** (just-in-time) compilation: the template
compiler is bundled and runs in the browser at startup. Easy to develop with,
slightly larger bundle.

**AOT** (ahead-of-time) compilation precompiles `*.xml` to JavaScript at build
time and ships only the runtime — the compiler is excluded, yielding a smaller
production bundle.

To switch to AOT, change one line in `index.html`:

```html
<script type="module" src="/src/main.aot.js"></script>
```

(Switch back by pointing at `main.jit.js`.) The `npm run dev` script always
runs `compile_owl_templates --watch` alongside Vite, so AOT mode picks up
template edits without restart. In JIT mode the watcher still runs but its
output (`src/templates.compiled.js`) is unused.
