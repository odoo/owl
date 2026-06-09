# Concurrency Model

## Overview

Owl was designed from the very beginning with asynchronous components. This comes
from the [`onWillStart`](component.md#willstart) lifecycle hook. With this
asynchronous hook, it is possible to build complex, highly concurrent
applications.

Owl concurrent mode has several benefits: it makes it possible to delay the
rendering until some asynchronous operation is complete, and to lazy load
libraries while keeping the previous screen completely functional. It is also
good for performance: Owl batches the result of many different renderings and
applies them only once per animation frame. A rendering that is no longer
relevant can be cancelled, restarted, or reused.

But even though using concurrency is quite simple (and is the default
behaviour), asynchrony is difficult, because it introduces an additional
dimension that vastly increases the complexity of an application. This section
explains how Owl manages this complexity, and how concurrent rendering works in
a general way.

## Rendering Components

The word _rendering_ is a little vague, so let us explain more precisely the
process by which Owl components are displayed on a screen.

When a component is mounted or updated, a new rendering is started. It has two
phases: _virtual rendering_ and _patching_.

### Virtual rendering

This phase represents the process of rendering a template, in memory, which
creates a virtual representation of the desired component HTML. The output of
this phase is a virtual DOM.

It is asynchronous: each sub component needs to either be created (so
[`onWillStart`](component.md#willstart) will need to be called and awaited), or
updated. This is a recursive process: a component is the root of a component
tree, and each sub component needs to be (virtually) rendered.

### Patching

Once a rendering is complete, it is applied on the next animation frame. This is
done synchronously: the whole component tree is patched to the real DOM in a
single pass.

## Semantics

We give here an informal description of the way components are created/updated
in an application. Ordered lists describe actions that are executed
sequentially; bullet lists describe actions that are executed in parallel.

**Scenario 1: initial rendering.** Imagine we want to render the following
component tree:

```
        A
       / \
      B   C
         / \
        D   E
```

Here is what happens whenever we mount the root component (with some code like
`mount(A, document.body)`).

1. `onWillStart` is called on `A`

2. when it is done, template `A` is rendered.
   - component `B` is created
     1. `onWillStart` is called on `B`
     2. template `B` is rendered
   - component `C` is created
     1. `onWillStart` is called on `C`
     2. template `C` is rendered
        - component `D` is created
          1. `onWillStart` is called on `D`
          2. template `D` is rendered
        - component `E` is created
          1. `onWillStart` is called on `E`
          2. template `E` is rendered

3. each component is patched into a detached DOM element, in the following order:
   `E`, `D`, `C`, `B`, `A` (so the actual full DOM tree is created in one pass)

4. the component `A` root element is actually appended to `document.body`

5. the `onMounted` hooks are called recursively on all components in the
   following order: `E`, `D`, `C`, `B`, `A`.

**Scenario 2: updating a component.** Now, let's assume that the user clicked on
some button in `C`, and this writes to a [signal](signals.md) that
`C` read during its last render. This update is supposed to:

- update `D`,
- remove `E`,
- add a new component `F`.

So the component tree should look like this:

```
        A
       / \
      B   C
         / \
        D   F
```

Here is what Owl will do:

1. because one of the signals `C` depends on was written to, a re-render is
   scheduled for `C`
2. template `C` is rendered again
   - component `D` is updated:
     1. template `D` is rerendered
   - component `F` is created:
     1. `onWillStart` is called on `F` (async)
     2. template `F` is rendered

3. `onWillPatch` hooks are called recursively on components `C`, `D` (not on `F`,
   because it is not mounted yet)

4. components `F`, `D` are patched in that order

5. component `C` is patched, which will cause recursively:
   1. `onWillUnmount` hook on `E`
   2. destruction of `E` (its `onWillDestroy` hook runs)

6. `onMounted` hook is called on `F`, and `onPatched` hooks are called on `D`, `C`

Note that, unlike Owl 2, a re-render is not triggered by calling a `render`
method on the component. Owl 3 reactivity is fine-grained: a component
re-renders only when one of the signals it actually read during its last render
is written to. See [Reactivity](reactivity.md) for the full model, and the
[`patched` scope notes](component.md#scope-when-does-patched-actually-fire) for
how this changes which components re-render.

## Asynchronous Rendering

Working with asynchronous code always adds a lot of complexity to a system.
Whenever different parts of a system are active at the same time, one needs to
think carefully about all possible interactions. This is also true for Owl
components.

The main thing to keep in mind is that **any component can delay the rendering**
(initial or subsequent) of the whole application, because the virtual rendering
phase waits for every `onWillStart` in the tree to resolve before patching.

Here are a few tips on how to work with asynchronous components:

1. **Minimize the use of asynchronous components.** Most components should be
   synchronous; reach for `onWillStart` only when you genuinely need to wait for
   something before the first render.
2. **Lazy loading external libraries is a good use case.** It only takes a
   fraction of a second, and only happens once:

   ```js
   class Editor extends Component {
     static template = xml`<div t-ref="this.container"/>`;

     container = signal.ref(HTMLDivElement);

     setup() {
       onWillStart(async () => {
         this.lib = await import("some-heavy-editor-lib");
       });
       onMounted(() => {
         this.lib.init(this.container());
       });
     }
   }
   ```

3. **Load data in `onWillStart`** when the first render needs it:

   ```js
   setup() {
     onWillStart(async () => {
       const res = await fetch(`/api/records/${this.props.id}`);
       this.records = await res.json();
     });
   }
   ```

For data that may change after the first render, prefer reactive primitives such
as [`asyncComputed`](computed_values.md#async-computed-values) over reloading in a
lifecycle hook: it re-runs automatically when its dependencies change and
exposes `loading()` / `error()` reactive reads.
