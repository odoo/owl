# 🦉🦉 Migration 🦉🦉🦉 Guide (DRAFT)

> **Note:** This migration guide is primarily focused on migrating the Odoo codebase from Owl 2 to Owl 3, but it may still be helpful for other projects using Owl.

## Overview

Since Owl 3 is a significant change from Owl 2, it will require a good amount
of work to update Odoo (and other) codebases. This document is intended as a
guide and set of resources to help everyone as much as possible.

This is a work in progress!!!

## Table of Contents

- [List of breaking changes](#list-of-breaking-changes)
- [Migration guide for each change](#migration-guide-for-each-change)
- [Migration plan for Odoo codebase](#migration-plan-for-odoo-codebase)
    - [Phase 1: preparation](#phase-1-preparation)
    - [Phase 2: cleanup](#phase-2-cleanup)
- [Compatibility layer](#compatibility-layer)
- [List of migration scripts](#list-of-migration-scripts)


## List of breaking changes

Additional info is the result of grepping in odoo code base (community/enterprise)

| #  | Change | Additional info | Note |
|----|--------|-----------------|------|
| 1  | `useState` removed | | [Note](#1-usestate-removed) |
| 2  | `reactive` removed | 240 calls | [Note](#2-reactive-removed) |
| 3  | `useEffect` semantics changed | 596 calls | [Note](#3-useeffect-semantic-change) |
| 4  | `this.props` removed | | [Note](#4-thisprops-removed) |
| 5  | static `props` / `defaultprops` ignored (use the props function) | 281 default props | [Note](#5-static-props-defaultprops-ignored) |
| 6  | `this.env` removed | 161 `useSubEnv` | [Note](#6-thisenv-removed) |
| 7  | rendering context changes (reading from component through `this`) | | [Note](#7-rendering-context-changes) |
| 8  | `onWillUpdateProps` removed | 183 calls | [Note](#8-onwillupdateprops-removed) |
| 9  | `t-esc` removed | | [Note](#9-t-esc-removed) |
|10  | `t-ref` changes: takes a signal (or resource) | 1022 calls | [Note](#10-t-ref-changes-takes-a-signal-or-resource) |
|11  | `t-model` changes: takes a signal | 197 calls | [Note](#11-t-model-changes-takes-a-signal) |
|12  | `onWillRender` removed | 70 calls | [Note](#12-onwillrender-removed) |
|13  | `onRendered` removed | 20 calls | [Note](#13-onrendered-removed) |
|14  | `this.render` removed | 130 calls | [Note](#14-thisrender-removed) |
|15  | `t-portal` removed | 18 calls | [Note](#15-t-portal-removed) |
|16  | `useExternalListener` renamed to `useListener` (and changed) | 210 calls | [Note](#16-useexternallistener-renamed-to-uselistener-and-changed) |
|17  | `App` has only sub roots | 20 new `App` calls | [Note](#17-app-has-only-sub-roots) |
|18  | `loadFile` removed | | [Note](#18-loadfile-removed) |
|19  | `t-call` not allowed on tags `!== t` | | [Note](#19-t-call-not-allowed-on-tags-t) |
|20  | `t-call` body evaluated lazily, variables passed as parameters | | [Note](#20-t-call-body-evaluated-lazily-variables-passed-as-parameters) |
|21  | `useComponent` removed | 93 calls | [Note](#21-usecomponent-removed) |

## Migration guide for each change

In this section, you will find a more detailed explanation on how owl 2 code
can be converted for each individual breaking change listed above.

### 1. `useState` removed

This one is pretty easy: replace all uses of `useState` by `proxy` (in import
statements and in code). This works, even though the underlying code of proxy
uses signals. 

For example
```js
// owl 2
import { useState } from "@odoo/owl";

...

this.state = useState({ someValue: 1 });

// owl 3
import { proxy } from "@odoo/owl";

...

this.state = proxy({ someValue: 1 });
```

There may still be some change in behaviour, as some components will not need to be
rendered in owl 3, since the reactivity system will be able to avoid subscribing
to state updates in some cases (for example, in event listeners). 

### 2. `reactive` removed

Almost like `useState`. Basically all uses of `reactive` with one argument can
be replaced by `proxy`.

```js
// simple use
// owl 2
this.thing = reactive({...});
// owl 3
this.thing = proxy({ ... });
```

If a `reactive` function call uses a second argument, it is typically followed
by some code that reads a value, so the reactive proxy is subscribed, and the
second argument function will be called whenever the value has changed. This
kind of code can be converted into a `proxy` call, and a `useEffect` or `effect`
(depending if we are in a component/plugin, or in some kind of global situation).

In Owl 2.x, this looks like this:

```js
this.state = reactive({...}, () => {
    // do something with this.state
    ...
    // subscribe again
    JSON.stringify(this.state);
});
JSON.stringify(this.state); // subscribe to all content
```

In Owl 3.x, this can be converted to code like this:

```js
this.state = proxy({...});
useEffect(() => {
    // do something with this.state
    // be careful: unlike in owl 2, this function is always called immediately
    ...
    // no need to subscribe again
});
// no need to subscribe
```

But sometimes, the `reactive` second argument is used to compute a second piece
of derived reactive state. In that case, there is an even better solution: we
can simply use a computed function.

```js
// owl 2
this.derivedState = reactive({ double: 2 });
this.state = reactive({ count: 1}, () => {
    this.derivedState.double = 2*this.state.count;
    this.state.count; // subscribe
});
this.state.count; // subscribe

// owl 3
this.state = proxy({ count: 1 }); // could be a signal also
this.double = computed(() => 2*this.state.count);
```


### 3. `useEffect` semantic change

The previous `useEffect` function from Owl has been simplified: it does not take
a second argument, all dependencies are automatically tracked using the standard reactivity
system. 

So most current uses of `useEffect` in owl 2 can simply be simplified by removing
the dependency array:

```js
// owl 2
useEffect(() => {
    // some code
}, () => [..., ...]);

// owl 3
useEffect(() => {
    // some code
});
```

However, in many cases, the `useEffect` function is used to recompute some kind
of derived state. In that case, it is more efficient to simply use a `computed`
value, if possible:


```js
// owl 2
this.state = { double: 0 };
useEffect(() => {
    this.state.double = 2*this.props.somevalue;
});

// owl 3
// only works if we read values from signals and/or proxies
this.double = computed(() => 2* this.props.somevalue());
```

The previous [implementation](https://github.com/odoo/owl/blob/54129a5f8dfc1ce16c62ee2f216058c043043a6e/src/runtime/hooks.ts#L85)
only depends on `onMounted`, `onPatched` and `onWillUnmount`, which still exists
in owl 3. So, if there is some subtle reason for which the new `useEffect` does
not work, one can fall back to the previous implementation by inlining it.

### 4. `this.props` removed

In Owl 2, each component has a built-in `this.props`, which contains everything
given to it by the parent component. In Owl 3, this is no longer the case. Instead,
a component has to explicitly "import" the props that it needs by calling the
`props` function.

```js
// owl 2
class MyComponent extends Component {
  static template = "...";

  setup() {
    // here, this.props is defined
  }
}

// in owl 3:
import { props, Component, ... } from "@odoo/owl";

class MyComponent extends Component {
  static template = "...";

  props = props();
  setup() {
    // here, this.props is defined, thanks to the props call
  }
}
```

Note that this does not perform any validation at all (see next point). 

### 5. static `props` / `defaultprops` ignored

Most components in owl 2 define a static `props` object, that contains a description
of the type of the expected props. Some component also have a static `defaultProps`.

Both of them can be added to the `props` object: the type description as the first
argument, and the default values as the second argument. Here is what it looks
like:

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
    leaveDuration: 100
  }
}

// owl 3.x
class SomeComponent extends Component {
  static template = "...";

  props = props({
      name: t.string,
      "visible?": t.boolean,
      "immediate?": t.boolean,
      "leaveDuration?": t.number,
      "onLeave?": t.function(),
      // no need to grab the slot prop here
  }, {
    leaveDuration: 100
  });
}
```

Note that now, if you use a schema as the first argument, the `props` function
will only return an object that contains the subset of keys that are defined.
You can ignore props that you do not use, such as `slots`. 


### 6. `this.env` removed

This one is a big change. The idea is that we can replace all uses of the `env`
object with a set of plugins. A good conversion is not just mechanical, it
requires to rethink the need and define one or more plugins.

As a first step, it is good to know that we can readd the `env` using the plugin
system (see later in this document for some compatibility code), so this allows
this migration to be done incrementally.

There are multiple ideas that are impacted by this change:
- all current services will need to be replaced by corresponding (global) plugins
- all `useService` call will need to be replaced by an import of the corresponding plugin
- all `useSubEnv` should be replaced by `providePlugins(...)`,
- all `useEnv` should be replaced by `plugin(SomePlugin)`
- all components that read something from the `env` should do something like this: 
  `this.thing = plugin(ThingPlugin)`


```js
// owl 2
// in some component A setup:
setup() {
  const someState = ...;
  useSubEnv({dashboardState: someState})
}

// in some child component:
setup() {
  const someState = this.env.dashboardState;
}


// in owl 3, we will probably write a plugin
class DashboardPlugin extends Plugin {
  state = ...
  // and maybe some other helpers, computed functions, whatever
}

// in component A
setup() {
  providePlugins([DashboardPlugin])
}

// in child component
setup() {
  const dashboard = plugin(DashboardPlugin);
  // here, we can read dashboard.state, or whatever
}
```

### 7. Rendering context changes

This change is also a large breaking change, but in theory, it can be mostly
automated. We are going to provide migration scripts to do as much as possible 
of the work.

The main deal is to properly identify every variable that needs to be prefixed
by "this.". The challenge for writing such a script is that some variables can 
come from a `t-call`, so they are not visible in the template that we are 
converting. But for most of Owl codebase, there are not so many `t-call`, so I
expect that such a change will not be too difficult.

Manually, it is quite easy:

```xml
<!-- owl 2 -->
<t t-set="v" t-value="computeSomething()"/>
<div t-on-click="onClick"><t t-out="v"></div>

<!-- owl 3 -->
<t t-set="v" t-value="this.computeSomething()"/>
<div t-on-click="this.onClick"><t t-out="v"></div>
```

The good thing is that the owl 3 syntax is compatible with owl 2, so it is 
possible to do it before switching to owl 3.


### 8. `onWillUpdateProps` removed

In theory, `onWillUpdateProps` was used to provide a way for a component to
react to a change in its props. In practice, it often mean that we actually
want to define some computed state. This is the best case scenario. For example:

```js
// owl 2
class C extends Component {
  static template = "...";
  
  setup() {
    this.state = useState({ 
      isLarge: this.props.counter > 10,
    });
    onWillUpdateProps((nextProps) => {
      this.state.isLarge = nextProps.counter > 10;
    });
  }
}

// owl 3
class C extends Component {
  static template = "...";
  
  props = props({ counter: t.signal(t.number) });
  isLarge = computed(() => this.props.counter() > 10);
}
```

Note that the prop `counter` had to be changed to a signal! This is actually
quite important, so the computed value properly subscribe to the signal value.

Sometimes, we only want to react "once", for example, to reset a value. In that
case, a `useEffect` is more appropriate


```js
// owl 2
class C extends Component {
  static template = "...";
  
  setup() {
    this.state = useState({ someText: "" });
    onWillUpdateProps((nextProps) => {
      if (this.props.resId !== nextProps.resId) {
        this.state.someText = "";
      }
    });
  }
}

// owl 3
class C extends Component {
  static template = "...";
  
  props = props({ resId: t.signal(t.number) });
  someText = signal("");

  setup() {
    useEffect(() => {
      this.props.resId(); // subscribe to changes
      this.someText.set("");
    });
  }
}
```

Now, another common situation is when we are using the `onWillUpdateProps` hook
to asynchronously load some value depending on the props. In that case, there is
no really good way to solve the issue other than with a `useEffect`. 

```js
// owl 3
class C extends Component {
  static template = "...";
  
  props = props({ resId: t.signal(t.number) });

  setup() {
    useEffect(async () => {
      this.state = await this.loadRecord(this.props.resId()); 
    });
  }
}
```

Note that the code above is not concurrency safe, also, it is critical that
we read the observed values immediately in the effect function. To solve these
issue properly, we will provide a `asyncComputed` helper in Odoo:

```js
// owl 3
class C extends Component {
  static template = "...";
  
  props = props({ resId: t.signal(t.number) });
  state = asyncComputed(() => this.loadRecord(this.props.resId()));
}
```

### 9. `t-esc` removed

This change is mostly a search and replace operation:

```xml
<!-- owl 2 -->
<div t-esc="this.value"/>

<!-- owl 3 -->
<div t-out="this.value"/>
```

It is in theory possible to have a markup string that we actually want to escape,
but if that is really the case, then we can manually "unmarkup" it:

```xml
<div t-out="new String(this.value)"/>
```

Another more annoying issue is that in owl 2, the `t-esc` directive would 
call `.toString` if it receives an object. However, the owl 2 `t-out` directive will
crash if given an object. So, if we want to prepare a migration ahead of time
by changing all `t-esc` to `t-out`, then we need to handle these cases more
carefully.

```xml
<!-- owl 2, with a value which may be an object -->
<t t-esc="someValue"/>
<!-- owl 2, with a t-out -->
<t t-out="window.String(this.someValue)"/>
<!-- owl 3, we can cleanup the template if we want -->
<t t-out="this.someValue"/>
```

Note that owl 3 will properly handle object values, so we only need to cast the
object to a string for the duration when we run the code with owl 2.x.


### 10. `t-ref` changes: takes a signal (or resource)

The migration process here requires some thought to take advantage of the new
system. However, a typical migration will be usually quite simple:

- replace the `useRef` call by a new signal
- update the `t-ref` directive in the template to point to the signal
- update the code that was using the ref to the signal syntax (so, function call
  to read the value)

```js
// owl 2
class C extends Component {
  static template = xml`<div t-ref="somename">...</div>`;

  setup() {
    this.ref = useRef("somename");
    onMounted(() => {
      console.log(this.ref.el);
    });
  }
}

// owl 3
class C extends Component {
  static template = xml`<div t-ref="this.div">...</div>`;

  setup() {
    this.div = signal(null);
    onMounted(() => {
      console.log(this.div());
    });
  }
}
```

### 11. `t-model` changes: takes a signal

This is similar to the `t-ref` change.


```js
// owl 2
class C extends Component {
  static template = xml`<input t-model="state.value"/>`;

  setup() {
    this.state = useState({ value: "coucou" });
  }
}

// owl 3
class C extends Component {
  static template = xml`<input t-model="this.input"/>`;

  input = signal("coucou");
}
```
But it requires changing the `t-model` expression to evaluate to a signal (a
proxy will not work). So, all code that is using the value should be slightly 
adapted accordingly.

### 12. `onWillRender` removed

A common use case for `onWillRender` is to precompute expensive value. In that
case, the best migration is to convert the expression to a computed value.

```js
// owl 2
class C extends Component {
  static template = xml`<t t-out="state.value"/>`;

  setup() {
    this.state = useState({ value: 0});
    onWillRender(() => {
      this.state.value = this.expensiveComputation();
    });
  }
}

// owl 3
class C extends Component {
  static template = xml`<t t-out="this.value()"/>`;

  value = computed(() => this.expensiveComputation());
}
```
But to make it work, it should only depends on reactive values (signals/computed
or proxies).

Sometimes, `onWillRender` is used to create some other side effects in the system.
It is usually incorrect, since the fact that a component is rendered is not a
good invariant. In that case, it is probably better to create the side effect
in a mounted hook.

```js
// owl 2
class C extends Component {
  setup() {
    onWillRender(() => {
      this.showNotification();
    });
  }
}

// owl 3
class C extends Component {
  setup() {
    onMounted(() => {
      this.showNotification();
    });
  }
}
```

### 13. `onRendered` removed

Usually, `onRendered` is used (incorrectly) to reset some state or do some
control flow operation. Usually, the correct way to do it is to use `onMounted`
or `onPatched` instead.

```js
// owl 2
// Will render noContentView only at the first loading
onRendered(() => {
    this.loadHelper = false;
});

// owl 3
onMounted(() => {
    this.loadHelper = false;
});
```
Note that in this case, maybe using some smarter code, like a computed or an
effect, is enough to make sure that we do not load twice the loadHelper, so
maybe the `onMounted` call can even be removed.


### 14. `this.render` removed

In Owl, the normal way of updating the UI is through a correct use of the reactivity
system, where each state change is intercepted by Owl and will result in an
update of all corresponding components.  However, as a safety measure, we added
a `render` method on components, to make sure that each component can be forced
to update, even without using the reactivity system.

Now, in owl 3, the new signal-based reactivity system feels much more powerful,
and we hope that it is enough for all use cases. So, the normal migration process
for this breaking change is to simply use signals/reactive values.

```js
// owl 2
class C extends Component {
  static template = xml`<t t-out="value"/>`;

  value = 1;

  someMethod() {
    this.value++;
    this.render();
  }
}

// owl 3
class C extends Component {
  static template = xml`<t t-out="this.value()"/>`;

  value = signal(1);

  someMethod() {
    this.value.set(this.value()+1);
  }
}
```

### 15. `t-portal` removed

### 16. `useExternalListener` renamed to `useListener` (and changed)

todo 

### 17. `App` has only sub roots

todo 

### 18. `loadFile` removed

The function has been simply removed. There are no use of that function in Odoo,
but if you are using it, you can simply inline its definition, or define it
in some util file in your project.

```js
export async function loadFile(url){
  const result = await fetch(url);
  if (!result.ok) {
    throw new OwlError("Error while fetching xml templates");
  }
  return await result.text();
}
```

### 19. `t-call` not allowed on tags !== t

todo 

### 20. `t-call` body evaluated lazily, variables passed as parameters

todo 

### 21. `useComponent` removed

The `useComponent` was only useful in the context of a hook that wanted to 
get some value from the component or act on the component (usually a bad idea)

- reading the env
- reading the props
- writing some value on the component

The first usecase is replaced by importing directly the corresponding plugin (if
it makes sense).

The second use case can make a good use of the new `props` function:

```js
// owl 2
const c = useComponent();
// do something with c.props

// owl 3
const props = props({ value: t.string});
// do something with props

```

And the last usecase should probably be done in a different way. For example,
instead of writing a value on the component, we can return an object that
contains the desired value. This is way more composable, and interact better with
the reactivity system. For example, if we
want to have the mouse coordinates on the component:

```js
// owl 2
function useMouse() {
  const comp = useComponent();
  useExternalListener(window, "mousemove", ev => {
    comp.mouseX = ev.mouseX;
    comp.mouseY = ev.mouseY;
  });
}

// owl 3
function useMouse() {
  const mouseX = signal(0);
  const mouseY = signal(0);
  useListener(window, ev => {
    mouseX.set(ev.mouseX);
    mouseY.set(ev.mouseY);
  });
  return { mouseX, mouseY };
}
```

## Migration Plan for Odoo codebase


Roughly two main phases: a preparation phase, then we merge owl 3 in master,
then a cleanup phase.

```
[Phase 1A, Phase 1B] => merge owl3 in master => Phase 2 
```

- Phase 1: preparation
    - Phase 1A: prepare master by adding `owl2_with_some_owl3` build, and replacing/rewriting unpatchable code
    - Phase 1B: create dev branch, add `owl_3_with_some_of_owl2`, compatibility layer
    - goal is to be able to merge quickly owl 3 in master, without disrupting too much the ongoing work in odoo
- Phase 2: cleanup
    - progressively remove owl2 specific code and uses of compatibility layer
    - replace `owl_3_with_some_of_owl2` by `owl_3`, celebrate

Branches:
- main dev branch on odoo community: https://github.com/odoo-dev/odoo/tree/master-owl3-migration

The main strategy is:
- work on `master-owl3-migration` branch (it already exists)
- add owl3 in the dev branch
- add a compatibility layer in `addons/web/static/lib/owl/odoo_module.js`
- make owl3 as much compatible as possible to owl2 code
- at the same time, prepare master to remove all non-patchable parts of owl2
  - add a `web/static/src/owl2/utils.js` file to put some owl2 code until cleanup is done
- we want to have a small master-owl3-migration branch
- as soon as we have a green set of branches => merge, go to phase 2, remove
  all uses of the compatibility layer progressively

Deadline:
phase 1 starting feb 16 (after saas19.2 fork) until we merge in master just
  after 19.3 fork (so, somewhere around april 20th)

## Phase 1: preparation


Here is a detailed list of tasks:

| Change | Master | Master-owl3-migration |
|--------|--------|----------------------|
| `useState` removed | | `owl.useState = owl.proxy` |
| `reactive` removed | | `owl.reactive = owl.proxy` or `(val, fn) => { if(fn) throw Error; else return proxy(val) }`. If error occurs, convert code to use `useEffect` from Odoo |
| `useEffect` | copy Owl2 `useEffect` code to `useLayoutEffect` in `@web/owl2/utils`; remap all imports and uses to `useLayoutEffect` | |
| `this.props` removed | | import props function, add `props = props();` in each component with script. If possible, get static props and default props as well |
| `this.env` removed | | monkey patch env, useEnv, useSubEnv, useChildSubEnv using EnvPlugin |
| Rendering context changes | use scripts to add `this.` to all free variables in components/templates | |
| `onWillUpdateProps` removed | remove some uses of `onWillUpdateProps` | remove all uses of `onWillUpdateProps`  |
| `t-esc` removed | replace all `t-esc` with `t-out` using scripts | |
| `t-ref` changed | rename all `t-ref` → `t-custom-ref` with scripts; add custom directive to remap `t-custom-ref` → `t-ref` | implement `t-custom-ref` in an Owl2-compatible way |
| `t-model` changed | rename all `t-model` → `t-custom-model`; add directive to remap `t-custom-model` → `t-model` | implement `t-custom-model` in a owl 2 compatible way |
| `onWillRender` removed | remove some uses of onWillRender | remove all uses of onWillRender manually | 
| `onRendered` removed | remove some uses of onRendered | remove all uses of onRendered manually | |
| `this.render` removed | export a `render` function in `owl2/utils` and update all uses to import this function | |
| `useExternalListener` renamed | implement `owl.useExternalListener` in owl2/utils; adapt all code to use it instead of `useListener` | |
| `t-portal` removed | | remove all `t-portal` usage manually. Or/and keep support for `t-portal` in owl 3, temporarily |
| `t-call` restrictions | prevent `t-call` on tags `!== t` using scripts | |
| `App` sub roots | | adapt all instantiations of new `App` roots according to Owl3 |




## Phase 2: cleanup

- useState: replace all imports/uses of useState by proxy
- reactive: replace all imports/uses of reactive by proxy
- useEffect: go through all uses of useLayoutEffect and replace them, if possible
  by useEffect from owl 3
- this.props removed: add a linter to make sure we don't add static props/defaultprops back
- this.env removed: go through all uses of env and rewrite them using plugins
- rework all uses of t-custom-ref to remove them
- this.render removed: remove all imports of the render function from owl2/utils
- t-ref: go through all uses of `t-custom-ref`, and rewrite code to use a signal
- t-model: go through all uses of `t-custom-model`, and rewrite code to use a signal
- check all uses of useExternalListener in owl2/utils => replace them by useListener in owl3
- remove all uses of t-portal (manual work)

## Compatibility Layer


```js
// useState
owl.useState = proxy;

// reactive
owl.reactive = function(value, cb) { 
    if (cb) { 
        // deprecation warning => probably require manual code update
        console.warn("reactive is deprecated");
        useEffect(cb());  
    }
    return proxy(value);
}

class EnvPlugin extends Plugin {
  env = {};
}

const useEnv = () => plugin(EnvPlugin).env;
owl.useEnv = useEnv;

owl.useSubEnv = function (extension) {
  const env = useEnv();
  const subEnv = Object.assign(Object.create(env), extension);
  class SubEnvPlugin extends Plugin {
    static id = "EnvPlugin";
    env = subEnv;
  }
  providePlugins([SubEnvPlugin]);
}

owl.onWillRender = (cb) => {
    // find a way to make it work
}

owl.onRendered = (cb) => {
    // find a way to make it work
}

owl.useComponent = () => {
    ...
}
owl.useExternalListener = ... // duplicate current code from owl


owl.Component.ComponentNode.beforeSetup = function() {
    if (!this.component.props) {
        // only patch it if component does not define it before
        this.component.props = props();
    }
    if (!this.component.env) {
        this.component.env = useEnv();
    }
}


```

## List of migration Scripts

Phase 1
- replace all `t-ref` with `t-custom-ref` 
- add `this.` before all free variables in owl templates
- rename t-esc => t-out (simple)
- replace useState => proxy in all js code
- replace reactive => proxy (except if second argument) 
- add `props = props()` or `props = props(type, defaultprops)` in all components

Phase 2

?