# 🦉 Utils 🦉

Owl export a few useful utility functions, to help with common issues. Those
functions are all available in the `owl.utils` namespace.

## Content

- [`whenReady`](#whenready): executing code when DOM is ready
- [`loadJS`](#loadjs): loading script files
- [`loadTemplates`](#loadtemplates): loading xml files
- [`escape`](#escape): sanitizing strings
- [`debounce`](#debounce): limiting rate of function calls

## `whenReady`

The function `whenReady` returns a `Promise` resolved when the DOM is ready (if
not ready yet, resolved directly otherwise). If called with a callback as
argument, it executes it as soon as the DOM ready (or directly).

```js
Promise.all([loadTemplates(), owl.utils.whenReady()]).then(function([templates]) {
  const qweb = new owl.QWeb(templates);
  const app = new App({ qweb });
  app.mount(document.body);
});
```

```js
owl.utils.whenReady(function() {
  const qweb = new owl.QWeb();
  const app = new App({ qweb });
  app.mount(document.body);
});
```

## `loadJS`

`loadJS` takes a url (string) for a javascript resource, and loads it. It returns
a promise, so the caller can properly react when it is ready. Also, it is smart:
it maintains a list of urls previously loaded (or currently being loaded), and
prevent doing twice the work.

```js
class MyComponent extends owl.Component {
  willStart() {
    return owl.utils.loadJS("/static/libs/someLib.js");
  }
}
```

## `loadTemplates`

```js
async function makeEnv() {
  const templates = await owl.utils.loadTemplates("templates.xml");
  const qweb = new owl.QWeb(templates);
  return { qweb };
}
```

## `escape`

## `debounce`
