# Error Handling

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
    <t t-if="this.hasError()" t-call-slot="fallback">An error occurred</t>
    <t t-else="" t-call-slot="default"/>`;

  hasError = signal(false);

  setup() {
    onError(() => this.hasError.set(true));
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
[slots](slots.md) for more information on slots).

## OwlError

Errors raised by Owl itself — invalid template, missing registry key, failed
props validation, lifecycle misuse, and so on — are instances of `OwlError`,
a small subclass of the built-in `Error` exported from the main entry point:

```js
import { OwlError } from "@odoo/owl";
```

Errors thrown from user code (lifecycle hooks, template expressions, event
handlers inside an async flow, ...) are **not** converted to `OwlError`.
They propagate through Owl's internals as-is, preserving their original
type, message, and stack trace. This means `instanceof OwlError` is a
reliable way to distinguish framework complaints from application errors
inside an `onError` handler:

```js
onError((error) => {
  if (error instanceof OwlError) {
    // error originated from Owl (invalid template, missing registry key,
    // failed validation, lifecycle misuse, ...)
  } else {
    // error from user code or the runtime (TypeError, custom errors, ...)
  }
});
```

When an error (of either kind) escapes every `onError` handler, Owl
destroys the root component and forwards the same error — unchanged — to
`app._handleError`, which by default rethrows. The error surfaced at that
boundary is the exact object that was thrown; it is not wrapped. For
example, a `TypeError` thrown in `onMounted` arrives at `_handleError` as a
`TypeError` with its original stack, not as an `OwlError` with a `.cause`
chain.

`OwlError` is a plain `Error` subclass — `.message`, `.stack`, and all the
usual tooling work as expected. Owl does not attach numeric error codes;
identification is either through `instanceof OwlError` or by reading the
`.message` string.
