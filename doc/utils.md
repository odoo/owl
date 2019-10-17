# 🦉 Utils 🦉

Owl export a few useful utility functions, to help with common issues. Those
functions are all available in the `owl.utils` namespace.

## Content

- [`whenReady`](#whenready): executing code when DOM is ready
- [`loadJS`](#loadjs): loading script files
- [`loadTemplates`](#loadtemplates): loading xml files
- [`escape`](#escape): sanitizing strings
- [`debounce`](#debounce): limiting rate of function calls
- [`shallowEqual`](#shallowequal): shallow object comparison


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

or alternatively:

```js
owl.utils.whenReady(function() {
  const qweb = new owl.QWeb();
  const app = new App({ qweb });
  app.mount(document.body);
});
```

## `loadJS`

`loadJS` takes a url (string) for a javascript resource, and loads it. It returns
a promise, so the caller can properly reacts when it is ready. Also, it is smart:
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

`loadTemplates` is a helper function to fetch a template file.  It simply
performs a `GET` request and return the resulting string in a promise. For
example:

```js
async function makeEnv() {
  const templates = await owl.utils.loadTemplates("templates.xml");
  const qweb = new owl.QWeb(templates);
  return { qweb };
}
```

## `escape`

Sometimes, we need to display dynamic data (for example user-generated data) in
the user interface.  If this is done by a `QWeb` template, it is not an issue:

```xml
    <div><t t-esc="user.data"/></div>
```

The `QWeb` engine will create a `div` node and add the content of the `user.data`
string as a text node, so the web browser will not parse it as html.  However,
it may be a problem if this is done with some javascript code like this:

```js
class BadComponent extends Component {
    // some template with a ref to a div
    // some code ...

    mounted() {
        this.divRef.el.innerHTML = this.state.value;
    }
}
```
In this case, the content of the `div` will be parsed as html, which may inject
unwanted behaviour.  To fix this, the `escape` function will simply transform a
string into an escaped version of the same string, which will be properly displayed
by the browser, but which will not be parsed as html (for example, `"<ok>"` is
escaped to the string: `"&lt;ok&gt;"`). So, the bad example above can be fixed
with the following change:

```js
    this.divRef.el.innerHTML = owl.utils.escape(this.state.value);
```


## `debounce`

The `debounce` function is useful when we want to limit the number of times some
function/action is perfomed. For example, this may be useful to prevent issue
with people double clicking on a button.

It takes three arguments:
- `func` (function): this is the function that will be rate limited
- `wait` (number): this is the number of milliseconds that we want to use to
   rate limit the function `func`
- `immediate` (optional, boolean, default=false): if `immediate` is true, the
  function will be triggered immediately (leading edge of the interval). If false,
  the function will be triggered at the end (trailing edge).

It returns a function.  For example:

```js
const debounce = owl.utils.debounce
window.addEventListener('mousemove', debounce(doSomething, 100));
```

As this example shows, it is usualy useful for event handlers which are triggered
very quickly, such as `scroll` or `mousemove` events.


## `shallowEqual`

This function checks if two objects have the same values assigned to each keys:

```js
shallowEqual({a:1, b: 2}, {a:1, b:2}); // true
shallowEqual({a:1, b: 2}, {a:1, b:3}); // false
```

However, for performance reasons, it assumes that the two objects have the same
keys. If we are in a situation where this is not guaranteed, the following code
will work:

```js
const completeShallowEqual = (a,b) => shallowEqual(a,b) && shallowEqual(b,a);
```