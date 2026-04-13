# Tools

- **devtools/**: Browser extension (Chrome/Firefox) for debugging Owl components. Provides a devtools panel to inspect component tree, state, and lifecycle.
- **build_codemirror.mjs**: Bundles CodeMirror editor packages into a single JS file (`docs/playground/libs/codemirror.bundle.js`) for use in the playground.
- **compile_owl_templates.mjs**: CLI tool that compiles Owl XML templates into JavaScript. Reads template files from provided paths and writes compiled output to a file.
- **playground_server.py**: Python HTTP server that serves the playground locally on `http://127.0.0.1:8000`, remapping `owl.js` requests to the built version and disabling caching.
- **release.cjs**: Automated release script handling version bumping, testing, building (including devtools), git commits, GitHub release creation, and NPM publishing.
