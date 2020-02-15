# 🦉 Error Handling 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)

## Overview

By default, whenever an error occurs in the rendering of an Owl application, we
destroy the whole application. Otherwise, we cannot offer any guarantee on the
state of the resulting component tree. It might be hopelessly corrupted, but
without any user-visible state.

Clearly, it sometimes is a little bit extreme to destroy the application. This
is why we have a builtin mechanism to handle rendering errors (and errors coming
from lifecycle hooks): the `catchError` hook.

## Example

For example, here is how we could implement an `ErrorBoundary` component:

```xml
<div t-name="ErrorBoundary">
    <t t-if="state.error">
        Error handled
    </t>
    <t t-else="">
        <t t-slot="default" />
    </t>
</div>
```

```js
class ErrorBoundary extends Component {
  state = useState({ error: false });

  catchError() {
    this.state.error = true;
  }
}
```

Using the `ErrorBoundary` is then extremely simple:

```xml
<ErrorBoundary><SomeOtherComponent/></ErrorBoundary>
```

Note that we need to be careful here: the fallback UI should not throw any
error, otherwise we risk going into an infinite loop (also, see the page on
[slots](slots.md) for more information on the `t-slot` directive).

## Reference

Whenever the `catchError` lifecycle hook is implemented, all errors coming from
sub components rendering and/or lifecycle method calls will be caught and given
to the `catchError` method. This allows us to properly handle the error, and to
not break the application.

There are important things to know:

- If an error that occured in the internal rendering cycle is not caught, then
  Owl will destroy the full application. This is done on purpose, because Owl
  cannot guarantee that the state is not corrupted from this point on.

- errors coming from event handlers are NOT managed by `catchError` or any other
  owl mechanism. This is up to the application developer to properly recover
  from an error

Also, it may be useful to know that whenever an error is caught, it is then
broadcasted to the application by an event on the `qweb` instance. It may be
useful, for example, to log the error somewhere.

```js
env.qweb.on("error", null, function(error) {
  // do something
  // react to the error
});
```
