# 🦉OWL Release Notes (DRAFT)

## Overview

Owl 3.x is the upcoming major version of Owl. This document provides a
detailed overview of the proposed changes, along with explanations of the
underlying ideas and motivations. Its primary purpose is to serve as a basis
for discussion around the design decisions behind Owl 3.0.

Here is the big picture, in terms of changes:

- Rework the reactivity system to introduce signals, computed values, and effects.
- Replace the `env` object with a plugin system.
- Rework the props system to make it more powerful and better typed.
- A redesign/simplification of other APIs (references, t-model, ...)

Please note that the design is still a work in progress and may evolve as
discussions progress.

This is a significant breaking change in Owl. See the migration
guide for more details: [Migration Guide to Owl 3](migration_guide.md)

## Table of Content

- [Why Owl 3.x?](#why-owl-3x)
- [Reactivity System](#reactivity-system)
  - [Signals](#signals)
  - [Computed Values](#computed-values)
  - [Proxy](#proxy)
  - [Effects](#effects)
  - [Why Signals?](#why-signals)
- [Plugin System](#plugin-system)
- [Props System](#props-system)
  - [Automatic .alike for arrow function props](#automatic-alike-for-arrow-function-props)
- [Other Changes](#other-changes)
  - [env is removed](#env-is-removed)
  - [Services are removed](#services-are-removed)
  - [Rendering Context](#rendering-context)
  - [Scoping changes](#scoping-changes)
  - [Type Validation](#type-validation)
  - [onWillUpdateProps is removed](#onwillupdateprops-is-removed)
  - [useComponent is removed](#usecomponent-is-removed)
  - [t-esc is removed](#t-esc-is-removed)
  - [t-slot is renamed t-call-slot](#t-slot-is-renamed-t-call-slot)
  - [t-call changes](#t-call-changes)
  - [Registries and resources](#registries-and-resources)
  - [References](#references)
  - [t-model](#t-model)
  - [onWillRender and onRendered are removed](#onwillrender-and-onrendered-are-removed)
  - [this.render is removed](#thisrender-is-removed)
  - [t-portal is removed](#t-portal-is-removed)
  - [useexternallistener is renamed uselistener](#useexternallistener-is-renamed-uselistener)
  - [Event handler: .passive modifier](#event-handler-passive-modifier)
  - [loadFile is removed](#loadfile-is-removed)
  - [App and Roots](#app-and-roots)
  - [useApp](#useapp)
- [Other ideas](#other-ideas)
- [Examples](#examples)

## Why Owl 3.x?

In the past, moving from the widget system to Owl 1.0 made it possible to keep
scaling odoo without collapsing under our own complexity. Before Owl 1.0, the
power/expressivity of the widget system was too low, so we had to manually
coordinate all widgets changes in user code.

Owl 1 and 2 were about declaring components, and letting the framework coordinate
them. With owl 2, you can let the framework compose components, and update the
UI efficiently whenever the internal state changes. Without this transition,
the development in the odoo javascript codebase would have slowed down
considerably, as each change would bring bugs, especially since it is very difficult
to coordinate complex transitions across teams and applications. Also, it was
difficult to attract and train talent.

Now, Owl 2 is a solid piece of code, and it is stable. So, why the need to change
it? Well, in the last 3/4 years, the codebase at Odoo grew considerably, both in
lines of code and in complexity. Complex systems have been built, and we encountered
some "soft limits":

- the reactivity system, albeit simple on the surface, is actually quite subtle, and
  difficult-to-diagnose bugs can appear, especially as more complex workflows are
  used in odoo
- no good support for typing/autocompletion in props/env. So lots of work has been done to write
  or generate .d.ts files, docstrings, and tooling.
- difficulty writing performant code when we have to make computations based on
  reactive properties. Lots of tricks appeared to work around the issue (writing
  caches, using getters, using onWillRender to precompute values, ...). Sadly,
  they usually do not compose well (so, easy to break when code is patched from
  another addon for example).
- not much guidance from the framework in the way we build application. It is
  nice not to be constrained, but at the same time, in Odoo, it makes it more
  difficult to understand other parts of the codebase, that may use different
  strategies/communication patterns.

So, to summarize, Owl 3.x is our answer to these challenges. We want to bring
a little bit more power into the framework so future user code will be easier
to write and maintain: computed functions to make state coordination more
declarative, plugins to help coordinate parts of the application in a composable
way, better APIs to improve typing/autocompletion situation, signals to solve
all tricky reactivity issues.

## Reactivity System

High-level change: the reactivity system based on proxies is replaced by a
signal-based reactivity system, including signals, computed values, and effects.

- `useState` and `reactive` are removed.
- `signal`, `proxy`, and `computed` are introduced.
- `effect` is introduced, and `useEffect` is simplified.

Unlike `useState`, signals (as well as `computed` values and `proxy` objects) are
reactive values that are not tied to a specific component instance. Instead,
they are automatically tracked and handled by the execution context in which
they are accessed. For example, if a component reads a reactive value, it will
be automatically re-rendered when that value changes. This will solve
many subtle bugs and remove the need to call `useState` in many places.

Computed values are lazily evaluated and only recomputed when necessary — that is,
when the value is accessed and one of its reactive dependencies has changed.
This makes it straightforward to cache expensive computations efficiently.

```js
const count = signal(0);
const state = proxy({ color: "red", value: 15 });
const total = computed(() => count() + state.value);

console.log(total()); // logs 15
```

Owl components create an internal effect whenever they are instantiated and when
they are rendered. So, this means that all reactive values read at another moment
are not observed. For example, in Owl 2, an event handler could cause a component
to subscribe to some values, which would possibly cause unintended updates later.

### Signals

A signal is a value that can be observed (by reading it), and updated. It is
created by the `signal` function:

```js
const s1 = signal(3); // a primitive value
const s2 = signal(new Model()); // whatever you want

// read value by calling the function
s1(); // return 3
s2(); // return the model instance (NOT a proxy)

// set value with .set
s1.set(4);
// increment it
s1.set(s1() + 31);
```

Setting a signal to an identical value is ignored, so it does not trigger any
component to be updated. However, it is something that we actually need sometimes.
For example, if we push an element in a list. In that case, we need to explicitly
invalidate the signal to tell Owl that everything that depends on it is now
stale.

```js
const list = signal([1, 2, 3]);

// does not change the content of the signal
list().push(4);
// so we have to manually tell owl it is no longer up to date
signal.invalidate(list);
```

Since manipulating collections of elements is a very common need, we introduce
four functions that basically wrap the target array, object, set or map in a
proxy (but not a nested proxy like the `proxy` function). This is useful so
we can properly invalidate the signal whenever the content has changed.

```js

const mylist = signal.Array([]);
// changes the content of the list => owl will force updates
mylist().push(4);

// mylist() is a proxy => the change is detected
mylist().push({nested: {object: 1}});

// here, we change deeply nested state => no change is detected, a manual
// invalidate may be necessary, if that is what we want
mylist().at(-1).nested.object = 2;

// same for other collections
const myobj = signal.Object({a: 3});
const myset = signal.Set(new Set(...));
const mymap = signal.Map(new Map());
```

### Computed Values

A computed value is a value that is computed by a function, from other computed
values and signals (and proxy). It will track its dependencies, and only be
computed if necessary (when it is called, and is stale or some of its dependencies
have changed);

```js
const s1 = signal(3);
const s2 = signal(5);
const d1 = computed(() => 2 * s1());
const d2 = computed(() => d1() + s2());

d1(); // evaluate the function, returns 6
d2(); // evaluate function d2, does not reevaluate d1, return 11
d2(); // returns immediately the result
s2.set(6);
d2(); // evaluate function d2, does not reevaluate d1, return 12
```

So, with computed values, we have a dynamic graph of values (base values like
signals and proxies, and derived values with compute functions). Owl will try
to efficiently only recompute what it needs.

A computed function can act like a signal, it has an empty `set` function. It is
also possible to redefine the `.set` function, to make it writable, in some
situations:

```js
const s = signal(3);
const double = computed(() => 2*s());
double();       // return 6
double.set(5);  // nothing happens
double();       // return 6
const triple = computed(() => 3*s(), {
  set: value => s.set(value/3);
});
triple();       // returns 9
triple.set(6);  // signal s is set to 2!
s();            // returns 2
triple();       // returns 6
```

### Proxy

A proxy is the replacement for reactive/useState: it recursively returns a proxy,
to make it easy to observe various nested structures. Note that it is not a hook:
it can be called at any time. Also, even though it has the same syntax as
`useState`, it is implemented using signals.

```js
const p = proxy({ a: { b: 3 }, c: 2 }); //p is a proxy
p.a; // another proxy that points to { b: 3 }
p.a.b; // 3
```

### Effects

Signals, computed and proxy are values, they can be produced anywhere, at any
time. Now, `effects` are functions that subscribe to values, they are the context
in which a value is consumed. The effect function
is executed immediately, and whenever the value it depends on changes. It also returns a callback function to clean up the effect (stop it).

About synchronicity: effects
are executed immediately when created, and then, after a microtick, whenever they
have to rerun.

```js
const s = signal(3);
const d = computed(() => 2 * s());
const cb = effect(() => {
  console.log(d()); // read the value d, which reads s
});
// at this point, 6 is logged
s.set(4);
// nothing happens immediately
await Promise.resolve();
// now 8 is logged => the effect has been reexecuted

cb();
// now the effect is inactive
s.set(5);
await Promise.resolve();
// nothing happens
```

Note that once created, an effect is always alive, so if you use it in a component,
it should be cleaned up, typically in a `onWillDestroy` hook. To make it easy,
that's exactly what `useEffect` does now:

```js
class C extends Component {
  setup() {
    // equivalent to onWillDestroy(effect(() => {...}));
    useEffect(() => {
      console.log(someValue());
    });
  }
}
```

So, the `useEffect` hook is now tied to the signals instead of the component
willPatch/patched hooks.

### Why Signals?

Why change the reactivity system (`useState`/`reactive`)? The current system
works well in most cases, solving roughly 95% of typical issues. However, in
more advanced scenarios it can be tricky to use correctly. Developers need to
carefully manage `useState` or `toRaw` calls and track how values propagate
through the application.

Signals were chosen to replace proxy-based reactivity because they provide a
simpler, more explicit, and more composable model.

With proxies, reactive behavior is implicit and can be difficult to reason
about, especially when values cross abstraction boundaries. Signals make
dependencies explicit at read time, which improves predictability and reduces
surprising updates.

Because signals are not tied to components, they can be created and shared
freely across the application, including in plugins and plain JavaScript
modules. This leads to more flexible architectures and better separation of
concerns.

## Plugin System

The plugin system is designed to provide a higher level of abstraction than the
environment. A plugin is a self-contained unit of code that can provide a
service, maintain internal state, be imported by other plugins or components,
and be dynamically installed on a component and its subcomponents. Plugins are
automatically destroyed at the appropriate point in the component lifecycle.

Plugins have a simple lifecycle (`setup` => `destroy`), and as such, can call some
hooks like components

The goal is to remain minimalist while offering a more type-safe alternative to
the environment and a solid set of building blocks for large-scale applications.
In Odoo, plugins will replace services.

The main ideas for plugins are:

- the `Plugin` class: every plugin should subclass it,
- the `plugin` function, useful to import a dependency in a typesafe way (either
  in a plugin, or in a component),
- a function `providePlugins` that allows a component to define a set of plugins
  kind of like a `useSubEnv`: these plugins are available only for the component
  and its children.

But first, let's look at a simple example.

```js
class Clock extends Plugin {
  value = signal(1);

  setup() {
    const interval = setInterval(() => {
      this.value.set(this.value() + 1);
    }, 1000);
    onWillDestroy(() => {
      clearInterval(interval);
    });
  }
}

class A extends Plugin {
  // import the instance of plugin Clock in A
  clock = plugin(Clock);
  mcm = computed(() => 2 * this.clock.value());
}

class Root extends Component {
  static template = xml`<t t-out="this.a.mcm()"/>`;

  a = plugin(A); // import plugin A into component
}

mount(Root, document.body, { plugins: [Clock, A] });
```

Since the plugin system provides a more structured way to coordinate pieces of
code, it is possible to replace all uses of the owl 2 environment with plugins.
A service will become a global plugin, and `useSubEnv` can be replaced by sub
plugins (with `providePlugins`).

```js
import {
  Component,
  signal,
  mount,
  Plugin,
  plugin,
  providePlugins,
  computed,
  xml,
  onWillDestroy,
} from "@odoo/owl";

class Clock extends Plugin {
  value = signal(1);

  setup() {
    const interval = setInterval(() => {
      this.value.set(this.value() + 1);
    }, 1000);
    onWillDestroy(() => {
      clearInterval(interval);
    });
  }
}

class A extends Plugin {
  // import the instance of plugin Clock in A
  clock = plugin(Clock);
  mcm = computed(() => 2 * this.clock.value());
}

class ChildChild extends Component {
  static template = xml`<t t-out="this.a.mcm()"/>`;
  a = plugin(A);
}

class Child extends Component {
  static components = { ChildChild };
  static template = xml`<ChildChild/>`;

  // cannot import A here => no provider
  // a = plugin(A);
  setup() {
    providePlugins([A]);
    // can now import A
  }
}
class Root extends Component {
  static components = { Child };
  static template = xml`<Child />`;

  // cannot import A => no provider
  // a = plugin(A);
}

// Clock is a global plugin (service)
mount(Root, document.body, { plugins: [Clock] });
```

## Props System

Owl 3.x no longer uses the static `props` description or the static
`defaultProps` object. Instead, props must be explicitly accessed through a
function call. This approach is more direct, more composable (for example, a
hook can grab some props), and better supported by IDEs, since types can be
mostly inferred automatically.

```js
import { Component, props, types as t } from "@odoo/owl";

class MyComponent extends Component {
  static template = "mytemplate";

  // now, this.props is an object with the two keys a and b, and IDEs can
  // infer that this.props.a is a string, and this.props.b is a optional number
  props = props({ a: t.string, "b?": t.number });
}
```

The `props` function can be called multiple times in a component:

```js
import { Component, props } from "@odoo/owl";

class MyComponent extends Component {
  static template = "mytemplate";

  props = props({ a: t.string, "b?": t.number });
  otherProps = props({ c: t.instanceOf(SomeClass) });

  // no description here => we get all props received by the component
  // no type inference nor validation here!
  allProps = props();

  // short version, no type inference, but some validation
  propsabc = props(t.object(["a", "b?", "c"]));

  // we can define default values as well, as second argument:
  myProp = props(
    {
      "foo?": t.boolean,
    },
    {
      foo: true,
    }
  );
}
```

Props validation is performed (in development mode) at each props function call,
but only for the props explicitly defined in the component's props description.
This represents a small philosophical change: we no longer validate or care about
extra props passed to a component. An Owl component simply declares, via its
props function calls, which props it expects to receive. It is more ergonomic
for some cases, for example, we no longer need to declare the `slots` prop,
unless we want to explicitly use it.

Although this change is minor in terms of framework code, it has significant
implications for usability and developer experience. It becomes easier to
subclass a component and add extra props, and the system is more type-safe and
IDE-friendly.

Small note: the app config key `warnifnostaticprops` has been removed.

<details><summary>Notes on code migration (owl 2.x -> 3.x)</summary>

The simple upgrade process is this:

- import the `props` function
- replace the static props description object by a call to the `props` function,
  adding default values if necessary.
- maybe remove unneeded props (like `slots`)

```js
// owl 2.x
class SomeComponent extends Component {
  static template = "...";
  static props = {
    name: String,
    visible: { type: Boolean, optional: true },
    immediate: { type: Boolean, optional: true },
    leaveDuration: { type: Number, optional: true },
    onLeave: { type: Function, optional: true },
    slots: Object,
  };
  static defaultProps = {
    leaveDuration: 100,
  };
}

// owl 3.x
class SomeComponent extends Component {
  static template = "...";

  props = props(
    {
      name: t.string,
      "visible?": t.boolean,
      "immediate?": t.boolean,
      "leaveDuration?": t.number,
      "onLeave?": t.function(),
      // no need to grab the slot prop here
    },
    {
      leaveDuration: 100,
    }
  );
}
```

Later, when the code is reworked, it may make sense to split the props in various
props calls, for example if we have a set of props that we want to grab to give
to a sub component.

</details>

### Automatic .alike for arrow function props

In Owl 3.x, when a parent component re-renders, all child components receiving
new props are also re-rendered. This is usually the right behavior, but arrow
functions defined inline in templates are recreated on every render, which means
they are never referentially equal to their previous value. This can cause
unnecessary child re-renders.

Owl 2.x introduced the `.alike` prop suffix to address this: marking a prop
with `.alike` tells Owl to skip the comparison for that prop when deciding
whether to re-render the child.

```xml
<!-- manual .alike: the child will not re-render just because of this prop -->
<Child onClick.alike="() => this.doSomething(item.id)"/>
```

In Owl 3.x, the compiler now **automatically** applies `.alike` semantics to
arrow function props when it can statically determine that the function's
captured variables have not changed. It does this by detecting free variables
in the arrow function body and tracking them as additional props. If none of
the captured values have changed, the child component skips re-rendering —
without requiring the developer to manually add `.alike`.

```xml
<!-- Owl 3.x: no .alike needed, the compiler handles it automatically -->
<t t-foreach="this.items" t-as="item" t-key="item.id">
  <Todo todo="item" toggle="() => this.toggle(item.id)"/>
</t>
```

In the example above, the compiler detects that the arrow function captures
`item`. It automatically tracks the value of `item` alongside the `toggle`
prop. If `item` has not changed between renders, the child component will not
re-render.

For arrow functions with no captured variables (e.g. `() => 1`), the
optimization is even simpler: the prop is effectively constant and the child
will never re-render because of it.

The manual `.alike` suffix remains available for cases where the automatic
detection is not sufficient.

## Other Changes

### env is removed

Plugins are a minimal abstraction that allow, in a typesafe way, to share
state and features among various part of the code. They also support shadowing (
so, replacing all plugins imported in a component and its children by a different
implementation), and also, can be added at runtime, in any component. As such,
they provide a more powerful abstraction than the `env` object.

This is a big change in the way we write and coordinate code in Odoo. Obviously,
this cannot be done instantly, so we plan to temporarily keep support for the
`env` object.

We are aware that this is a very big change, and will require a complicated
code upgrade, but from our early work, it feels that the resulting code is
much simpler.

<details><summary>Compatibility code for keeping `env`</summary>

Here is a rough outline of what the compatibility code could look like:

```js
class EnvPlugin extends Plugin {
  env = {};
}

const useEnv = () => plugin(EnvPlugin).env;
owl.useEnv = useEnv;

patch(Component.prototype, {
  setup() {
    super.setup();
    this.env = useEnv();
  }
}

owl.useSubEnv = function (extension) {
  const env = useEnv();
  const subEnv = Object.assign(Object.create(env), extension);
  class SubEnvPlugin extends Plugin {
    static id = "EnvPlugin";
    env = subEnv;
  }
  providePlugins([SubEnvPlugin]);
}
```

</details>

### Services are removed

Okay, this is quite a provocative title. First, services are not a Owl concept,
so there is not really a change in Owl 3. However, with the arrival of plugins,
all services will likely be converted to plugins. It may look like this:

```js

// router service
class RouterPlugin extends Plugin {
  ...
}

// action service
class ActionPlugin extends Plugin {
  // import router service
  router = plugin(RouterPlugin);
  ...

  doAction(action) {
    ...
    this.router.navigateTo(newUrl);
  }
}
// notification service
class NotificationPlugin extends Plugin {
  ...
  add(title, text) {
    ...
  }
}

// in a component:
class MyComponent extends Component {
  // import services
  notification = plugin(NotificationPlugin);
  action = plugin(ActionPlugin);

  doSomething() {
    // call services
    this.notification.add("Coucou", "some message");
    this.action.doAction(...);
  }
}
```

### Rendering context

Change: in owl 3.x, all variables are by default local. Accessing the component
can only be done with `this.`. For example:

```xml
<!-- owl 2.x -->
<t t-set="item" t-value="123">
<button t-on-click="onClick">
  <t t-out="val"/>
  <t t-out="item"/>
</button>
```

should be rewritten like this:

```xml
<!-- owl 3.x -->
<t t-set="item" t-value="123">
<button t-on-click="this.onClick">
  <t t-out="this.val"/>
  <t t-out="item"/>
</button>
```

<details>
<summary>Details</summary>

In Owl 2.x, the rendering context was an object
whose prototype is the instance of the component.

```xml
<!-- owl 2.x -->
<div><t t-out="val"/></div>
```

So, the `t-out` expression above will read `val` from the template, if it is
defined, and will fall back to the component if not.

In Owl 3.x, the rendering context is an object with a key `this` pointing to the
instance of the component. So, in the following example, the first `t-out` will
always read the value from the component, and the second from the local variable

```xml
<!-- owl 3.x -->
<t t-set="val" t-value="3"/>
<div><t t-out="this.val"/></div>
<div><t t-out="val"/></div>
```

This means that pretty much all js expressions in templates will have to be
changed to use the proper `this.` expression.

```xml
<!-- owl 3.x -->
<div t-on-click="this.onClick">...</div>
```

The main motivation is to prevent capturing unexpectedly the rendering context.
We have to sometimes use explicitly `this` to avoid issues. For example:

```xml
<button t-on-click="item => onClick(item)">button</button>
```

will call the `onClick` method from the rendering context! So, it will sort of
work, the actual component method will be called, but bound to the context, not
the component. It can lead to surprising bugs. For example, if the `onClick`
method does something like this: `this.a = 1`, the `a` value will not be
assigned to the component. This is a case where it is actually quite rare to
get, but then you need to be an expert to understand the problem.

Another issue that this change will solve is to make it simpler to understand
where a value comes from.

See https://github.com/odoo/owl/issues/1317

</details>

<details><summary>Notes on code migration (owl 2.x -> 3.x)</summary>

This is clearly a significant breaking change. Most templates will need to be
updated to prepend `this.` to each value that is not a local template variable.
We will provide scripts to automate much of this work. However, it is not always
possible to statically determine whether a variable comes from the component or
from a local template variable.

The main complication arises when a variable in template `A` is defined in another
template that calls `A` via `t-call`. Static analysis cannot always detect such
cases. As a result, the migration script will typically assume that any
unbound variable in `A` belongs to the component rather than being provided by
the calling template.

In practice, this affects only a small portion of the Owl codebase, since most
code tends to use subcomponents rather than relying heavily on `t-call`.

</details>

### Scoping changes

The scoping model for template variables has been significantly simplified in
Owl 3.x. The goal is to align the template language's semantics with those of
JavaScript, making behavior more predictable and eliminating several rough edges.

**Background.** In Owl 2.x, variable scoping relied on a number of internal
mechanisms: `Object.create`, `ctx[isBoundary]`, `capture(ctx)`,
`captureExpression`, `hasSafeContext`, and others. This complexity arose from
trying to preserve the original Python QWeb semantics for `t-set` while also
providing JS-like ergonomics for lambdas (e.g. arrow-function event handlers).
In some cases these goals were fundamentally incompatible, leading to subtle
bugs: for example, adding or removing a `t-set` in a template could
unexpectedly change the behavior of unrelated parts of the template.

Slots and `t-call` bodies are essentially lambda functions that should close
over their rendering context at the point of definition. But the Owl 2.x
`capture(ctx)` mechanism only captured a frozen copy of the _values_, not the
actual _bindings_. The same issue existed with `captureExpression`. This meant
that mutations to a variable after a slot or `t-call` body was defined would
not be reflected when the slot/body was later rendered.

**What changed.** In Owl 3.x, the scoping model now mirrors JavaScript:

- **Loops create a new scope per iteration** (`let` semantics). Each iteration
  of `t-foreach` gets its own context object, just like a `for...of` loop with
  `let` in JavaScript. This means that functions defined inside a loop (slots,
  event handlers, `t-call` bodies) correctly close over the _bindings_ for that
  specific iteration, not a snapshot of the values.

- **`t-set` reassignment is scope-aware.** If a variable is defined before a
  loop and reassigned inside it, the change correctly propagates to the outer
  scope:

  ```xml
  <t t-set="a" t-value="0"/>
  <t t-foreach="[1, 2]" t-as="i" t-key="i">
    <t t-set="a" t-value="a + 1"/>
  </t>
  <!-- owl 2.x: a is 0 (loop changes were lost) -->
  <!-- owl 3.x: a is 2 (loop changes correctly propagate) -->
  <t t-out="a"/>
  ```

- **Slots and `t-call` bodies close over actual bindings**, not frozen copies.
  This eliminates the class of bugs where a slot would render with stale values
  because `capture(ctx)` took a snapshot too early.

- **Internal simplification.** The `capture`, `captureExpression`,
  `setContextValue`, `isBoundary`, and `hasSafeContext` mechanisms have all
  been removed. The compiled code is now simpler and more predictable.

### Type Validation

The type validation system has been improved. Owl now exports two functions:

```ts
// check that value satisfies the given type. returns a list of errors
// (so, empty list => ok)
validateType(value: any, type: any): Issue[];

// throw error if the value does not satisfy the given type
assertType(value: any, type: any, errorHeader?: string);
```

Instead of defining a type
with a mini DSL using objects, we now use functions, which makes it easier to
compose and manipulate types, and allows IDEs to know the correct type, so
autocompletion works much better. Here is what it looks like:

```js
// owl 2.x
static props = {
  mode: {
      type: String,
      optional: true,
  },
  readonly: { type: Boolean, optional: true },
  onChange: { type: Function, optional: true },
  onBlur: { type: Function, optional: true },
};

// owl 3.x
props = props({
  "mode?": t.string,
  "readonly?": t.boolean,
  "onChange?": t.function(),
  "onBlur?": t.function(),
});

// other examples
props = props({
  someObject: t.object({
    id: t.string,
    values: t.union([t.array(), t.number])
  }),
});

assertType(myObj, t.object({ id: t.number, text: t.string}));
```

### onWillUpdateProps is removed

The goal of `onWillUpdateProps` was to allow a component to react properly to
props change. However, I believe that it is not the best solution for a
framework. One of the main issues is that it is somewhat imperative (we have to
explicitly tell the component what to do in order to maintain a coherent state),
it would be much better if we could have a declarative way to do it, and we
actually have such a tool now in owl 3: the reactivity system, and in particular,
computed functions.

Now, it is possible to declare the relation between a component internal state
and its props using computed functions. Also, a component can take a signal value
as a prop, or the value of the signal. Note that it is usually better to give
the signal from a performance standpoint.

```js
class Child extends Component {
  static template = xml`<t t-out="this.double()"/>`;
  props = props({ count: t.signal(t.number) });

  // double is always updated
  double = computed(() => 2 * this.props.count());
}

class Parent extends Component {
  static template = xml`<Child count="this.count"/>`;

  count = signal(1);

  setup() {
    useInterval(() => this.count.set(this.count() + 1), 1000);
  }
}
```

In the example above, only the child component will be updated when the count
signal is incremented.

### useComponent is removed

The `useComponent` hook is often problematic. This is sometimes useful to access
the current app (by using `comp.__owl__.app`!), but this usecase has been
replaced by `useApp`. From a quick look into Odoo codebase, we noticed that most
uses of `useComponent` are not very good (for example, writing functions on the
current component, or getting the current props), and can be easily replaced by
better code (the `props` function can get the props).

### t-esc is removed

The `t-esc` directive, previously used to output and escape text in templates,
has been removed in Owl 3.x. It should now be replaced with the more powerful
`t-out` directive.

```xml
<!-- owl 2.x -->
<div><t t-esc="this.value"/></div>

<!-- owl 3.x -->
<div><t t-out="this.value"/></div>
```

Migration is straightforward: a simple search-and-replace of `t-esc` with
`t-out` is usually sufficient.

### t-slot is renamed t-call-slot

A small usability issue with the `t-slot` directive was that it was not obvious
if it is the place where we insert the content of the slot, or if we define the
slot. In Owl 3.x, it has been renamed to `t-call-slot`, so the intent is more
obvious.

- `t-set-slot` defines the content of a slot
- `t-call-slot` inserts the content of a slot

```xml
<div class="header">
  <t t-call-slot="header"/>
</div>
<div>
  <t t-call-slot="body"/>
</div>
```

### t-call changes

Two breaking changes have been made to the `t-call` directive.

#### t-call is restricted to `<t>` nodes

In Owl 2.x, `t-call` could be used on any DOM node (e.g. `<div t-call="sub"/>`),
which would render the called template inside that node. In Owl 3.x, `t-call`
can only be used on `<t>` nodes. Using it on any other element will throw an
error.

```xml
<!-- owl 2.x: this worked -->
<div t-call="sub"/>

<!-- owl 3.x: this throws an error -->
<div t-call="sub"/>

<!-- owl 3.x: wrap it in a t node instead -->
<div><t t-call="sub"/></div>
```

#### Parametric t-call

In Owl 2.x, passing values to a called template was done by setting variables
inside the `t-call` body using `t-set`:

```xml
<!-- owl 2.x -->
<t t-call="sub">
  <t t-set="node" t-value="subtree"/>
  <t t-set="val3" t-value="val*3"/>
</t>
```

In Owl 3.x, values can be passed directly as attributes on the `t-call` node,
similar to how props are passed to components:

```xml
<!-- owl 3.x -->
<t t-call="sub" node="subtree" val3="val*3"/>
```

This is a cleaner and more explicit approach. The attribute values are
JavaScript expressions, just like component props.

The `t-call` body (children of the `<t>` node) is still supported: it is
rendered and made available to the called template through `t-out="0"`, as
before. When both attributes and a body are present, both work together:

```xml
<t t-call="sub" v_2="1">Hello</t>

<!-- in "sub" template: -->
<span><t t-out="v_2"/><t t-out="0"/></span>
<!-- renders: <span>1Hello</span> -->
```

The `t-call-context` attribute is still supported for passing an object as the
calling context.

#### t-call-context rendering context

In Owl 3.x, the rendering context for templates called with `t-call-context`
has been changed to align with the new rendering context model (see
[Rendering Context](#rendering-context)).

The context object passed to `t-call-context` is now accessible through `this`
instead of being directly available as local variables:

```xml
<!-- owl 2.x -->
<t t-call="sub" t-call-context="someObj"/>
<!-- in "sub" template, values are accessed directly: -->
<t t-out="value"/>

<!-- owl 3.x -->
<t t-call="sub" t-call-context="someObj"/>
<!-- in "sub" template, values must be accessed through "this": -->
<t t-out="this.value"/>
```

This makes the scoping rules consistent: local template variables (such as
those passed as `t-call` attributes) are accessed directly, while values from
the context object are accessed through `this`.

Additionally, the `__owl__` reference is no longer included in the context.
This means that slots are not accessible within templates called with
`t-call-context`, ensuring the context is "pure" and contains only what is
explicitly passed.

<details><summary>Notes on code migration (owl 2.x -> 3.x)</summary>

Convert `t-set` variables inside `t-call` bodies into attributes on the
`t-call` node:

```xml
<!-- owl 2.x -->
<t t-call="nodeTemplate">
  <t t-set="node" t-value="subtree"/>
  <t t-set="recursive_idx" t-value="recursive_idx + 1"/>
</t>

<!-- owl 3.x -->
<t t-call="nodeTemplate" node="subtree" recursive_idx="recursive_idx + 1"/>
```

An important semantic change: the `t-call` body is now **lazily evaluated**.
It is only rendered when the called template executes `t-out="0"`. If the called
template never outputs `0`, the body is not evaluated at all. In Owl 2.x, the
body was eagerly evaluated before calling the template, which meant that
`t-set` directives inside the body would always run and affect the calling
context, even if the body was never rendered.

</details>

### Registries and resources

The `Registry` class from Odoo has been moved to Owl and rewritten to represent
an ordered collection of key/value pairs. It is implemented using signals and
computed functions, allowing it to integrate seamlessly with the reactivity
system. While it could have remained in Odoo, having a minimal, fully typed,
self-contained implementation makes it easy to use in any Owl-based project
(such as `o-spreadsheet` or others).

The main advantages of registries compared to `signal.Object` or `signal.Map` is
that it supports type validation, and that it is ordered (with sequence option).

```js
const registry = new Registry({ name: "my registry" });
const obj = { a: 1 };
registry.add("key", obj);
registry.get("key") === obj; // true
registry.get("otherkey"); // throw error
registry.get("otherkey", 1) === 1; // true
```

Registries are ordered, and support a sequence option number (default is 50):

```js
registry.add("key1", 1, { sequence: 80 });
registry.add("key2", 2, { sequence: 20 });
registry.add("key3", 3, { sequence: 40 });
console.log(registry.items()); // => 2, 3, 1
```

<details><summary>More details on Registry</summary>

Here is the complete Registry class API:

```
class Registry<T>
  add(key: string, value: T, options);
  addById(item: T & {id: string}, options);

  get(key, defaultValue?: T);
  delete(key);
  has(key): boolean

  // returns the ordered list of [key,value] pairs
  entries: () => [string,T][];

  // returns the list of items
  items: () => T[];
```

We can validate entries:

```js
// only accept strings
const registry = new Registry({ validation: String });
registry.add("string"); // works
registry.add(1); // throws error

// only accept plugins
const pluginRegistry = new Registry({
  name: "plugin registry",
  validation: { extends: Plugin },
});
registry.add("str"); // throws error
registry.add(MyPlugin); // works
```

A common usecase is to add object with an id key. In that case, instead of doing
this:

```js
registry.add(item.id, item); // it still works!
```

we can do this:

```js
registry.addById(item);
```

Items and Entries are computed functions, so they work well with the reactivity
system:

```js
effect(() => {
  // will log everytime there is a change
  console.log(registry.items());
});
```

Another change from Odoo registries: there is no builtin concept of "subregistries",
so, in other words, the "category" method does not have an equivalent. If we
want a registry of registries, we have to define each subregistry explicitly.

</details>

We also introduce a new `Resource` class, which represents an ordered collection
of items (a set, not a map). It is useful in many situations. For example, a
`Resource` could represent a list of error handlers, systray items, command
palette commands, keyboard shortcuts, and similar collections.

```js
const resource = new Resource({ name: "error handlers" });

resource.items(); // []
resource.add("value");
resource.items(); // ["value"]
resource.has("value"); // true
resource.has("string"); // false
```

The main difference between a `Resource` and a set or list, is that the `Resource`
class represents a live collection of items: `resource.items` is a reactive
value (computed function), so one can write other computed functions or effects
that depends on the content of a resource.

The main advantages of resources compared to `signal.Array` or `signal.Set` is
that it supports type validation, and that it is ordered (with sequence option).

<details><summary>More details on Resource</summary>

Here is the complete Resource class API:

```
class Resource<T>
  add(item: T, options);
  delete(item: T);
  has(item: T): boolean

  // returns the list of items
  items: () => T[];
```

</details>

### References

The reference system is simplified, using signals.

In owl 2.x, it works like this:

- we tag a template element with `t-ref`,
- we define a ref object with `useRef` in `setup`, giving it the name of the ref
- we can access the value in `ref.el`, when the component is mounted

```js
class C extends Component {
  static template = xml`<div t-ref="somename">...</div>`;

  setup() {
    this.ref = useRef("somename");
    onMounted(() => {
      console.log(this.ref.el);
    });
  }
}
```

In owl 3.x, it works like this:

- we define a `signal`
- we give the signal to the `t-ref` element in the template
- we can access it like a normal signal

```js
class C extends Component {
  static template = xml`<div t-ref="this.ref">...</div>`;

  setup() {
    this.ref = signal(null);
    onMounted(() => {
      console.log(this.ref());
    });
  }
}
```

This change provides a more powerful and flexible API. For example, it is now
easier for a child component to pass a reference back to a parent: the parent
can provide a signal to the child, which can then use it directly in `t-ref`.
It also simplifies usage within computed functions and effects.

The reference system can also be used for multiple elements. In that case, one
can use a `Resource` instead of a signal:

```js
class C extends Component {
  static template = xml`
    <t t-foreach="this.list" t-as="item" t-key="item.id">
      <div t-ref="this.refs">...</div>`;
    </t>

  setup() {
    this.list = ...;
    this.refs = new Resource();
    onMounted(() => {
      console.log(this.refs.items());
    });
  }
}
```

### t-model

In Owl 2.x, `t-model` was somewhat awkward: it required both a value to display
and a way to update that value. This was handled using an "assignable expression":

```xml
<!-- owl 2.x this works-->
<input t-model="state.value"/>

<!-- owl 2.x and this does not work! (expression is not assignable)-->
<t t-set="v" t-value="state.value"/>
<input t-model="v"/>
```

In Owl 3.x, we now have signals, which represent updatable values. This allows
us to pass a signal directly to a `t-model` expression. The approach is more
powerful: signals are composable (a component can provide a signal to a child
component, which can use it in its template), and they integrate seamlessly
with computed functions and effects.

```js
// owl 3.x
class C extends Component {
  static template = xml`<input t-model="this.value"/>`;

  value = signal("coucou");

  someValue = computed(() => this.value() + "!!!");

  setup() {
    useEffect(() => {
      // will be executed everytime the computed value changes, which is whenever
      // the value signal changes!
      console.log(this.someValue());
    });
  }
}
```

#### t-model.proxy

In addition to signals, `t-model` also supports reactive proxies via the `.proxy`
modifier. This is useful when working with `proxy()` objects, where values are
read and written as plain properties rather than through signal accessors:

```js
class C extends Component {
  static template = xml`<input t-model.proxy="this.state.value"/>`;

  state = proxy({ value: "" });
}
```

The `.proxy` modifier generates code that reads and assigns to the expression
directly (e.g. `this.state.value` / `this.state.value = ...`), rather than going
through a signal interface. It can be combined with the usual modifiers:

```xml
<input t-model.proxy.trim="this.state.name"/>
<input t-model.proxy.number="this.state.count"/>
<input t-model.proxy.lazy="this.state.text"/>
```

### onWillRender and onRendered are removed

The `onWillRender` and `onRendered` hooks have been removed for several reasons:

- They were often used to precompute expensive values, which is now better handled
  using computed functions.
- They encourage an imperative approach: we want code to depend on the graph of
  reactive values, not on the rendering lifecycle of a component.
- There are few use cases in the codebase, and the existing ones can typically
  be implemented using other hooks, such as `onPatched` or `setup`.

Overall, these hooks provided little value and could even encourage bad patterns.

### this.render is removed

The manual `this.render` function is used to force owl to render a component.
It is kind of a manual escape hatch, and was necessary for use cases where we
want to bypass the reactivity system. Now in Owl 3, the reactivity system based
on signal feels like it is sufficient for these usecases. Here is how we could do.

```js
// owl 2
class MyComponent extends Component {
  static template = xml`<Renderer model="this.model"/>`;
  setup() {
    this.model = new VeryBigModel({ onUpdate: () => this.render() });
  }
}

// owl 3
class MyComponent extends Component {
  static template = xml`<Renderer model="this.model"/>`;
  setup() {
    this.model = signal(
      new VeryBigModel({
        onUpdate: () => {
          signal.invalidate(this.model);
        },
      })
    );
  }
}
```

### t-portal is removed

The `t-portal` directive is technically quite complex, and it feels that it does
not bring enough value compared to the problems it can cause. In a world with
declarative reactivity, we have enough other tools that are more
robust. So, it was suggested to remove `t-portal`.

This could mean that instead
of portalling some content to the system, we have to organize the code in a way
that we can receive the portalled value as a component that we insert dynamically,
maybe using roots.

```js
// owl 2.x
class Something extends Component {
  static template = xml`
    <div>...</div>
    <div t-portal=".someselector">portal content</div>
  `;
}
```

In owl 3.x, we can do something like this instead:

```js
class PortalPlugin extends Plugin {
  add(selector, component, props) {
    // mount here a new root at selector location
  }
}

function usePortal(selector, component, props) {
  const portal = plugin(PortalPlugin);
  const remove = portal.add(selector, component, props);
  onWillDestroy(remove);
}

class PortalContent extends Component {
  static template = xml`
    <div>portal content</div>
  `;
}

class Something extends Component {
  static template = xml`
    <div>...</div>
  `;

  setup() {
    usePortal(".someselector", PortalContent);
  }
}
```

### useExternalListener is renamed useListener

The `useExternalListener` hook has been renamed to `useListener`. The word
_external_ was intended to indicate listening to events outside the component's
DOM. However, the hook actually works with any EventBus, and in some cases it
was awkward to call `useExternalListener` on an EventBus that a component
actually owns. Renaming the function clarifies that it is a generic, reusable
listener hook.

Also, the semantics of the hook has been changed: instead of adding an event
listener in `mounted` and removing it when `unmounted`, it now adds the event listener immediately,
and removes it when `destroyed`. The reason for that change
is that it is usually an error to wait for `mounted` before starting to listen
for changes. Also, it makes the hook useful for plugins, since plugins have a
`destroy` lifecycle event, but not `mounted/unmounted`.

### Event handler: .passive modifier

Owl 3.x adds support for a `.passive` modifier on event handlers. This sets
the `passive` option on `addEventListener`, which tells the browser that the
handler will never call `preventDefault()`. This allows the browser to optimize
scrolling and touch event performance.

```xml
<div t-on-scroll.passive="this.onScroll">...</div>
<div t-on-touchmove.passive="this.onTouchMove">...</div>
```

The `.passive` modifier can be combined with other modifiers like `.capture`:

```xml
<div t-on-scroll.passive.capture="this.onScroll">...</div>
```

Note that combining `.passive` with `.prevent` is contradictory: the browser
will ignore `preventDefault()` calls in a passive listener and log a console
warning.

The full list of supported event modifiers is: `.stop`, `.prevent`, `.self`,
`.capture`, `.synthetic`, and `.passive`.

### App and Roots

In Owl 3.x, the `App` class has no longer a main root and sub roots, it only has
sub roots. This does not change much for most uses of App (the `mount` function
is still the same), but for code that manually mounted an app, the process did
change a little bit, it is now necessary to create and mount a root.

```js
// owl 2.x
class SomeComponent extends Component { ... }

const app = new App(SomeComponent);
await app.mount(target, { props: someProps });
```

should be rewritten like this:

```js
// owl 3.x
class SomeComponent extends Component { ... }

const app = new App();
const root = app.createRoot(SomeComponent, { props: ...})
await root.mount(target);
```

Note that the `mount` helper function is not impacted.

<details><summary>Details</summary>

In Owl 2.X, an owl `App` has a main root component. We had to introduce the concept of _sub roots_ to allow different roots to
share the same settings (dev mode, translate function, compiled template cache,
...):

```js
// owl 2.x
class SomeComponent extends Component { ... }
class SubComponent extends Component { ... }

const app = new App(SomeComponent);
await app.mount(target, { props: someProps });
const subRoot = app.createRoot(SubComponent);
await subRoot.mount(otherTarget, { props: someOtherProps});
```

In Owl 3.x, we no longer have a "main" root and "sub" roots. The code is simplified
by just maintaining a set of roots. So, the API for the App class has slightly
changed accordingly.

This change is motivated by making it slightly more ergonomic to use Owl with
multiple roots. Note that in Odoo, pretty much all use cases of mounting sub
roots or apps should probably be done by using roots. It is less efficient to
have multiple apps, and could lead to difficult bugs if components/props from
one app are used in the other.

</details>

### useApp

A new hook is introduced: `useApp`, to get the current active owl App. It was
not done in Owl 2.x because there was not really a big need to get the current
`App` initially. However, since we introduced roots, it became useful to have
a proper way to get the app.

```js
class Example extends Component {
  static template = "...";

  setup() {
    const app = useApp();
    const root = app.createRoot(SomeOtherComponent);
    root.mount(targetEl);
    onWillDestroy(() => {
      root.destroy();
    });
  }
}
```

### `loadFile` is removed

The `loadFile` function was used to load a static file using `fetch`. It was
actually useful to implement the playground application, and was added to Owl,
but in practice, it is not very useful, and does not feel that it belongs to a
UI framework.

## Other ideas

We discuss here some other ideas that we explored and decided not to include in
Owl 3.

### Make it easy to output a simple reactive value

Right now, outputting a signal (or computed value) needs to go through a function call:

```xml
<div><t t-out="this.someValue()"/></div>
```

This is necessary due to the way signal works. However, we could add some code
that would "magically" check for any value in an expression, and if it is a
signal or a derived function, call it, so the following xml could work

```xml
<div><t t-out="this.someValue + this.otherValue"/></div>
```

This could be nice on a superficial level, but issues quickly arise, what if we
want to give a signal (not the value) to a subcomponent?

```xml
<SomeComponent value="this.value"/>
```

If we automatically call the signal function, then it does not do the intended
effect: the parent component is subscribed to the signal, and the child component
get the value, not the signal. So we would need a opt out mechanism. And this is
very common, so at the end, it is not clear that we have an improvement.

The current consensus seems to be that doing so is a little bit too
magic, will only save a few visible parenthesis, and may make it harder to
understand what is going on in a template. Also, it may make it harder for
static tooling to work (in this case, the type of all signals is basically
erased from the content of the template).

### Simplified way to define a prop

It is often useful to only import a single prop:

```js
class TodoItem extends Component {
  todo = props({ todo: t.instanceOf(Todo) }).todo;
}

class MyPlugin extends Plugin {
  editable = plugin.props({ editable: t.signal() }).editable;
}
```

Maybe it would be worth it to have a special simplified syntax for this usecase:

```js
class TodoItem extends Component {
  todo = prop("todo", t.instanceOf(Todo));
}

class MyPlugin extends Plugin {
  editable = plugin.prop("editable", t.signal());
}
```

It's nicer and remove the repetition, but at the cost of adding yet another
primitive function in Owl.

## Examples

This section showcases examples illustrating Owl's new features.

<details><summary>Example: a counter</summary>

Be careful when outputting a signal value: you need to call it as a function.

```js
class Counter extends Component {
  static template = xml`
      <div class="counter" t-on-click="this.increment">
        Count: <t t-out="this.count()"/>
      </div>`;

  count = signal(0);

  increment() {
    this.count.set(this.count() + 1);
  }
}
```

</details>
<details><summary>Example: a dynamic list of counters (showcase: signals, proxy, computed)</summary>

This example shows how to use a computed value in components:

```js
import { Component, signal, mount, computed, xml, types as t, proxy, props } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
      <div class="counter" t-on-click="this.increment">
        Count: <t t-out="this.props.count()"/>
      </div>`;

  props = props({ count: t.signal(t.number) });

  increment() {
    this.props.count.set(this.props.count() + 1);
  }
}

class Root extends Component {
  static components = { Counter };
  static template = xml`
      <div>
        <p>Current sum: <t t-out="this.sum()"/></p>
        <button t-on-click="this.addCounter">Add a counter</button>
      </div>
      <t t-foreach="this.counters" t-as="counter" t-key="counter_index">
        <Counter count="counter"/>
      </t>
    `;

  counters = proxy([signal(1), signal(2)]);
  sum = computed(() => this.counters.reduce((acc, value) => acc + value(), 0));

  addCounter() {
    this.counters.push(signal(0));
  }
}

mount(Root, document.body);
```

</details>

<details><summary>Complex app (html editor), with various plugins</summary>

```js
// In this example, we show how components can be defined and created.
import {
  Component,
  signal,
  mount,
  useApp,
  xml,
  Resource,
  plugin,
  Plugin,
  props,
  onWillDestroy,
  useEffect,
  useListener,
  providePlugins,
  computed,
  types as t,
} from "@odoo/owl";

// -----------------------------------------------------------------------------
// Notification system
// -----------------------------------------------------------------------------

// Example of a global plugin
class NotificationPlugin extends Plugin {
  static nextId = 1;
  notifications = signal.Array([]);

  setup() {
    const app = useApp();
    this.root = app.createRoot(NotificationManager).mount(document.body);
    onWillDestroy(() => this.root.destroy());
  }

  add(title, message) {
    const id = NotificationPlugin.nextId++;
    this.notifications().push({ id, title, message });

    setTimeout(() => {
      const notifs = this.notifications().filter((n) => n.id !== id);
      this.notifications.set(notifs);
    }, 3000);
  }

  hasNotifications = computed(() => this.notifications().length);
}

class Notification extends Component {
  static template = xml`
        <div style="width:200px;background-color:beige;border:1px solid black;margin:5px;">
            <h3><t t-out="this.props.notification.title"/></h3>
            <div><t t-out="this.props.notification.message"/></div>
        </div>`;
  props = props({
    notification: t.object({ title: t.string, message: t.string }),
  });
}

class NotificationManager extends Component {
  static components = { Notification };
  static template = xml`<div t-if="this.notification.hasNotifications()" style="position:absolute;top:0;right:0;">
        <t t-foreach="this.notification.notifications()" t-as="notif" t-key="notif.id">
            <Notification notification="notif"/>
        </t>
    </div>`;

  notification = plugin(NotificationPlugin);
}
// -----------------------------------------------------------------------------
// Editor
// -----------------------------------------------------------------------------

class ContentPlugin extends Plugin {
  el = config("el", t.signal());
}

class SelectionPlugin extends Plugin {
  selectionHandlers = new Resource();
  content = plugin(ContentPlugin);
  selection = signal(this.getSelection());

  setup() {
    useListener(document, "selectionchange", () => {
      const el = this.content.el();
      const selection = document.getSelection();
      if (!selection || !el) {
        return;
      }
      const { anchorNode, focusNode } = selection;
      if (
        anchorNode &&
        focusNode &&
        el.contains(anchorNode) &&
        (focusNode === anchorNode || el.contains(focusNode))
      ) {
        this.selection.set(this.getSelection());
      }
    });
  }

  getSelection() {
    const s = document.getSelection();
    return {
      anchorNode: s?.anchorNode,
      anchorOffset: s?.anchorOffset || 0,
      focusNode: s?.focusNode,
      focusOffset: s?.focusOffset || 0,
      isCollapsed: s?.isCollapsed,
      text: s?.toString() || "",
    };
  }
}

class TextToolsPlugin extends Plugin {
  toggleBold() {
    // yeah, i know, but it's just a demo
    document.execCommand("bold");
  }
}

class GEDPlugin extends Plugin {
  selection = plugin(SelectionPlugin).selection;
  notification = plugin(NotificationPlugin);

  setup() {
    useEffect(() => {
      const s = this.selection();
      if (s.text === "ged") {
        this.notification.add("GED", "GED");
      }
    });
  }
}

class Editor extends Component {
  static template = xml`
    <div style="border:1px solid gray;">
      <div style="border-bottom:1px solid gray;">
        <span>Toolbar</span>
        <button t-on-click="() => this.textTools.toggleBold()">Bold</button>
      </div>
      <div contenteditable="true" style="height:500px;" t-ref="this.editable">
        <h3>Editable zone</h3>
        <p> this can be edited. Try to select the word "ged"</p>
      </div>
    </div>`;

  editable = signal(null);

  setup() {
    providePlugins([ContentPlugin, SelectionPlugin, TextToolsPlugin, GEDPlugin], {
      ContentPlugin: { el: this.editable },
    });
    this.textTools = plugin(TextToolsPlugin);
  }
}

// -----------------------------------------------------------------------------
// Editor
// -----------------------------------------------------------------------------

class MyApp extends Component {
  static components = { Editor, Notification };
  static template = xml`
    <div style="margin-bottom:10px;">
        <button t-on-click="() => this.toggleEditor()">Toggle Editor</button>
        <button t-on-click="() => this.addNotification()">Add Notification</button>
    </div>
    <Editor t-if="this.isEditorVisible()"/> `;

  notifications = plugin(NotificationPlugin);
  isEditorVisible = signal(true);

  toggleEditor() {
    this.isEditorVisible.set(!this.isEditorVisible());
  }

  addNotification() {
    this.notifications.add("Coucou", "Some text");
  }
}

mount(MyApp, document.body, { plugins: [NotificationPlugin] });
```

</details>
