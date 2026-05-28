# App and Roots

## Overview

Every Owl application is anchored by an `App` instance — the registry of
templates, the host for any [plugins](plugins.md), and the owner of one or
more component _roots_ attached to the DOM.

The common path is the `mount` helper:

```js
import { Component, mount, xml } from "@odoo/owl";

class MyComponent extends Component {
  static template = xml`<div>Hello</div>`;
}

await mount(MyComponent, document.body);
```

For finer control (multiple roots, deferred mounting, sharing one set of
templates across several roots), construct an `App` directly and call
`createRoot`:

```js
import { App } from "@odoo/owl";

const app = new App({ templates });
const root = app.createRoot(MyComponent, { props: { user } });
await root.mount(document.body);
```

## API

- **`new App(config?)`**: creates an application. The argument is an optional
  configuration object (see below); no root component is registered at
  construction time.

- **`app.createRoot(Component, options?)`**: registers a root component and
  returns a `Root` object exposing `prepare`, `mount`, `destroy`, plus
  `promise` (resolves to the component instance once mounted) and the
  underlying `node`. `options` accepts `{ props }`.

- **`app.destroy()`**: destroys every root, the plugin manager, and the
  application itself.

### `mount` helper

`mount(Component, target, config?)` creates an `App`, calls `createRoot`,
then mounts the root in a single call. It accepts the union of the `App`
config, the root's `props`, and `MountOptions`:

```js
await mount(MyComponent, document.body, { props: { user }, position: "first-child" });
```

- **`Component`**: the root component class.
- **`target`**: an `HTMLElement` or `ShadowRoot` attached to a document.
- **`config`**: optional — merges `AppConfig` fields, `props`, and
  `MountOptions`.

### `MountOptions`

The mount call (`root.mount(target, options)` or the `mount` helper) accepts:

- **`position`**: `"first-child"` or `"last-child"` (default). Determines
  whether the root is inserted as the first or last child of `target`.

## Configuration

The `App` config accepts the following fields:

- **`templates (string | Document | Record<string, string | TemplateFunction>)`**:
  templates available to the application. Accepts a raw XML string, an
  `XMLDocument`, or an object mapping template names to either a template
  source string or a precompiled template function (see
  [Precompiling templates](precompiling_templates.md)).
- **`getTemplate ((s: string) => Element | Function | string | void)`**:
  resolver called on demand; if it returns `undefined`, the application falls
  back to the `templates` map.
- **`dev (boolean, default=false)`**: enables [`dev` mode](#dev-mode).
- **`test (boolean, default=false)`**: same as `dev` mode but suppresses the
  "Owl is running in 'dev' mode" log.
- **`translateFn (function)`**: translation function — see
  [translations](translations.md).
- **`translatableAttributes (string[])`**: extra attributes to translate —
  see [translations](translations.md).
- **`customDirectives (object)`**: handlers for `t-custom-*` directives —
  see [Custom Directives](template_syntax.md#custom-directives).
- **`globalValues (object)`**: values exposed to every compiled template
  under the `__globals__` namespace.
- **`plugins (PluginConstructor[] | Resource<PluginConstructor>)`**: plugins
  to start when the app boots — see [plugins](plugins.md). Plugins'
  `onWillStart` callbacks defer the first root render until they resolve.
- **`config (Record<string, any>)`**: values readable from plugin code via
  the `config()` helper — see
  [Plugins — Configuration](plugins.md#configuration).
- **`name (string)`**: optional debug label (visible in the devtools panel).

> Owl 2's `env` config has been removed. Cross-component state and services
> are now provided through the [plugin system](plugins.md).

## Roots

An application can host multiple roots. This is occasionally useful when
sub-components need to be mounted into areas not managed by Owl, such as
content rendered by a third-party editor.

`createRoot` takes the component class and a config object containing the
root's props:

```js
const root = app.createRoot(MyComponent, { props: { someProps: true } });
await root.mount(targetElement);

// later
root.destroy();
```

Roots created via `createRoot` are owned by your code: it is your
responsibility to call `root.destroy()` (before the target is removed from
the DOM); Owl will not clean them up for you.

### Two-phase mounting: `prepare` and `mount`

`mount(target)` is the common case and does everything in one step: start
the render phase, wait for `onWillStart` callbacks to settle, then attach
to the target. For more control, the root exposes these as two distinct
phases:

- **`prepare()`** starts the render phase without a DOM target.
  Descendants' `onWillStart` fires immediately, and the bdom is built in
  memory. Returns a `Promise<void>` that resolves once the render phase is
  complete. Idempotent — a second call returns the same promise. No DOM
  elements exist yet.
- **`mount(target, options?)`** attaches the prepared bdom into `target`
  and fires `onMounted` hooks. Calling `mount` without a prior `prepare`
  prepares implicitly. Returns a promise that resolves with the component
  instance.

The pattern is useful for:

- **Pre-warming**: start loading a subtree's data before you have a place
  to put it.
- **Off-screen rendering**: build the DOM in memory, inspect or
  pre-measure it, then mount later.
- **Parallel loading**: call `prepare()` on multiple roots at once and
  wait on `Promise.all([...])` before mounting them.

```js
const root = app.createRoot(MyComponent, { props });
// Kick off willStart now, in parallel with other work.
const ready = root.prepare();
// ... later, when the target is known ...
await ready;
await root.mount(targetElement);
```

If you call `prepare()` but never `mount()`, the root never attaches to
the DOM. `destroy()` still cleans up the prepared subtree in either case.

`validateTarget` runs at `mount` time, not at `prepare`, so a bad
target surfaces synchronously when you actually try to mount.

## Loading templates

Most applications load their templates from the server at startup:

```js
import { mount } from "@odoo/owl";

(async function setup() {
  const templates = await fetch("/some/endpoint/that/returns/templates").then((r) => r.text());
  await mount(Root, document.body, { templates });
})();
```

`templates` accepts a raw XML string, an `XMLDocument`, or a precompiled
template map.

## Dev mode

Dev mode activates some additional checks and developer amenities:

- [Props validation](./props.md#props-validation) is performed
- [t-foreach](./template_syntax.md#loops) loops check for key unicity
- Lifecycle hooks are wrapped to report their errors in a more developer-friendly way
- onWillStart will emit a warning in the console when it takes longer than 3
  seconds in an effort to ease debugging the presence of deadlocks
