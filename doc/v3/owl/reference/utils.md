# Utils

Owl exports a few useful utility functions, available as top-level named
imports from `@odoo/owl`.

## `whenReady`

The function `whenReady` returns a `Promise` resolved when the DOM is ready (if
not ready yet, resolved directly otherwise). If called with a callback as
argument, it executes it as soon as the DOM ready (or directly).

```js
const { whenReady } = owl;

await whenReady();
// do something
```

or alternatively:

```js
whenReady(function () {
  // do something
});
```

## `EventBus`

It is a simple `EventBus`, with the same API as usual DOM elements, and an
additional `trigger` method to dispatch events:

```js
const bus = new EventBus();
bus.addEventListener("event", () => console.log("something happened"));

bus.trigger("event"); // 'something happened' is logged
```

## `batched`

The `batched` function wraps a callback so that any number of calls to it
within a synchronous block collapse into a single invocation of the original
callback, scheduled on the next microtask via `Promise.resolve().then(...)`.
This is the same scheduling primitive Owl uses internally to batch reactive
updates.

```js
function hello() {
  console.log("hello");
}

const batchedHello = batched(hello);
batchedHello();
// Nothing is logged yet — the call is queued for the next microtask
batchedHello();
// Still nothing — a microtask is already scheduled, this call is coalesced

await Promise.resolve(); // Yield to the microtask queue
// "hello" is logged exactly once
```

If the batched callback throws, the error surfaces as a normal unhandled
promise rejection (it is not swallowed).

## `htmlEscape`

`htmlEscape(value)` escapes a value into a [`Markup`](#markup) string —
the same wrapper `markup` produces. It escapes `&`, `<`, `>`, `'`, `"`,
and `` ` ``. `undefined` becomes the empty string; numbers are stringified.
Values that are already `Markup` are passed through unchanged.

```js
import { htmlEscape } from "@odoo/owl";

htmlEscape("<b>hello</b>"); // Markup("&lt;b&gt;hello&lt;/b&gt;")
htmlEscape(42); // Markup("42")
```

This is the primitive `t-out` uses when rendering arbitrary values. Reach
for it when you need to assemble an HTML string by hand and want the same
escaping semantics as the template engine.

## `markup`

`markup` marks a string as already-safe HTML, so `t-out` injects it raw
instead of escaping it. It has two forms:

**Direct form** — the caller asserts the entire string is safe:

```js
import { markup } from "@odoo/owl";

const safe = markup("<b>hello</b>");
```

**Tag-function form** — interpolations inside the template literal are
escaped via [`htmlEscape`](#htmlescape); the surrounding literal text is
kept as-is:

```js
const userInput = "<script>";
const safe = markup`<b>${userInput}</b>`;
// Markup("<b>&lt;script&gt;</b>")
```

The tag-function form is the safe default when composing HTML that mixes
trusted markup with untrusted data.
