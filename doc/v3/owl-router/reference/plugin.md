# Plugin

`RouterPlugin` is the canonical way to bring a router into an Owl app. There
is no module-level singleton — every router lives inside a plugin manager,
which gives you proper cleanup on app destroy and a fresh router per test.

## RouterPlugin

```ts
class RouterPlugin extends Plugin {
  static id = "router";
  router: Router;
}
```

Register at app level for a single app-wide router:

```js
import { mount } from "@odoo/owl";
import { RouterPlugin } from "@odoo/owl-router";

await mount(App, document.body, {
  plugins: [RouterPlugin],
  config: { codec: myCodec },
});
```

Or at component level if only a subtree needs it:

```js
import { providePlugins } from "@odoo/owl";

class Wizard extends Component {
  setup() {
    providePlugins([RouterPlugin], { codec: wizardCodec });
  }
}
```

The plugin reads its dependencies from the manager's `config`:

| Key       | Optional | Description                                                            |
| --------- | -------- | ---------------------------------------------------------------------- |
| `codec`   | no       | The [`RouterCodec`](codec.md) describing the URL shape.                |
| `history` | yes      | A [`HistoryAdapter`](history.md). Defaults to `BrowserHistoryAdapter`. |
| `reload`  | yes      | Called when navigation is requested with `{ reload: true }`.           |

When the plugin manager is destroyed (app unmount, component unmount, test
teardown), the plugin disposes its router — `popstate` / `pageshow`
listeners are removed, and pending coalesced pushes are dropped.

## useRouter

```ts
function useRouter<TState = Record<string, any>>(): Router<TState>;
```

Returns the router from the nearest plugin manager that started a
`RouterPlugin`. Call it inside a component's `setup()` or as a class field:

```js
class Page extends Component {
  router = useRouter();

  goHome = () => this.router.push({ name: "home" });
}
```

### Typing the state

Pass the state type as a generic argument to get full type-checking on
`router.state()`, `push()`, `replace()`, etc.:

```ts
import type { MatchedRoute } from "@odoo/owl-router";

type Route = MatchedRoute<"home"> | MatchedRoute<"user">;

class Page extends Component {
  router = useRouter<Route>();

  setup() {
    const state = this.router.state();
    if (state.name === "user") {
      console.log(state.params.id); // typed
    }
  }
}
```

For custom codecs, pass your own state type:

```ts
interface AppState {
  page: "home" | "users" | "settings";
  id?: number;
  debug?: number;
}

const router = useRouter<AppState>();
```

## Lazy startup

`useRouter()` calls `plugin(RouterPlugin)` under the hood, which auto-starts
the plugin if it hasn't been started yet — provided the codec is available
in the plugin manager's config. This means you can register dependencies
that pull `useRouter` without explicitly listing the plugin.

That said, listing it in the `plugins` array (or `providePlugins` call) is
clearer and ensures the router is constructed at app start rather than on
first use.

## Reading state outside components

The router is a regular class — nothing prevents passing it around:

```js
class HistoryLogger extends Plugin {
  router = plugin(RouterPlugin);

  setup() {
    effect(() => {
      console.log("now at", this.router.router.url().href);
    });
  }
}
```

(`this.router.router` reads odd because `RouterPlugin.router` is the actual
router instance — the outer property is the plugin handle. Most apps avoid
this by aliasing in `setup()`.)

## Testing

Tests typically build their own plugin manager to skip mounting a full
component tree:

```js
import { App } from "@odoo/owl";
import { PluginManager } from "@odoo/owl-core";
import { RouterPlugin, MemoryHistoryAdapter, createMatcher } from "@odoo/owl-router";

const codec = createMatcher({ home: "/", user: "/users/{id:int}" });
const history = new MemoryHistoryAdapter();
const manager = new PluginManager(new App(), { config: { codec, history } });
manager.startPlugins([RouterPlugin]);

const router = manager.getPlugin(RouterPlugin)!.router;
router.navigate("/users/42");
expect(router.state()).toEqual({ name: "user", params: { id: 42 } });

manager.destroy(); // tears down the router cleanly
```
