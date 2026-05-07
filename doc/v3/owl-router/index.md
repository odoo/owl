# Owl Router

`@odoo/owl-router` is a small, generic routing layer for Owl 4. It is built
around three ideas:

- **Signals own the state.** The current state and URL are reactive values you
  read with `router.state()` and `router.url()`. Components, computed values,
  and effects subscribe in the standard way — there is no separate event bus.
- **Plugins own the lifetime.** A `RouterPlugin` is registered when you mount
  the app; the router is created on `setup` and disposed when the plugin
  manager is destroyed. Tests get a fresh router per test for free.
- **A codec owns the URL shape.** The router does not assume anything about
  state shape. A `RouterCodec<TState>` you supply turns state into a URL and
  back. Built-in codecs cover pattern routes (`/users/{id:int}`); custom
  codecs handle anything more elaborate.

## Quick example

```js
import { mount, Component, xml } from "@odoo/owl";
import { RouterPlugin, Link, RouteSwitch, createMatcher, useRouter } from "@odoo/owl-router";

const codec = createMatcher({
  home: "/",
  user: "/users/{id:int}",
  about: "/about",
});

class Home extends Component {
  static template = xml`<h1>Home</h1>`;
}
class User extends Component {
  static template = xml`<h1>User <t t-out="this.router.state().params.id"/></h1>`;
  router = useRouter();
}
class NotFound extends Component {
  static template = xml`<h1>Not found</h1>`;
}

class App extends Component {
  static components = { Link, RouteSwitch, Home, User, NotFound };
  static template = xml`
    <nav>
      <Link href="'/'">Home</Link>
      <Link href="'/users/42'">User 42</Link>
      <Link href="'/about'">About</Link>
    </nav>
    <RouteSwitch select="(s) => s.name">
      <t t-set-slot="home"><Home/></t>
      <t t-set-slot="user"><User/></t>
      <t t-set-slot="default"><NotFound/></t>
    </RouteSwitch>`;
}

await mount(App, document.body, {
  plugins: [RouterPlugin],
  config: { codec },
});
```

That's the full surface for a typical SPA. Drop the `RouteSwitch` if you want
to drive rendering imperatively from `router.state()`; drop `Link` if you
prefer raw `<a>` tags plus [`useLinkInterceptor`](reference/components.md#uselinkinterceptor).

## When to use it

Owl Router is generic on purpose. It does not encode any application
conventions — no breadcrumb stack, no `/odoo` prefix, no notion of "actions".
Everything you can express via a codec lives in your codec. This makes the
package suitable for:

- **Single-page apps** with stable URL shapes (pattern routes via
  [`createMatcher`](reference/matcher.md)).
- **Apps with bespoke URL grammars** (write a [custom codec](reference/codec.md)
  and plug it in).
- **Tests and SSR**, by swapping the [`HistoryAdapter`](reference/history.md)
  for an in-memory implementation.

If you need something on top of these primitives — breadcrumb-aware action
stacks, locked URL keys, route guards — see the per-page reference for
patterns that compose what's already there.

## Read on

- [Installation](./installation.md) — install and wire the plugin.
- [Reference / Overview](./reference/overview.md) — full list of exports.
- [Router](./reference/router.md) — the main class, navigation methods.
- [Codec](./reference/codec.md) — how state ↔ URL works, middlewares.
- [Plugin](./reference/plugin.md) — registering with an app, `useRouter`.
- [Matcher](./reference/matcher.md) — pattern routes.
- [Components](./reference/components.md) — `Link`, `RouteSwitch`,
  `useLinkInterceptor`.
- [History adapters](./reference/history.md) — browser, memory, custom.
