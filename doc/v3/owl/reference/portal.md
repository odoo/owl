# Portal

`<Portal>` is a built-in component that renders its slot content into a
target DOM element somewhere else on the page, instead of in its own
location in the parent's tree. It is the standard tool for modals,
tooltips, popovers, dropdowns, toasts, and anything else that needs to
escape its parent's overflow/stacking context.

## Basic usage

```js
import { Component, Portal, signal, xml } from "@odoo/owl";

class Page extends Component {
  static components = { Portal };
  static template = xml`
    <main>
      <h1>Page</h1>
      <Portal target="this.modalRoot">
        <div class="modal">I'm rendered elsewhere!</div>
      </Portal>
    </main>

    <div t-ref="this.modalRoot"/>
  `;

  modalRoot = signal(null);
}
```

The `<Portal>` itself renders **nothing** at its template position — its
slot content is mounted under the resolved target. In the example above,
the `<div class="modal">` ends up inside the `<div t-ref="modalRoot">`
even though it appears inside `<main>` in the template.

## The `target` prop

`target` accepts three shapes:

- **A `t-ref` signal** (`Signal<HTMLElement | null>`) — the recommended
  case when the target lives inside the same component. The Portal waits
  for the signal to hold a non-null `HTMLElement` (it starts as `null`),
  then mounts. If the signal value changes later, the Portal tears down
  and remounts at the new target.
- **A direct `HTMLElement`** — useful for `document.body`, an existing
  global element, or any reference resolved outside Owl.
- **A CSS selector string** — resolved with `document.querySelector` once,
  at first effect run. If the selector resolves to nothing, the Portal
  stays empty until the prop changes.

```xml
<!-- t-ref signal (recommended for in-tree targets) -->
<Portal target="this.modalRoot">...</Portal>

<!-- direct element -->
<Portal target="document.body">...</Portal>

<!-- selector -->
<Portal target="'#modal-root'">...</Portal>
```

If the resolved target is `null`/`undefined`, the Portal mounts nothing.
This makes it safe to render unconditionally and let the target signal
gate the mount.

## What gets forwarded

The portaled content is its own [sub-root](app.md#roots), but it is wired
into the source tree's [scope](scope.md) and plugin chain:

- **Reactive values** (`signal`, `computed`, `proxy`) — work normally.
  Reads inside the portaled subtree subscribe; writes notify subscribers.
  Reactivity is global, not tied to component trees.
- **Plugin chain** — `providePlugins` contributions from the Portal's
  ancestors are visible inside the portaled content, exactly as if the
  content lived in-tree. `plugin(SomePlugin)` works the same.
- **Errors** — exceptions thrown in the portaled subtree (including
  `onWillStart` rejections) propagate to the nearest `onError` handler
  on the Portal's parent chain, the same as in-tree errors.

What does **not** transfer:

- **DOM-level event bubbling** does not bubble _through_ the portal.
  Events on the portaled DOM bubble through their physical DOM
  ancestors (the target element and up), not through the source
  component's ancestors.

## Lifecycle

- The portal mounts when the target resolves to a valid element.
- The portal unmounts when the Portal component is destroyed, when the
  target signal flips to `null`, or when the target changes (the old
  mount is destroyed; a fresh mount is created at the new target).
- **State is lost on remount.** Moving an inner state-holding subtree
  from one target to another via a target change does not preserve its
  state — the old root is destroyed and a new one is built.

## Asynchronous content

Portaled content participates in normal Owl rendering: descendants'
`onWillStart` runs before the portal's content mounts. While that work
is in flight, the target stays empty (the Portal does not show a
fallback). Wrap the portaled content in `<Suspense>` if you want a
loading indicator inside the target:

```xml
<Portal target="this.modalRoot">
  <Suspense>
    <t t-set-slot="fallback">Loading…</t>
    <ExpensiveDescendant/>
  </Suspense>
</Portal>
```

## Multiple portals to the same target

Each Portal mounts independently, as a sibling under the target. A
common pattern is a notification stack that all renders into a single
container:

```xml
<t t-foreach="this.toasts()" t-as="toast" t-key="toast.id">
  <Portal target="this.toastRoot">
    <Toast t-props="toast"/>
  </Portal>
</t>
```

## How it works

`<Portal>` uses `app.createRoot` plus the
[two-phase `prepare`/`mount` API](app.md#two-phase-mounting-prepare-and-mount).
On every effect run with a valid target, it builds a fresh sub-root,
chains its scope and plugin manager onto the Portal's, installs an
error handler that walks up the source-tree chain, then commits into
the target. The cleanup tears the sub-root down before the next run.

This is the same machinery [`<Suspense>`](suspense.md) uses internally;
Portal is essentially Suspense without the fallback and with the target
supplied externally instead of by an in-template `t-ref`.
