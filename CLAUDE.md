# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Owl (Odoo Web Library) is a ~20KB gzipped TypeScript UI framework with class-based components, fine-grained reactivity, hooks, and asynchronous rendering. It uses XML (QWeb) templates compiled to JavaScript.

## Commands

```bash
npm test                        # Run all tests (Jest + jsdom)
npm test -- --testPathPattern=reactivity  # Run tests matching a path pattern
npm test -- tests/reactivity/signal.test.ts  # Run a specific test file
npm run test:watch              # Watch mode
npm run build                   # Build with Rollup (outputs to dist/)
npm run build:runtime           # Build runtime only (no compiler)
npm run build:compiler          # Build compiler only
npm run lint                    # ESLint on src/ and tests/
npm run check-formatting        # Prettier check
npm run prettier                # Auto-format
```

## Architecture

The codebase has five core systems under `src/`:

### Compiler (`src/compiler/`)
Parses QWeb XML templates and generates JavaScript render functions. `parser.ts` converts XML to AST, `code_generator.ts` produces JS code, `inline_expressions.ts` handles expression compilation. Templates use directives: `t-if`, `t-foreach`, `t-component`, `t-on`, `t-model`, `t-out`, `t-call`, `t-slot`, `t-set`.

### Reactivity (`src/runtime/reactivity/`)
Fine-grained dependency tracking built on atoms and computations (`computations.ts`). `proxy.ts` creates reactive proxies for objects/arrays/Maps/Sets. `signal.ts` provides basic reactive values, `computed.ts` for derived values, `effect.ts` for side effects. Updates are batched in microtasks.

### Component System (`src/runtime/component.ts`, `component_node.ts`)
ES6 class-based components. `Component` is the base class users extend. `ComponentNode` wraps a component instance and manages its lifecycle, child components, and fiber reference for rendering. Lifecycle hooks: `onWillStart`, `onMounted`, `onWillUpdateProps`, `onWillPatch`, `onPatched`, `onWillUnmount`, `onWillDestroy`, `onError`.

### Virtual DOM / Blockdom (`src/runtime/blockdom/`)
Block-based virtual DOM. `block_compiler.ts` generates optimized DOM manipulation code from template blocks. VNodes implement `mount`/`patch`/`remove`. Supports fragments (`multi.ts`), lists (`list.ts`), toggler (`toggler.ts`), and HTML injection (`html.ts`).

### Rendering Engine (`src/runtime/rendering/`)
`scheduler.ts` orchestrates rendering on animation frames. `fibers.ts` contains Fiber/RootFiber/MountFiber — lightweight metadata objects tracking render tasks. Rendering is two-phase: async virtual render (generates vdom), then sync patch (applies to DOM).

### Glue Layer
`src/index.ts` is the main entry point — it re-exports all of `src/runtime/` and patches `TemplateSet.prototype._compileTemplate` to wire the compiler into the runtime. `App` class (`src/runtime/app.ts`) extends `TemplateSet` and manages the full application lifecycle including plugins.

## Test Patterns

Tests use Jest with jsdom. Test helpers are in `tests/helpers.ts`:
- `makeTestFixture()` — creates a DOM element for mounting
- `nextTick()` — waits for async updates
- `waitScheduler()` — waits for scheduler to flush

Typical component test structure:
```typescript
import { Component, mount, xml } from "../../src";
import { makeTestFixture, nextTick } from "../helpers";

test("description", async () => {
  class MyComp extends Component {
    static template = xml`<div>hello</div>`;
  }
  const fixture = makeTestFixture();
  await mount(MyComp, fixture);
  expect(fixture.innerHTML).toBe("<div>hello</div>");
});
```

## Code Style

- TypeScript with strict mode, ES2022 target
- Prettier: 100 char width, es5 trailing commas, auto line endings
- ESLint: no unused vars, no duplicate imports, no `test.only`/`describe.only`
- No `any` types in strict TS config (noImplicitAny)
