# Codec

A codec describes how application state maps to a URL and back. The router
itself has no opinion on state shape — its codec does. Two ways to get one:

- Use [`createMatcher`](matcher.md) for pattern routes — covers most SPAs.
- Write a `RouterCodec<TState>` for any custom URL grammar.

## RouterCodec

```ts
interface RouterCodec<TState> {
  encode(state: TState): string; // returns pathname + ?search + #hash
  decode(url: URL): TState;
}
```

A minimal example for a query-string-driven app:

```js
const codec = {
  encode(state) {
    const search = new URLSearchParams();
    if (state.id !== undefined) search.set("id", String(state.id));
    return `/${state.page}${search.size ? `?${search}` : ""}`;
  },
  decode(url) {
    const [page = ""] = url.pathname.split("/").filter(Boolean);
    const id = url.searchParams.get("id");
    return { page, id: id ? Number(id) : undefined };
  },
};
```

Codecs are pure functions of their input — no shared state, no side effects.
The router calls `decode` on init and on `popstate`, and `encode` whenever
state changes that need to land in the URL.

## composeCodec

```ts
function composeCodec<TState>(
  base: RouterCodec<TState>,
  middlewares: Array<CodecMiddleware<TState>>
): RouterCodec<TState>;

type CodecMiddleware<TState> = (codec: RouterCodec<TState>) => RouterCodec<TState>;
```

Wrap a base codec in one or more middlewares to layer behavior. Middlewares
apply left-to-right on the way in (encode) and right-to-left on the way out
(decode), like express middleware.

```js
import { composeCodec, hiddenKeys, lockedKeys } from "@odoo/owl-router";

const codec = composeCodec(baseCodec, [lockedKeys(["debug", "lang"]), hiddenKeys(["draft"])]);
```

## hiddenKeys

```ts
function hiddenKeys<TState extends Record<string, any>>(
  keys: ReadonlyArray<keyof TState & string>
): CodecMiddleware<TState>;
```

Strip the listed keys from the URL on encode. They stay readable on
`router.state()` — they just don't round-trip through the URL.

Useful for state that is too volatile or too large to live in the URL: a
serialized component snapshot, a derived value that the encoder produces
from another field, or anything that would be ugly in the address bar.

```js
const codec = composeCodec(baseCodec, [hiddenKeys(["snapshot"])]);

router.push({
  page: "form",
  snapshot: {
    /* large blob */
  },
});
// URL becomes /form, but router.state().snapshot still has the blob.
```

## lockedKeys

```ts
function lockedKeys<TState extends Record<string, any>>(
  keys: ReadonlyArray<keyof TState & string>
): CodecMiddleware<TState>;
```

Preserve the listed keys when `router.replace()` is called with a partial
state. By default, `replace()` drops every previous key not in the partial;
locked keys survive.

```js
const codec = composeCodec(baseCodec, [lockedKeys(["debug"])]);

// state is { page: "users", id: 42, debug: 1 }
router.replace({ page: "settings" });
// state becomes { page: "settings", debug: 1 }  ← debug survived
```

`push()` is unaffected: it always merges with the previous state, so all
previous keys survive whether they're locked or not.

Multiple `lockedKeys` middlewares concatenate their key lists. The codec
exposes the merged list via [`getLockedKeys`](#getlockedkeys), which the
router reads at construction time.

## getLockedKeys

```ts
function getLockedKeys(codec: RouterCodec<any>): ReadonlyArray<string>;
```

Return the locked-key list a codec advertises (empty if none). The router
calls this once on construction; you usually do not need to call it
yourself.
