# 🦉 Utility functions 🦉

Owl export a few useful utility functions, to help with common issues. Those
functions are all available in the `owl.utils` namespace.

## Content

- [`whenReady`](#whenready)
- [`loadJS`](#loadjs)
- [`loadTemplates`](#loadtemplates)
- [`escape`](#escape)
- [`debounce`](#debounce)
- [`patch` and `unpatch`](#patchandunpatch)

## `whenReady`

The function `whenReady` is useful to register some code that need to be executed
as soon as the document (page) is ready:

```js
owl.utils.whenReady(function () {
    const qweb = new owl.QWeb();
    const app = new App({ qweb });
    app.mount(document.body);
});
```

## `loadJS`

## `loadTemplates`

## `escape`

## `debounce`

## `patch` and `unpatch`





