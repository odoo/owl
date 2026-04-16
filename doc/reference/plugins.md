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

The `plugin()` function imports a plugin instance. It can be used in component
class fields or in the `setup()` method:

```js
class App extends Component {
  static template = xml`
    <div>
      <t t-foreach="this.notifications.notifications()" t-as="n" t-key="n.id">
        <div t-out="n.message" t-on-click="() => this.notifications.dismiss(n.id)"/>
      </t>
    </div>`;

  notifications = plugin(NotificationManager);
}
```

The return value is the plugin instance with full type information (minus the
`setup` method). Any reactive values on the plugin (signals, computed) are
tracked automatically when read during a component render.

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

A plugin can depend on other plugins by calling `plugin()` in its class
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
  router = plugin(RouterPlugin);

  doAction(action) {
    // ... perform action ...
    this.router.navigateTo("/result");
  }
}
```

When `ActionPlugin` is started, it will automatically start `RouterPlugin`
if it hasn't been started already.

## Configuration

Plugins can read configuration values using the `config()` function. Config
is passed as the second argument to `providePlugins()`, or in the `mount()`
options:

```js
class ApiPlugin extends Plugin {
  baseUrl = config("apiBaseUrl", t.string());
  timeout = config("apiTimeout?", t.number()) || 5000;

  setup() {
    // use this.baseUrl and this.timeout
  }
}
```

Append `?` to the key name to make it optional. In dev mode, the type
validator (second argument) is used to check the value.

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
`plugin(ThemePlugin)`, while components outside still get the original.

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

Components contribute items using `useResource()`:

```js
class MyComponent extends Component {
  systray = plugin(SystrayPlugin);

  setup() {
    useResource(this.systray.items, [{ label: "Settings", action: () => this.openSettings() }]);
  }
}
```

When `MyComponent` is destroyed, its contributed items are automatically
removed from the resource.

## Lifecycle and Cleanup

Plugins follow a simple lifecycle:

1. The plugin is instantiated
2. `setup()` is called
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
