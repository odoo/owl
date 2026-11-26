# Owl 3 reference for coding agents

This file describes `@odoo/owl` **__VERSION__**. Read it before writing or
changing Owl code: it covers the whole public API, so you should not need to
read the Owl source. Exact signatures are in `owl.d.ts` (next to this file in
a GitHub release, `dist/types/owl.d.ts` in the npm package). Full documentation:
https://odoo.github.io/owl/documentation/

**Owl 3 is not Owl 2.** Most Owl code you have seen (training data, the web,
older Odoo versions) is Owl 2. Owl 3 removed or changed most of that API, and
several Owl 2 habits fail _silently_. Read section 1 first.

## 1. Owl 2 habits that are wrong in Owl 3

| Owl 2 (do not write) | Owl 3 (write this) | If you write the Owl 2 form |
| --- | --- | --- |
| `t-out="value"`, `t-on-click="onClick"` | `t-out="this.value"`, `t-on-click="this.onClick"` | bare names are template variables: output is silently empty, handler throws on event |
| `this.props` | `props = useProps(...)` (class field) | `this.props` is `undefined` |
| `static props = {...}`, `static defaultProps = {...}` | `props = useProps({ a: t.string(), b: t.number().optional(3) })` | silently ignored: no validation, no defaults |
| `useState(obj)` | `proxy(obj)` (deep) or `signal(value)` | not exported |
| `reactive(obj, callback)` | `proxy(obj)` + `useEffect`/`effect`, or `computed` | not exported |
| `this.env`, `useEnv`, `useSubEnv`, services | plugins: `usePlugin(P)`, `providePlugins([P])`, `mount(..., { plugins: [P] })` | not exported; `this.env` is `undefined`; the `env` app option is ignored |
| `useRef("x")` + `t-ref="x"` | `x = signal.ref()` + `t-ref="this.x"`, read with `this.x()` | `useRef` not exported |
| `t-model="state.x"` (proxy property) | `t-model="this.sig"` (a signal) or `t-model.proxy="this.state.x"` | throws "Invalid t-model expression" |
| `t-esc="expr"` | `t-out="expr"` | works, but logs a deprecation warning |
| `t-raw="expr"` | `t-out="expr"` where the value was wrapped with `markup()` in JS | throws "Unknown QWeb directive" |
| `t-slot="name"` | `t-call-slot="name"` | throws "Unknown QWeb directive" |
| `t-portal="selector"` | `<Portal target="'selector'">...</Portal>` | throws "Unknown QWeb directive" |
| `<div t-call="tpl"/>` | `<div><t t-call="tpl"/></div>` | throws |
| `<t t-call="tpl"><t t-set="a" t-value="1"/></t>` | `<t t-call="tpl" a="1"/>` | silently: the body is now lazy, `t-set` in it does not reach the called template |
| `useEffect(fn, () => [deps])` | `useEffect(fn)` | second argument ignored; dependencies are tracked automatically |
| `onWillUpdateProps(fn)` | read `this.props.x` inside `computed` / `useEffect` / `useOnChange` | still exported in this build, but do not use it in new code |
| `onWillRender`, `onRendered` | `computed` for derived values, `onMounted` / `onPatched` for DOM work | not exported |
| `this.render()` | keep state in signals/proxies; `signal.trigger(sig)` after an in-place mutation | `this.render` is `undefined` |
| `useComponent()` | make the hook return what it creates; call `useProps` / `usePlugin` inside it | not exported |
| `useExternalListener(target, "ev", fn)` | `useListener(target, "ev", fn)` | not exported |
| `new App(Root, config); app.mount(el)` | `mount(Root, el, config)` (or `createRoot`, see section 10) | the `App` constructor no longer takes a component |
| `t-ref` on a component | pass a callback or a signal as a prop | throws |
| `loadFile(url)` | `fetch(url).then((r) => r.text())` | not exported |

## 2. Mental model

- A component is a class extending `Component`, with a `static template` and
  state stored in reactive fields (`signal`, `computed`, `proxy`).
- Templates are QWeb (XML). Inside them, the component is `this`. Bare names
  are template-local variables (`t-set`, `t-foreach`, `t-call` parameters,
  slot scopes).
- Reactivity is fine-grained and global, not tied to components. A
  component re-renders when a reactive value it **read during its last
  render** changes. Plain fields (`count = 0`) are not reactive.
- Updates are batched: writes schedule work in a microtask; rendering is
  asynchronous.
- Shared state and services are **plugins** (no `env`). Provide them at the
  app level or for a subtree; consume them with `usePlugin`.
- Props are explicit: a component declares what it reads with `useProps`.
  The returned getters are reactive.
- Hooks (`use*`, `on*`, `providePlugins`) must run while the component or
  plugin is being set up: in a class field initializer or in `setup()`.
  Elsewhere they throw "No active scope".

## 3. A component

```js
import { Component, computed, signal, t, useProps, xml } from "@odoo/owl";

export class Counter extends Component {
  static template = xml`
    <div class="counter">
      <span t-out="this.props.label"/>: <t t-out="this.count()"/>
      <button t-on-click="() => this.increment()">+</button>
      <span t-if="this.isBig()">big!</span>
    </div>`;

  props = useProps({ label: t.string().optional("Count"), step: t.number().optional(1) });
  count = signal(0);
  isBig = computed(() => this.count() > 10);

  increment() {
    this.count.set(this.count() + this.props.step);
  }
}
```

- `static template`: an inline `xml` template, or the name of a template
  registered with the app (`static template = "my_module.Counter"` with
  `<t t-name="my_module.Counter">` in an XML file).
- `static components = { Child }`: every component used in the template must
  be listed, or rendering throws "Cannot find the definition of component".
- `setup()`: optional, runs after class fields are initialized; call
  `super.setup()` when overriding a parent's `setup`. Use it for hooks that
  need several statements. Do not override the constructor.

### Lifecycle hooks

| Hook | When |
| --- | --- |
| `onWillStart(fn)` | before first render; may be async (callbacks run in parallel) |
| `onMounted(fn)` | after the component is in the DOM (children before parents) |
| `onWillPatch(fn)` | before this component's DOM is patched (not on first render) |
| `onPatched(fn)` | after this component's DOM is patched (not on first render) |
| `onWillUnmount(fn)` | before removal from the DOM (parents before children) |
| `onWillDestroy(fn)` | always called on destroy, even if never mounted (children before parents) |
| `onError(fn)` | catches errors from descendants' rendering and lifecycle hooks |

`onWillStart` receives the component's scope; destructure `{ abortSignal }`
to cancel async work if the component is destroyed:

```js
setup() {
  onWillStart(async ({ abortSignal }) => {
    const res = await fetch("/api/data", { signal: abortSignal });
    this.data = await res.json(); // plain field is fine: read during first render
  });
}
```

`onPatched` / `onWillPatch` fire only when **this** component's own template
re-renders. A signal read inside a child, or inside slot content, re-renders
that child or the slot owner, not the parent. To react to a value change,
use `useEffect`, not `onPatched`.

## 4. Props

```js
props = useProps(); // all props, no validation
props = useProps(["title", "slots"]); // listed keys, all required
props = useProps({
  title: t.string(),
  count: t.number().optional(), // optional
  size: t.selection(["sm", "lg"]).optional("sm"), // optional with default
  items: t.array(t.string()).optional(() => []), // mutable default: use a factory
  onSelect: t.function([t.number()]).optional(),
  value: t.signal(t.number()), // the parent passes a signal
});
```

- Read with `this.props.title`. The getters are reactive: `computed`,
  `useEffect` and the template update when the parent passes a new value.
- Props are read-only. Assigning `this.props.x = ...` throws. Ask the parent
  to change them (callback prop, or a signal prop the child may `.set()`).
- Validation (against the schema) only runs in dev mode. Extra props not in
  the schema are allowed. With a schema, `this.props` only has the declared
  keys.
- `useProps.static("name", type?)` reads one prop once and stores the value
  directly (`todo = useProps.static("todo", t.instanceOf(Todo))`). In dev
  mode it throws if the parent later passes a different reference. Use it
  for identity-stable values (models, buses, signals).
- `useProps` may be called several times in one component.

Passing props from a parent template. Every attribute value is a JS
expression evaluated in the parent:

```xml
<Child title="'literal string'" count="this.count()" value="this.count" items="this.items"/>
<Child t-props="this.childProps"/>                  <!-- all props from an object -->
<Child onSave.bind="this.save"/>                   <!-- bound to the parent -->
<Child onDelete.alike="() => this.delete(item.id)"/> <!-- ignored when comparing props -->
<Child label.translate="Some text"/>                <!-- literal, translated string -->
<Child value.signal="this.state.count"/>            <!-- wrap a plain value in a stable signal -->
```

- `title="hello"` passes the variable `hello` (usually `undefined`), not a
  string: quote literals, `title="'hello'"`.
- Arrow-function props are compared by their captured variables, so they do
  not re-render the child needlessly. `.alike` is rarely needed.
- Passing a **signal** (`value="this.count"`) instead of its value
  (`value="this.count()"`) means only the child re-renders when it changes.
- Slots arrive as the `slots` prop. Declare it only if the component reads
  `this.props.slots`. `t-call-slot` works without it.

## 5. Reactivity

```js
import { signal, computed, proxy, effect, untrack, asyncComputed } from "@odoo/owl";

const count = signal(0); // read: count()   write: count.set(1)
count.set(count() + 1); // setting an equal value (Object.is) is a no-op
const double = computed(() => count() * 2); // lazy, cached, read-only
const celsius = signal(20);
const fahrenheit = computed(() => celsius() * 1.8 + 32, {
  set: (f) => celsius.set((f - 32) / 1.8), // writable computed
});
const state = proxy({ user: { name: "a" }, tags: [] }); // deep: state.user.name = "b" is tracked
const stop = effect(() => console.log(count())); // runs now, then after changes (batched)
stop();
```

- **Signals** hold a reference. Mutating the content in place
  (`list().push(x)`) is not detected. Use a collection signal, replace the
  value (`list.set([...list(), x])`), or call `signal.trigger(list)`.
- **Collection signals**: `signal.Array([...])`, `signal.Object({...})`,
  `signal.Set(new Set())`, `signal.Map(new Map())`. Reading returns a
  reactive proxy: `items().push(x)` and `obj().a = 1` are tracked. Tracking is
  **shallow**: `items()[0].done = true` is not. Give mutable items their own
  signals (`{ id, done: signal(false) }`) or use `proxy`.
- `signal.ref()` / `signal.ref(HTMLInputElement)`: a signal starting at
  `null`, for `t-ref`.
- Options: `signal(v, { equals: shallowEqual })` or `computed(fn, { equals })`
  customise change detection (`equals: false` always notifies).
  `signal([], { type: t.array(t.number()) })` only guides TypeScript.
- `proxy(obj)` works with objects, arrays, Map, Set. `markRaw(obj)` excludes
  an object from proxying; `toRaw(p)` returns the underlying object.
- **Effects**: `effect(fn)` returns a disposer. If `fn` returns a function,
  it runs before each re-run (cleanup). An effect created while another runs
  becomes its child and is disposed when the parent re-runs; wrap it in
  `untrack(() => effect(...))` for an independent lifetime.
  `immediateEffect(fn)` re-runs synchronously on each write.
- `untrack(fn)`: run `fn` without subscribing to what it reads.
- **In components and plugins, use `useEffect(fn)` / `useImmediateEffect(fn)`**:
  they are disposed automatically on destroy. A raw `effect()` in a component
  leaks.
- `asyncComputed(async ({ abortSignal }) => ..., { initial })`: async
  derived value. `x()` is the last resolved value, plus `x.loading()`,
  `x.error()`, `x.refresh()` and `x.currentPromise()`. Only reads made
  **before the first `await`** are tracked. Do any further derivation in a
  `computed`. Hold the first render with
  `onWillStart(() => this.x.currentPromise())`. The API is experimental.

## 6. Templates

Expressions are JavaScript expressions (not statements). `this` is the
component. XML-friendly operators: `and`, `or`, `gt`, `gte`, `lt`, `lte`.

| Directive | Use |
| --- | --- |
| `t-out="expr"` | output, HTML-escaped unless the value is a `markup(...)` string; objects are stringified |
| `t-if` / `t-elif` / `t-else=""` | conditional |
| `t-foreach="expr" t-as="x" t-key="x.id"` | loop; **`t-key` is mandatory and must be unique** (dev mode checks). Works on arrays, iterables, objects and Maps |
| `t-set="v" t-value="expr"` | local variable; with a body instead of `t-value`, stores the rendered body |
| `t-att-name="expr"`, `t-attf-name="a {{x}}"` | dynamic attribute: `false`, `null` and `undefined` omit it, `true` sets it empty, anything else (`0`, `""` included) is set; `t-att="{...}"` for several |
| `t-att-class="{ active: this.on() }"` | class object (combines with a static `class`); `t-att-style` takes an object or a string |
| `t-on-event="fn"` | event handler; see below |
| `t-model="this.sig"` | two-way binding with a signal on `input`/`textarea`/`select`/checkbox/radio; `.proxy` for proxy paths |
| `t-ref="this.refSignal"` | element reference (a `signal.ref()`, or a `Resource` to collect elements in a loop); DOM elements only |
| `t-component="this.Cls"` | dynamic component |
| `t-call="tpl" a="expr"` | render a sub-template with parameters, on `<t>` only; its body is available as `t-out="0"` |
| `t-call-slot="name"` / `t-set-slot="name"` | render / fill a slot (section 7) |
| `t-tag="expr"` | dynamic tag name |
| `t-translation="off"`, `t-translation-context="ctx"` | translation control |
| `t-log="expr"`, `t-debug=""` | debugging |

Loops expose `x_index`, `x_first`, `x_last`, and `x_value`. For objects and
Maps, `x` is the key and `x_value` is the value. Each iteration has its own
scope.

**Events.** The value must evaluate to a function: a method reference
(`this.onClick`, called with the event, `this` bound to the component) or an
arrow function (`() => this.add(item.id)`, `(ev) => this.onKey(ev)`). A
non-function expression such as `t-on-click="this.count.set(1)"` runs once
per event and then throws "Invalid handler expression". Modifiers: `.stop`,
`.prevent`, `.self`, `.capture`, `.passive`, `.synthetic` (one delegated
listener, for large lists), combinable (`t-on-click.stop.prevent`).
`t-on-*` on a component listens on that component's DOM.

**Forms.** `t-model` modifiers: `.lazy` (update on `change`), `.number`,
`.trim` (implies `.lazy`), `.proxy` (bind a proxy property path:
`t-model.proxy="this.state.text"`).

**HTML.** `markup("<b>trusted</b>")` marks a string as safe for `t-out`.
`` markup`<b>${userInput}</b>` `` escapes the interpolations. `htmlEscape(v)`
escapes.

**Silent failures to avoid.** Owl does not warn about any of these:

- forgetting `this.`: the name resolves to an undefined local variable.
- forgetting `()` on a signal or computed: `t-out="this.count"` prints the
  function's source, and `t-if="this.isOpen"` is always true.

Any `t-*` attribute that is not a directive supported on its node throws
when the template is compiled.

Whitespace: runs of whitespace collapse to one space, and whitespace-only
text containing a newline is dropped (except inside `<pre>`). Templates may
have several root nodes. Tags and attributes starting with `block-` are
reserved.

## 7. Slots

```xml
<!-- Dialog template -->
<div class="dialog">
  <header><t t-call-slot="title">Default title</t></header>
  <t t-call-slot="default" close="() => this.close()"/>  <!-- values for the slot scope -->
</div>

<!-- user -->
<Dialog>
  <t t-set-slot="title">Hello</t>
  <p t-on-click="this.parentMethod">Body, rendered in the parent's context</p>
</Dialog>
<Dialog t-slot-scope="scope"><button t-on-click="scope.close">x</button></Dialog>
<Dialog><t t-set-slot="footer" t-slot-scope="s">...</t></Dialog>
```

- Slot content is evaluated in the context where it is written: `this` is
  the parent.
- Content outside a `t-set-slot` goes into the `default` slot.
- `t-set-slot` is only allowed on `<t>`. Extra attributes on it are slot
  params, readable by the child in `this.props.slots[name]` (requires
  `useProps([..., "slots"])`).
- `t-call-slot="{{expr}}"` selects the slot dynamically. Forward slots to a
  child with `slots="this.props.slots"`.

## 8. Plugins (shared state and services)

```js
import { Plugin, computed, mount, onWillDestroy, onWillStart, signal, t, useConfig, usePlugin } from "@odoo/owl";

class ApiPlugin extends Plugin {
  baseUrl = useConfig("apiBaseUrl", t.string());
  timeout = useConfig("apiTimeout", t.number().optional(5000));

  async get(path) {
    return (await fetch(this.baseUrl + path)).json();
  }
}

class SessionPlugin extends Plugin {
  static sequence = 10; // started before default (50) plugins
  api = usePlugin(ApiPlugin); // dependency: auto-started
  user = signal(null);
  isAdmin = computed(() => this.user()?.admin ?? false);

  setup() {
    onWillStart(async () => this.user.set(await this.api.get("/session"))); // delays mount
    const id = setInterval(() => this.ping(), 60_000);
    onWillDestroy(() => clearInterval(id));
  }
  ping() {}
}

// app level
await mount(Root, document.body, {
  plugins: [ApiPlugin, SessionPlugin],
  config: { apiBaseUrl: "/api" },
});

// in any component (class field or setup)
session = usePlugin(SessionPlugin); // template: this.session.user()?.name
```

- `providePlugins([P1, P2], config?)` in a component's `setup()` provides
  plugins to that component and its descendants. They are destroyed with
  it. A provided plugin with the same `static id` (defaults to the class
  name) shadows the ancestor's one for the subtree.
- `usePlugin(P)` throws `Unknown plugin "P"` if no ancestor provides it.
- Hooks allowed in plugins: `usePlugin`, `useConfig`, `onWillStart`,
  `onWillDestroy`, `useEffect`, `useImmediateEffect`, `useOnChange`,
  `useListener`, `useScope`. There is no mounted/patched lifecycle.
- `static scoped(plugin, scope)` can return a per-consumer view, for example
  to wrap async methods with `scope.run` so that calls reject with
  `AbortError` when the calling component is destroyed.
- A `Resource` field lets components contribute items:
  `this.plugin.items.use(item)` (removed automatically on destroy).

## 9. Other hooks and utilities

| API | Notes |
| --- | --- |
| `useEffect(fn)`, `useImmediateEffect(fn)` | effect disposed on destroy; `fn` runs immediately and may return a cleanup |
| `useOnChange(() => [deps], (...deps) => cleanup?, { initialRun? })` | runs the callback when the dependency array changes (compared element by element); reads in the callback are not tracked |
| `useListener(target, "event", handler, options?)` | `target` is an `EventTarget` or a ref signal; added now, removed on destroy. The handler is **not bound**: use an arrow function |
| `useApp()` | current `App` |
| `useScope()` / `getScope()` | current `Scope` (`getScope` returns `null` outside setup). `scope.abortSignal`, `scope.run(fn, ...args)` (re-enter the scope later; guards promises), `scope.onDestroy(cb)`, `scope.isDestroyed()` |
| `new EventBus()` | `EventTarget` with `bus.trigger("name", detail)` (listeners receive a `CustomEvent`, payload in `ev.detail`) |
| `new Registry({ name?, validation? })` | ordered reactive key/value map: `add(key, value, { sequence, force })`, `use(...)` (scoped), `get(key, default?)`, `items()`, `entries()` |
| `new Resource({ name?, validation? })` | ordered reactive list: `add(item, { sequence })`, `use(item)` (scoped), `delete`, `has`, `items()` |
| `types` / `t` | validators: `any boolean number string array object strictObject record set map tuple function promise literal selection instanceOf constructor component signal ref or and customValidator`, plus `.optional(default?)` |
| `validateType(v, type)` / `assertType(v, type, msg?)` | standalone validation (returns issues / throws `OwlError`); `applyDefaults(v, type)` fills nested defaults; `typeof schema.type` gives the TS type |
| `batched(fn)` | coalesce calls into one per microtask |
| `shallowEqual(a, b)` | one-level comparison, for `equals` options |
| `whenReady(fn?)` | promise resolved when the DOM is ready |
| `OwlError` | class of errors raised by Owl itself |

**Built-in components** (register them in `static components`):

- `<Suspense>`: shows its `fallback` slot while descendants' `onWillStart`
  is pending.
- `<ErrorBoundary error="this.errorSignal">`: shows its `fallback` slot when
  a descendant throws while rendering or in a lifecycle hook. Setting the
  signal back to `null` retries.
- `<Portal target="this.refSignal | element | 'css selector'" position="n">`:
  renders its slot into another DOM element. Plugins, reactivity and errors
  still follow the source tree. DOM events bubble through the target.

**Errors.** An error that no `onError` handler catches destroys the whole
app. `onError` handlers can rethrow to delegate to an outer handler. Errors
thrown in **event handlers** are not caught by `onError` or `ErrorBoundary`:
handle them in the handler.

## 10. Mounting an app

```js
import { mount, App } from "@odoo/owl";

const component = await mount(Root, document.body, {
  dev: true, // props validation, t-key checks, better errors
  templates, // XML string/document, or { name: precompiled fn }
  plugins: [SessionPlugin],
  config: { apiBaseUrl: "/api" },
  props: { mode: "full" },
  translateFn: (text, ctx) => text,
});

// several roots sharing templates/plugins:
const app = new App({ dev: true, templates, plugins: [SessionPlugin] });
await app.pluginManager.ready; // mount() does it: plugins with an async onWillStart must be started
const r = app.createRoot(Widget, { props: { id: 1 } });
await r.mount(target); // r.prepare() renders off-DOM first; r.destroy() is your job
```

Other `App` options: `getTemplate`, `translatableAttributes`,
`customDirectives`, `globalValues`, `name`, `test`.

## 11. Complete example

```js
import { Component, Plugin, computed, mount, onMounted, signal, t, useProps, usePlugin, xml } from "@odoo/owl";

class TodoStore extends Plugin {
  nextId = 1;
  todos = signal.Array([]); // shallow, so each item keeps its own signal for `done`
  remaining = computed(() => this.todos().filter((todo) => !todo.done()).length);

  add(text) {
    this.todos().push({ id: this.nextId++, text, done: signal(false) });
  }
  remove(todo) {
    const list = this.todos();
    const index = list.indexOf(todo);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }
}

class TodoItem extends Component {
  static template = xml`
    <li t-att-class="{ done: this.props.todo.done() }">
      <input type="checkbox" t-model="this.props.todo.done"/>
      <t t-out="this.props.todo.text"/>
      <button t-on-click="() => this.store.remove(this.props.todo)">x</button>
    </li>`;

  props = useProps({
    todo: t.object({ id: t.number(), text: t.string(), done: t.signal(t.boolean()) }),
  });
  store = usePlugin(TodoStore);
}

class TodoApp extends Component {
  static components = { TodoItem };
  static template = xml`
    <div class="todo-app">
      <input t-ref="this.input" t-model="this.draft" t-on-keydown="this.onKeydown"/>
      <ul>
        <t t-foreach="this.store.todos()" t-as="todo" t-key="todo.id">
          <TodoItem todo="todo"/>
        </t>
      </ul>
      <p t-if="this.store.remaining()"><t t-out="this.store.remaining()"/> left</p>
    </div>`;

  store = usePlugin(TodoStore);
  draft = signal("");
  input = signal.ref(HTMLInputElement);

  setup() {
    onMounted(() => this.input()?.focus());
  }

  onKeydown(ev) {
    const text = this.draft().trim();
    if (ev.key === "Enter" && text) {
      this.store.add(text);
      this.draft.set("");
    }
  }
}

mount(TodoApp, document.body, { plugins: [TodoStore], dev: true });
```
