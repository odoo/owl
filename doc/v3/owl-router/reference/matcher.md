# Matcher

`createMatcher` compiles a map of route patterns into a
[`RouterCodec<MatchedRoute>`](codec.md#routercodec). Use it for typical SPAs
where each URL maps to a named route with positional parameters.

```ts
function createMatcher<TName extends string>(
  routes: Record<TName, string>,
  options?: MatcherOptions
): RouterCodec<MatchedRoute<TName>> & { routes: ReadonlyArray<...> };
```

```js
import { createMatcher, RouterPlugin } from "@odoo/owl-router";

const codec = createMatcher({
  home: "/",
  user: "/users/{id:int}",
  post: "/blog/{slug:string}",
  order: "/pos/{configId:int}/orders/{orderId:int}",
});

await mount(App, document.body, {
  plugins: [RouterPlugin],
  config: { codec },
});
```

## Pattern syntax

Each pattern uses `{name:type}` for parameters. Two built-in types:

- **`int`** — a sequence of digits, decoded as a JavaScript `number`.
- **`string`** — any single URL segment (i.e. anything but `/`).

Literal characters in the pattern are escaped automatically, so you can use
slashes, dashes, underscores, etc. without thinking about regex.

```js
createMatcher({
  user: "/users/{id:int}", // /users/42
  tag: "/tags/{slug:string}", // /tags/owl-rocks
  v: "/{locale:string}/{section:string}/{id:int}",
});
```

Unknown types throw at registration time:

```js
createMatcher({ x: "/{id:date}" });
// Error: Unknown param type "date" in route "/{id:date}"
```

## MatchedRoute

```ts
interface MatchedRoute<TName extends string = string> {
  name: TName;
  params: Record<string, string | number>;
}
```

`router.state()` returns this shape:

```js
const router = useRouter();
router.state(); // { name: "user", params: { id: 42 } }
```

Encoding goes the other way:

```js
router.push({ name: "user", params: { id: 42 } });
// → URL becomes /users/42
```

`router.codec.encode(state)` is also useful when you need the URL string for
something other than navigation (e.g. building a `<Link>` href):

```js
const href = router.codec.encode({ name: "user", params: { id: 42 } });
```

## MatcherOptions

```ts
interface MatcherOptions {
  defaultName?: string;
  prefix?: { regex: RegExp; name: string };
}
```

### `defaultName`

The route name returned by `decode()` when no pattern matches the URL.
Defaults to the first registered route. Set this to a dedicated "not found"
route name so your `RouteSwitch` (or equivalent logic) has somewhere obvious
to fall back to:

```js
const codec = createMatcher(
  {
    home: "/",
    user: "/users/{id:int}",
    notFound: "/_404",
  },
  { defaultName: "notFound" }
);
```

### `prefix`

A regex applied before the main pattern. The captured group, if any, is
exposed under `params[name]`. Useful for locale prefixes that appear on
every URL:

```js
const codec = createMatcher(
  {
    home: "/home",
    user: "/users/{id:int}",
  },
  {
    prefix: { regex: /(?:\/([a-z]{2}(?:_[a-z]{2})?))?/, name: "lang" },
  }
);

codec.decode(new URL("http://localhost/fr_be/users/42"));
// → { name: "user", params: { id: 42, lang: "fr_be" } }

codec.decode(new URL("http://localhost/users/42"));
// → { name: "user", params: { id: 42 } }    (prefix is optional in the regex)
```

## Inspecting compiled routes

The matcher exposes the registered routes for tools, tests, or dynamic
navigation:

```js
codec.routes;
// → [
//     { name: "home", pattern: "/" },
//     { name: "user", pattern: "/users/{id:int}" },
//     ...
//   ]
```

## Match order

Patterns are tried in registration order. Static segments win over generic
ones if you list them first:

```js
const codec = createMatcher({
  static: "/users/me",
  dynamic: "/users/{id:string}",
});

codec.decode(new URL("http://localhost/users/me"));
// → { name: "static", params: {} }

codec.decode(new URL("http://localhost/users/42"));
// → { name: "dynamic", params: { id: "42" } }
```

If nothing matches, the codec returns the default route with empty params.

## Encoding

`encode()` looks up the route by name, substitutes params, and returns the
URL path. Missing required params throw:

```js
codec.encode({ name: "user", params: {} });
// Error: Missing param "id" for route "user"

codec.encode({ name: "unknown", params: {} });
// Error: Unknown route "unknown"
```
