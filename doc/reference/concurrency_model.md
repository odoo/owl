# 🦉 Concurrency Model 🦉

## Content

- [Overview](#overview)
- [Rendering Components](#rendering-components)
- [Semantics](#semantics)
- [Asynchronous Rendering](#asynchronous-rendering)

## Overview

Owl was designed from the very beginning with asynchronous components. This comes
from the `willStart` and the `willUpdateProps` lifecycle hooks. With these
methods, it is possible to build complex highly concurrent applications.

Owl concurrent mode has several benefits: it makes it possible to delay the
rendering until some asynchronous operation is complete, it makes it possible
to lazy load libraries, while keeping the previous screen completely functional.
It is also good for performance reasons: Owl uses it to only apply the result of
many different renderings only once in an animation frame. Owl can cancel
a rendering that is no longer relevant, restart it, reuse it in some cases.

But even though using concurrency is quite simple (and is the default behaviour),
asynchrony is difficult, because it introduces an additional dimension that
vastly increase the complexity of an application. This section will explain
how Owl manages this complexity, how concurrent rendering works in a general way.

## Rendering Components

The word _rendering_ is a little vague, so, let us explain more precisely the
process by which Owl components are displayed on a screen.

When a component is mounted or updated, a new rendering is started. It has
two phases: _virtual rendering_ and _patching_.

### Virtual rendering

This phase represent the process of rendering a template, in memory, which create a virtual representation of the desired component html). The output of this phase is a
virtual DOM.

It is asynchronous: each subcomponents needs to either be created (so, `willStart`
will need to be called), or updated (which is done with the `willUpdateProps`
method). This is completely a recursive process: a component is the root of a
component tree, and each sub component needs to be (virtually) rendered.

### Patching

Once a rendering is complete, it will be applied on the next animation frame.
This is done synchronously: the whole component tree is patched to the real
DOM.

## Semantics

We give here an informal description of the way components are created/updated
in an application. Here, ordered lists describe actions that are executed
sequentially, bullet lists describe actions that are executed in parallel.

**Scenario 1: initial rendering** Imagine we want to render the following component tree:

```
        A
       / \
      B   C
         / \
        D   E
```

Here is what happen whenever we mount the root
component (with some code like `app.mount(document.body)`).

1. `willStart` is called on `A`

2. when it is done, template `A` is rendered.

   - component `B` is created
     1. `willStart` is called on `B`
     2. template `B` is rendered
   - component `C` is created
     1. `willStart` is called on `C`
     2. template `C` is rendered
        - component `D` is created
          1. `willStart` is called on `D`
          2. template `D` is rendered
        - component `E` is created
          1. `willStart` is called on `E`
          2. template `E` is rendered

3. each components are patched into a detached DOM element, in the following order:
   `E`, `D`, `C`, `B`, `A`. (so the actual full DOM tree is created
   in one pass)

4. the component `A` root element is actually appended to `document.body`

5. The method `mounted` is called recursively on all components in the following
   order: `E`, `D`, `C`, `B`, `A`.

**Scenario 2: rerendering a component**. Now, let's assume that the user clicked on some
button in `C`, and this results in a state update, which is supposed to:

- update `D`,
- remove `E`,
- add new component `F`.

So, the component tree should look like this:

```
        A
       / \
      B   C
         / \
        D   F
```

Here is what Owl will do:

1. because of a state change, the method `render` is called on `C`
2. template `C` is rendered again

   - component `D` is updated:
     1. hook `willUpdateProps` is called on `D` (async)
     2. template `D` is rerendered
   - component `F` is created:
     1. hook `willStart` is called on `F` (async)
     2. template `F` is rendered

3. `willPatch` hooks are called recursively on components `C`, `D` (not on `F`,
   because it is not mounted yet)

4. components `F`, `D` are patched in that order

5. component `C` is patched, which will cause recursively:

   1. `willUnmount` hook on `E`
   2. destruction of `E`,

6. `mounted` hook is called on `F`, `patched` hooks are called on `D`, `C`

Tags are very small helpers to make it easy to write inline templates. There is
only one currently available tag: `xml`, but we plan to add other tags later,
such as a `css` tag, which will be used to write [single file components](../learning/how_to_write_sfc.md).

### Asynchronous Rendering

Working with asynchronous code always adds a lot of complexity to a system. Whenever
different parts of a system are active at the same time, one needs to think
carefully about all possible interactions. Clearly, this is also true for Owl
components.

There are two different common problems with Owl asynchronous rendering model:

- any component can delay the rendering (initial and subsequent) of the whole
  application
- for a given component, there are two independant situations that will trigger an
  asynchronous rerendering: a change in the state, or a change in the props.
  These changes may be done at different times, and Owl has no way of knowing
  how to reconcile the resulting renderings.

Here are a few tips on how to work with asynchronous components:

1. Minimize the use of asynchronous components!
2. Maybe move the asynchronous logic in a store, which then triggers (mostly)
   synchronous renderings
3. Lazy loading external libraries is a good use case for async rendering. This
   is mostly fine, because we can assume that it will only takes a fraction of a
   second, and only once (see [`owl.utils.loadJS`](utils.md#loadjs))
4. For all the other cases, the [`AsyncRoot`](misc.md#asyncroot) component is there to help you. When
   this component is met, a new rendering
   sub tree is created, such that the rendering of that component (and its
   children) is not tied to the rendering of the rest of the interface. It can
   be used on an asynchronous component, to prevent it from delaying the
   rendering of the whole interface, or on a synchronous one, such that its
   rendering isn't delayed by other (asynchronous) components. Note that this
   directive has no effect on the first rendering, but only on subsequent ones
   (triggered by state or props changes).

   ```xml
   <div t-name="ParentComponent">
     <SyncChild />
     <AsyncRoot>
        <AsyncChild/>
     </AsyncRoot>
   </div>
   ```
