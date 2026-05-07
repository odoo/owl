# Installation

`@odoo/owl-router` is published alongside `@odoo/owl`. Install the two together
in any Owl 4 project:

```bash
npm install @odoo/owl @odoo/owl-router
```

The router builds on Owl's plugin system, so it is registered like any other
plugin — pass it to `mount()` (or `providePlugins()` for component-level
scope) along with the codec describing your URL shape.

## Minimal setup

```js
import { mount, Component, xml } from "@odoo/owl";
import { RouterPlugin, createMatcher, useRouter } from "@odoo/owl-router";

const codec = createMatcher({
  home: "/",
  user: "/users/{id:int}",
});

class App extends Component {
  static template = xml`
    <div>
      <p>Current route: <t t-out="this.router.state().name"/></p>
      <button t-on-click="() => this.router.push({ name: 'user', params: { id: 42 } })">
        Go to user 42
      </button>
    </div>`;

  router = useRouter();
}

await mount(App, document.body, {
  plugins: [RouterPlugin],
  config: { codec },
});
```

The configuration that `RouterPlugin` understands:

| Key       | Type             | Description                                                    |
| --------- | ---------------- | -------------------------------------------------------------- |
| `codec`   | `RouterCodec`    | **Required.** State ↔ URL codec.                               |
| `history` | `HistoryAdapter` | Optional. Defaults to a `BrowserHistoryAdapter`.               |
| `reload`  | `() => void`     | Optional. Called when navigation specifies `{ reload: true }`. |

## Tests

For tests (or SSR), pass a [`MemoryHistoryAdapter`](./reference/history.md#memoryhistoryadapter)
so the router never touches `window.history`:

```js
import { MemoryHistoryAdapter, RouterPlugin } from "@odoo/owl-router";

const history = new MemoryHistoryAdapter({ initialUrl: "/users/42" });

await mount(App, fixture, {
  plugins: [RouterPlugin],
  config: { codec, history },
});
```

Each test gets its own router because each `mount()` creates its own plugin
manager — there is no module-level singleton to reset between runs.

## Component-scoped router

If only a subtree of your app needs routing, register the plugin via
`providePlugins()` instead of at app level:

```js
import { providePlugins } from "@odoo/owl";
import { RouterPlugin, createMatcher } from "@odoo/owl-router";

class Wizard extends Component {
  static template = xml`<WizardSteps/>`;
  static components = { WizardSteps };

  setup() {
    providePlugins([RouterPlugin], {
      codec: createMatcher({ step1: "/wizard/1", step2: "/wizard/2" }),
    });
  }
}
```

The router is destroyed (and stops listening to `popstate`) when `Wizard`
unmounts.
