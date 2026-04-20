# Utils

Owl export a few useful utility functions, to help with common issues. Those
functions are all available in the `owl.utils` namespace.

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

## `htmlEscape`

`htmlEscape(value)` returns a [`Markup`](template_syntax.md#outputting-data)
string with HTML special characters escaped (`&`, `<`, `>`, `'`, `"`, `` ` ``).
The result is safe to inject as raw HTML — for example, to compose a string
that will then be passed to `t-out` via [`markup`](template_syntax.md#outputting-data).

```js
htmlEscape("<script>"); // Markup `&lt;script&gt;`
htmlEscape(42); // Markup `42`
htmlEscape(undefined); // Markup ``
```

If the input is already a `Markup` instance, it is returned unchanged — this
makes `htmlEscape` idempotent and safe to call on values that may or may not
already be marked safe.

You typically don't need `htmlEscape` directly: `t-out` escapes everything
that is not a `Markup`, and the `markup` tagged-template form (`` markup`<b>${user}</b>` ``)
escapes interpolated values automatically. Reach for `htmlEscape` when you
are assembling an HTML string in JavaScript and need to escape an
untrusted fragment before wrapping the whole thing in `markup`.

## `batched`

The `batched` function creates a batched version of a callback so that multiple calls to it within the same microtick will only result in a single invocation of the original callback.

```js
function hello() {
  console.log("hello");
}

const batchedHello = batched(hello);
batchedHello();
// Nothing is logged
batchedHello();
// Still not logged

await Promise.resolve(); // Await the next microtick
// "hello" is logged only once
```
