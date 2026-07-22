# Plugins

## Overview

Plugins are self-contained units of shared state and logic. They replace Owl 2's
`env` and services with a more type-safe and composable approach.

A plugin can hold reactive state (signals, computed values), perform side effects,
depend on other plugins, and be shared across a component subtree or the entire
application. Plugins have a simple lifecycle: `setup` then `destroy`.

```js
class Clock extends Plugin {
  value = signal(0);

  setup() {
    const interval = setInterval(() => {
      this.value.set(this.value() + 1);
    }, 1000);
    onWillDestroy(() => clearInterval(interval));
  }
}
```

## Defining a Plugin

A plugin is a class that extends `Plugin`. It can define reactive state as
class fields and use `setup()` for initialization:

```js
class NotificationManager extends Plugin {
  notifications = signal.Array([]);

  add(message) {
    this.notifications().push({ id: Date.now(), message });
  }

  dismiss(id) {
    const list = this.notifications();
    const index = list.findIndex((n) => n.id === id);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }
}
```

Each plugin class has a `static id` property used as a unique identifier.
It defaults to the class name, but can be set explicitly:

```js
class MyPlugin extends Plugin {
  static id = "my-custom-id";
}
```

## Using a Plugin

The `usePlugin()` function imports a plugin instance. It can be used in component
class fields or in the `setup()` method:

```js
class App extends Component {
  static template = xml`
    <div>
      <t t-foreach="this.notifications.notifications()" t-as="n" t-key="n.id">
        <div t-out="n.message" t-on-click="() => this.notifications.dismiss(n.id)"/>
      </t>
    </div>`;

  notifications = usePlugin(NotificationManager);
}
```

The return value is the plugin instance with full type information (minus the
`setup` method). Any reactive values on the plugin (signals, computed) are
tracked automatically when read during a component render.

> `usePlugin` was previously named `plugin`; `plugin` remains available as a deprecated alias.

### Scoped plugin views

A plugin is a single shared instance, but each consumer has its own lifetime.
A plugin can define a static `scoped` factory to hand each consumer a
specialized view of itself, bound to that consumer's scope. When it is
defined, `usePlugin` returns `scoped(plugin, scope)` instead of the shared
instance, where `scope` is the caller's scope (the component node, or the
plugin manager when called from another plugin).

The typical use is to wrap async methods with `scope.run`, so that a call
made by a component is automatically cancelled (rejects with an `AbortError`)
if the component is destroyed while the call is in flight:

```ts
class ORM extends Plugin {
  static scoped(self: ORM, scope: Scope): ORM {
    return Object.assign(Object.create(self), {
      read: scope.run.bind(scope, self.read),
    });
  }

  // escape hatch: the shared, unguarded instance
  unscoped = this;

  read = async (model, ids) => {
    /* ... rpc ... */
  };
}

class Customer extends Component {
  orm = usePlugin(ORM);

  async someMethod() {
    // guarded: rejects with an AbortError if this component is
    // destroyed before the call resolves
    const data = await this.orm.read("res.partner", [3]);
  }

  async someOtherMethod() {
    // unguarded: resolves regardless of this component's lifetime
    const data = await this.orm.unscoped.read("res.partner", [3]);
  }
}
```

Building the view with `Object.create(plugin)` keeps it cheap: it only
carries the overridden members and inherits everything else (including any
reactive state) from the shared instance. The factory runs once per
`usePlugin` call, so each consumer gets a view bound to its own scope.

`scoped` is a static rather than an instance method so that the view does
not itself inherit it. The return type of `usePlugin` follows the factory's
return type. See [Scope](./scope.md) for the cancellation model of
`scope.run`.

## Providing Plugins

### App-level plugins

Pass a `plugins` array when mounting the application. These plugins are
available to all components:

```js
await mount(RootComponent, document.body, {
  plugins: [NotificationManager, RouterPlugin],
});
```

### Component-level plugins

Use `providePlugins()` in a component's `setup()` to make plugins available
only to that component and its descendants:

```js
class FormView extends Component {
  static template = xml`<FormRenderer/>`;

  setup() {
    providePlugins([FormModel, FormValidator]);
  }
}
```

Plugins provided at the component level are destroyed when the component is
destroyed.

## Plugin Dependencies

A plugin can depend on other plugins by calling `usePlugin()` in its class
fields or `setup()`. If the dependency has not been started yet, it is
auto-started:

```js
class RouterPlugin extends Plugin {
  currentRoute = signal("/");

  navigateTo(url) {
    this.currentRoute.set(url);
  }
}

class ActionPlugin extends Plugin {
  router = usePlugin(RouterPlugin);

  doAction(action) {
    // ... perform action ...
    this.router.navigateTo("/result");
  }
}
```

When `ActionPlugin` is started, it will automatically start `RouterPlugin`
if it hasn't been started already.

## Configuration

Plugins can read configuration values using the `useConfig()` hook. Config
is passed as the second argument to `providePlugins()`, or in the `mount()`
options:

```js
class ApiPlugin extends Plugin {
  baseUrl = useConfig("apiBaseUrl", t.string());
  timeout = useConfig("apiTimeout", t.number().optional(5000));

  setup() {
    // use this.baseUrl and this.timeout
  }
}
```

> `useConfig` was previously named `config`; `config` remains available as a deprecated alias.

A config key is made optional with
[`.optional()`](types_validation.md#optionalvalue) on its type. In dev mode,
the type validator (second argument) is used to check the value. A default
value can be declared in the type with
[`.optional(value)`](types_validation.md#optionalvalue).

Providing config at app level:

```js
await mount(RootComponent, document.body, {
  plugins: [ApiPlugin],
  config: { apiBaseUrl: "https://api.example.com" },
});
```

Or at component level:

```js
setup() {
  providePlugins([ApiPlugin], { apiBaseUrl: "/api" });
}
```

## Plugin Shadowing

A child `providePlugins` can override a parent plugin by providing a plugin
with the same `id`. This is useful to customize behavior for a subtree:

```js
class ThemePlugin extends Plugin {
  static id = "theme";
  color = "blue";
}

class DarkThemePlugin extends Plugin {
  static id = "theme"; // same id — shadows ThemePlugin
  color = "dark-blue";
}

class DarkSection extends Component {
  setup() {
    providePlugins([DarkThemePlugin]);
  }
}
```

Components inside `DarkSection` will get `DarkThemePlugin` when calling
`usePlugin(ThemePlugin)`, while components outside still get the original.

## Resources

Plugins can define `Resource` fields — ordered collections that components
can contribute to. Items are automatically removed when the contributing
component is destroyed:

```js
class SystrayPlugin extends Plugin {
  items = new Resource({ name: "systray-items" });

  display = computed(() => {
    return this.items.items();
  });
}
```

Components contribute items by calling `use()` on the resource:

```js
class MyComponent extends Component {
  systray = usePlugin(SystrayPlugin);

  setup() {
    this.systray.items.use({ label: "Settings", action: () => this.openSettings() });
  }
}
```

When `MyComponent` is destroyed, its contributed items are automatically
removed from the resource.

## Async Initialization

A plugin can load data asynchronously during startup with `onWillStart()`. The
owning `mount()` call (or `providePlugins()` owner component) waits for all
plugin `onWillStart` callbacks to settle before rendering:

```js
class SessionPlugin extends Plugin {
  user = null;

  setup() {
    onWillStart(async ({ abortSignal }) => {
      const res = await fetch("/api/session", { signal: abortSignal });
      this.user = await res.json();
    });
  }
}
```

With app-level plugins, `app.createRoot(Root).mount(...)` does not render the
root until every plugin's `onWillStart` resolves — so components can read
`this.user` during their first render.

When multiple plugins register `onWillStart`, their callbacks run in parallel.

The `abortSignal` passed to the callback is aborted if the plugin manager is
destroyed before initialization completes. Pass it to `fetch` or check
`abortSignal.throwIfAborted()` between awaits to short-circuit abandoned work.
See [Scope](./scope.md) for the full cancellation model.

## Startup Order

Sometimes a few foundational plugins must be fully loaded before other plugins
even run their `setup()` — for example, a session plugin whose data every other
plugin reads. The `static sequence` number (default: `50`, lower starts first,
like resources and registries) controls this:

```js
class SessionPlugin extends Plugin {
  static sequence = 10; // foundational: starts before the others

  setup() {
    onWillStart(async () => {
      this.user = await loadSession();
    });
  }
}
```

Plugins are started in batches of equal sequence, in ascending order. All
`onWillStart` callbacks of a batch settle before the next batch is even
instantiated, so a plugin with the default sequence can read `SessionPlugin`'s
data synchronously in its own `setup()`. Within a batch, `onWillStart`
callbacks still run in parallel.

Two things to keep in mind:

- An explicit dependency wins over sequence: calling `usePlugin(X)` starts `X`
  immediately, even if `X` has a higher sequence number.
- If an `onWillStart` callback in a batch rejects, the remaining batches are
  not started and the mount is rejected.

## Lifecycle and Cleanup

Plugins follow a simple lifecycle:

1. The plugin is instantiated
2. `setup()` is called (may register `onWillStart` for async init)
3. The plugin is active and can be used
4. On destroy, cleanup runs in reverse order (LIFO)

All reactive values (signals, computed, effects) created during `setup()` are
automatically cleaned up when the plugin is destroyed. For manual cleanup,
use `onWillDestroy()`:

```js
class WebSocketPlugin extends Plugin {
  setup() {
    this.ws = new WebSocket("wss://example.com");
    onWillDestroy(() => this.ws.close());
  }
}
```

The `useListener()` and `useEffect()` hooks also work inside plugins, with
automatic cleanup on destroy:

```js
class KeyboardPlugin extends Plugin {
  lastKey = signal("");

  setup() {
    useListener(window, "keydown", (ev) => {
      this.lastKey.set(ev.key);
    });
  }
}
```

## Error Handling

Plugins can use the [`onError`](error_handling.md) hook, just like components.
A handler registered in a plugin's `setup()` catches rendering and lifecycle
errors coming from the subtree the plugin is provided in: the providing
component's subtree for `providePlugins()`, or the whole application for
app-level plugins.

```js
class ErrorService extends Plugin {
  lastError = signal(null);

  setup() {
    onError((error) => {
      this.lastError.set(error);
    });
  }
}
```

Handlers closest to the error run first: an error bubbles up the component
tree, and at each level the component's own handlers run before those of the
plugins it provides. A handler can rethrow to pass the error further up —
app-level plugin handlers are the last stop before Owl destroys the
application.

Note that during the initial mount, an error that reaches the root component
unhandled rejects the `mount()` promise instead of reaching the app-level
plugin handlers.
