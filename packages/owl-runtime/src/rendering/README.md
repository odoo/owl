# Render-once rendering (prototype)

Owl renders each template **once**. There is no virtual dom and no
re-rendering: when a value read by the template changes, a render effect
updates the part of the dom that depends on it.

The runtime lives in `content.ts` (contents, owners, render effects, regions,
lists), `../blockdom/block_compiler.ts` (blocks), `template_helpers.ts` (the
helpers used by compiled templates) and `../component_node.ts` (components).
The code generator is `owl-compiler/src/code_generator.ts`.

## Contents

Instantiating a template returns a **content**: a range of sibling dom nodes
that can be inserted (or moved) before a node, removed, and asked for its first
and last nodes.

```ts
interface Content {
  mount(parent: Node, ref: Node | null): void; // insert or move
  remove(): void;
  firstNode(): Node;
  lastNode(): Node;
}
```

The kinds of content:

- a **block**: a cloned element (see below);
- a text, some markup (`t-out` of a `markup()` value), several contents side by
  side;
- a **region**: a structural node (`t-if`, `t-out`, `t-key`, dynamic tags,
  dynamic `t-call` and slots, dynamic components) holding one sub-content;
- a **list** (`t-foreach`), holding one sub-content per row;
- a **component** (`ComponentNode` is a content);
- an event catcher (`t-on` on a component or a slot).

## Blocks

As before, the static dom of a template is split in blocks: `createBlock`
parses the xml of a block once, and each instance is a deep clone of it. The
dynamic parts of a block are **locations** (attributes, properties, event
handlers, refs) and **child slots** (where structural contents are inserted).

A block instance has:

- `set(i, value)`: sets location `i`, and writes to the dom only if the value
  changed;
- `ref(i, fn)`: binds a `t-ref`, unbound when its owner is disposed;
- `insert(i, content)`: inserts a content at child slot `i`.

Event handlers and refs are set once. All the other values of a block are set
by **one render effect per block**, which re-runs when one of the values it
read changes, and writes only those that changed.

For example:

```xml
<ul>
  <t t-foreach="this.todos" t-as="todo" t-key="todo.id">
    <li t-att-class="{done: todo.done}" t-on-click="() => this.toggle(todo)">
      <t t-out="todo.text"/>
    </li>
  </t>
</ul>
```

compiles to:

```js
const hdlr_fn1 = (ctx) => ctx['this'].toggle(ctx['todo']);
let block1 = createBlock(`<ul><block-child-0/></ul>`);
let block2 = createBlock(`<li block-attribute-0="class" block-handler-1="click"><block-child-0/></li>`);

return function template(ctx, node) {
  const b1 = block1();
  const c2 = list(() => (ctx['this'].todos), ctx, `todo`, (ctx1) => (ctx1['todo'].id), 15, (ctx1) => {
    const b2 = block2();
    b2.set(1, [hdlr_fn1, ctx1]);              // handler: set once
    const c1 = out(() => (ctx1['todo'].text)); // a region
    b2.insert(0, c1);
    renderEffect(() => {                      // the render effect of the block
      b2.set(0, {done:ctx1['todo'].done});
    });
    return b2;
  }, false);
  b1.insert(0, c2);
  return b1;
}
```

The template function runs once per instance. Toggling `todo.done` re-runs one
render effect, which updates one `class` attribute.

## Owners

Everything created while instantiating a content belongs to an **owner**: its
render effects, the components created in it, cleanups (refs) and nested
owners (the sub-contents of its regions). A component has an owner for its
template, and each sub-content of a region or row of a list has its own.

Removing a content goes in three steps:

1. `owner.unmount()`: the `willUnmount` hooks of the mounted components, parents
   first, while the dom is still in place;
2. `content.remove()`: the dom is detached (only the top nodes: what they
   contain goes with them);
3. `owner.dispose()`: render effects are disposed (a queued run is skipped),
   components are destroyed (`onWillDestroy`, children first), and refs are
   unbound, after the detach (a focused input can dispatch `change` or `blur`
   from inside its removal, and its handlers may read the ref).

## Render effects and their order

A render effect is an owl-core computation with the `RENDER` flag. Render
effects are queued separately from user effects, and flushed before them, in
the same microtask: an update is visible after `await Promise.resolve()`, not
on the next animation frame.

The queue is sorted by **depth** (the nesting depth of the owner): a region
runs before what it contains. Otherwise, a child could update from a state its
parent is about to discard:

```xml
<t t-if="this.user()"><span t-out="this.user().name"/></t>
```

When `user` becomes `null`, the `t-if` runs first and disposes the span (whose
queued run is then skipped), instead of the span reading `null.name`. The order
in which effects subscribe to a signal is not enough: an effect re-subscribes
when it re-runs, which moves it after the others.

A render effect may cause a write to a value it just read, during its own run:
for instance, a component it creates writes it in `setup`, or an error it
triggers is handled by an `onError` (ErrorBoundary) setting a signal. owl-core
only notifies a computation that is not running, so such a write would be
lost: a render effect written to while `RUNNING` is marked `DIRTY`, and queued
again when its run ends.

## Regions

A region (`Toggle` for `t-if`, `Keyed` for `t-key` and dynamic tags, calls,
slots and components, `Out` for `t-out`) has a render effect deciding what to
show. When it changes, `replace` creates the new sub-content (in a new owner,
without tracking what the creation reads), inserts it before the current one,
then removes and disposes the current one. A region always has a sub-content (an
empty text when there is nothing to show), so it needs no anchor node.

`Out` updates a text in place, and creates texts and markup without an owner.

## Lists

The render effect of a list reads the collection and the keys only. Rows are
created once, with a context whose loop variables (`todo`, `todo_index`,
`todo_first`, `todo_last`, `todo_value`, for the ones the body uses) are
getters on per-row signals. When the collection changes:

- a kept row gets the new values of its variables (signals with an equality
  check: only what depends on a changed variable runs);
- a new row is created, a removed row is unmounted, removed and disposed;
- the rows are placed from the end: a kept row only moves if it is not already
  before the next one, so a reorder moves the existing nodes;
- a list that is all its parent contains is cleared at once.

## Components

A component is created by a render effect of its parent, which computes its
props: the first run creates the component, the next ones call `updateProps`.
The component is not re-rendered: `onWillUpdateProps` hooks run, then the new
props are applied, and the props signals (see `useProps`) notify the render
effects that read them. The keys of `useProps()` without a schema are reactive
too.

Slots are created once (their attributes are getters, computed when read), and
instantiated where the child calls them, with the parent's context and the
child as host (components in a slot are children of the host).

`onWillStart` hooks that return no promise do not delay the rendering. When
one returns a promise, the component shows an empty text until it resolves,
then renders and replaces it. The initial mount of an app waits for the
components of its initial tree (the root counts them), and is then inserted at
once. A component destroyed while waiting no longer counts.

`onMounted` hooks run once a component's content is in the dom: when the root
is inserted, or when a region inserts a new sub-content under a mounted host.
They run in reverse creation order (children before their parent, last
sibling first).

Errors in a render effect, in a component's creation or in its hooks go to the
`onError` handlers of the component, then of its parents. An unhandled error
destroys the app (or rejects the mount promise).

## Compiled templates

The closures of a compiled template (rows, branches, slots, render effects)
are created once and run later. So the rendering context is never reassigned:

- a `t-set` creates a new context layer in a new constant (`ctx2`, ...), where
  its value is a getter computed in the previous layer (a `computed`: evaluated
  when read, and kept up to date);
- the attributes of a `t-call`, the scope of a slot and the attributes of a
  slot are getters too;
- a `t-model` expression is evaluated where it is used (it may designate
  another signal later).

## Differences with the vdom runtime

- No `render()`, no `onWillPatch`, no `onPatched`, no Suspense.
- Updates are applied in the next microtask, not on the next animation frame.
- A `t-set` does not leak out of a `t-if`, does not accumulate across loop
  iterations, and is only evaluated if it is read.
- Refs are set when the template is instantiated, before the content is
  inserted.
- A component waiting for `onWillStart` shows a placeholder; its parent does
  not wait for it (except during the initial mount).
- Not implemented: Portal `position`, `t-call-block`.

## Next steps

- A plain `t-out` text inside a block could be a location set by the render
  effect of the block, instead of a region with its own effect.
- Creating and disposing rows costs more than with the vdom (an owner, signals
  and render effects per row): see `tools/benchmark`.
- Async: suspending render effects on not-ready values, and boundaries holding
  the insertion of new content (see the Owl 4 design).
