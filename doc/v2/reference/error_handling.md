# 🦉 Error Handling 🦉

## Content

- [Overview](#overview)
- [Managing Errors](#managing-errors)
- [Example](#example)

## Overview

By default, whenever an error occurs in the rendering of an Owl application, we
destroy the whole application. Otherwise, we cannot offer any guarantee on the
state of the resulting component tree. It might be hopelessly corrupted, but
without any user-visible feedback.

Clearly, it is usually a little bit extreme to destroy the application. This
is why we need a mechanism to handle rendering errors (and errors coming
from lifecycle hooks): the `onError` hook.

The main idea is that the `onError` hook register a function that will be called
with the error. This function need to handle the situation, most of the time by
updating some state and rerendering itself, so the application can return to a
normal state.

## Managing Errors

Whenever the `onError` lifecycle hook is used, all errors coming from
sub components rendering and/or lifecycle method calls will be caught and given
to the `onError` method. This allows us to properly handle the error, and to
not break the application.

There are important things to know:

- If an error that occured in the internal rendering cycle is not caught, then
  Owl will destroy the full application. This is done on purpose, because Owl
  cannot guarantee that the state is not corrupted from this point on.

- errors coming from event handlers are NOT managed by `onError` or any other
  owl mechanism. This is up to the application developer to properly recover
  from an error

- if an error handler is unable to properly handle an error, it can just rethrow
  an error, and Owl will try looking for another error handler up the component
  tree.

## Example

For example, here is how we could implement a generic component `ErrorBoundary`
that render its content, and a fallback if an error happened.

```js
class ErrorBoundary extends Component {
  static template = xml`
    <t t-if="state.error" t-slot="fallback">An error occurred</t>
    <t t-else="" t-slot="default"/>`;

  setup() {
    this.state = useState({ error: false });
    onError(() => (this.state.error = true));
  }
}
```

Using the `ErrorBoundary` is then simple simple:

```xml
<ErrorBoundary>
  <SomeOtherComponent/>
  <t t-set-slot="fallback">Some specific error message</t>
</ErrorBoundary>
```

Note that we need to be careful here: the fallback UI should not throw any
error, otherwise we risk going into an infinite loop (also, see the page on
[slots](slots.md) for more information on the `t-slot` directive).
