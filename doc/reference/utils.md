# 🦉 Utils 🦉

Owl export a few useful utility functions, to help with common issues. Those
functions are all available in the `owl.utils` namespace.

## Content

- [`whenReady`](#whenready): executing code when DOM is ready
- [`loadFile`](#loadfile): loading a file (useful for templates)
- [`EventBus`](#eventbus): a simple EventBus
- [`validate`](#validate): a validation function
- [`batched`](#batched): batch function calls

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

## `loadFile`

`loadFile` is a helper function to fetch a file. It simply
performs a `GET` request and returns the resulting string in a promise. The
initial usecase for this function is to load a template file. For example:

```js
const { loadFile } = owl;

async function makeEnv() {
  const templates = await loadFile("templates.xml");
  // do something
}
```

## `EventBus`

It is a simple `EventBus`, with the same API as usual DOM elements, and an
additional `trigger` method to dispatch events:

```js
const bus = new EventBus();
bus.addEventListener("event", () => console.log("something happened"));

bus.trigger("event"); // 'something happened' is logged
```

## `validate`

The `validate` function is a function that validates if a given object satisfies a
specified schema. It is actually used by Owl itself to perform
[props validation](props.md#props-validation). For example:

```js
validate(
  { a: "hey" },
  {
    id: Number,
    url: [Boolean, { type: Array, element: Number }],
  }
);

// throws an error with the following information:
//    - unknown key 'a',
//    - 'id' is missing (should be a number),
//    - 'url' is missing (should be a boolean or list of numbers),
```

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
