# Components & hooks

The package ships two small components and one hook for declarative routing
inside templates. They are opt-in — apps that prefer to drive the router
imperatively can ignore them, and tree-shaking will remove them from the
bundle.

## Link

```ts
class Link extends Component {
  props: {
    href: string;
    replace?: boolean;
    class?: string;
    title?: string;
  };
}
```

Renders a real `<a>` element with the given `href` and intercepts left
clicks to soft-navigate via the router. Right-click, middle-click, and
modifier-key clicks go through to the browser unmodified — copy-link, "open
in new tab", and similar all work as expected.

```xml
<Link href="'/users/42'">User 42</Link>
<Link href="'/about'" class="'btn'">About</Link>
<Link href="'/settings'" replace="true">Settings (replaceState)</Link>
```

The `href` is whatever string you want the URL to become. Pair it with
`router.codec.encode(...)` if you have a typed state object:

```js
class UserLink extends Component {
  static template = xml`<Link t-att-href="this.href">View</Link>`;
  static components = { Link };

  router = useRouter();

  get href() {
    return this.router.codec.encode({ name: "user", params: { id: this.props.id } });
  }
}
```

## RouteSwitch

```ts
class RouteSwitch extends Component {
  props: {
    select: (state: any) => string;
  };
}
```

Renders one named slot picked by the `select` callback. Falls back to a
slot named `default` when the picked name is not provided.

```xml
<RouteSwitch select="(s) => s.name">
  <t t-set-slot="home"><Home/></t>
  <t t-set-slot="user"><User/></t>
  <t t-set-slot="default"><NotFound/></t>
</RouteSwitch>
```

`select` receives the current `router.state()`. Because it reads a signal,
the slot picker is reactive — the rendered slot updates automatically when
the router state changes.

For custom codecs whose state isn't a `MatchedRoute`:

```xml
<RouteSwitch select="(s) => s.page">
  <t t-set-slot="users"><UserList/></t>
  <t t-set-slot="form"><FormView/></t>
  <t t-set-slot="default"><Home/></t>
</RouteSwitch>
```

If you need predicate-based routing (`t-if`-style conditions instead of a
single discriminator), wire it directly:

```xml
<t t-if="this.router.state().id">
  <Detail/>
</t>
<t t-else="">
  <List/>
</t>
```

## useLinkInterceptor

```ts
function useLinkInterceptor(
  router: Router,
  options: {
    match: (anchor: HTMLAnchorElement, url: URL) => boolean;
    target?: EventTarget; // default: document
    replace?: boolean; // default: false (pushState)
  }
): void;
```

Subscribe to clicks on internal links anywhere on the page (or inside a
specific element) and soft-navigate via the router. Useful when links
aren't always rendered through `<Link>` — e.g. content rendered from
markdown, third-party widgets, or static HTML.

```js
import { useLinkInterceptor, useRouter } from "@odoo/owl-router";

class App extends Component {
  setup() {
    const router = useRouter();
    useLinkInterceptor(router, {
      match: (a, url) => url.origin === window.location.origin && url.pathname.startsWith("/app"),
    });
  }
}
```

The hook handles all the common defensive cases on your behalf:

- Skips when `defaultPrevented` was already set by another listener.
- Skips middle-click and modified clicks.
- Skips `<a target="_blank">`.
- Skips clicks inside `[contenteditable]` regions.
- Skips anchor links (`href="#section"`).
- Skips unparsable hrefs.

You only have to decide whether a given URL should be intercepted via
`match`. The most common predicate is "same origin and starts with my app's
path".

The listener is removed automatically when the surrounding scope (component
or plugin manager) is destroyed.
