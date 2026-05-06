# create-owl

Scaffold a new [Owl](https://github.com/odoo/owl) project.

## Usage

```bash
npm create owl@latest my-app
```

Also works with other package managers:

```bash
pnpm create owl my-app
yarn create owl my-app
```

Omit the project name to be prompted for one.

## What you get

A minimal, working Owl project with:

- **Vite** dev server with HMR
- **TypeScript** (or JavaScript, if you prefer)
- A root component wired up and mounted, with its template in a colocated `.xml` file
- Both **JIT** and **AOT** entry points wired up; switch by editing one line in `index.html`
- `npm run dev` / `npm run build` / `npm run preview`

Nothing more. Add routing, state management, styling, testing, etc. as you need them.

## Flags

```bash
npm create owl my-app -- --aot          # start in AOT mode (compiler not bundled)
npm create owl my-app -- --javascript   # JavaScript variant
npm create owl my-app -- --yes          # skip prompts (uses defaults)
```

`--aot` only sets the initial mode — the generated project supports both, and
switching later is a one-line edit in `index.html`.

## JIT vs AOT

- **JIT** (default): the template compiler is bundled and runs in the browser
  at startup. Easy to develop with.
- **AOT**: templates are precompiled to JavaScript at build time;
  `@odoo/owl-compiler` is excluded from the production bundle (~30KB smaller).

The generated project has `main.jit.{ts,js}` and `main.aot.{ts,js}` side by
side — `index.html` picks which one runs. See the project's own README for
details.

## Node version

Requires Node 20 or newer.
