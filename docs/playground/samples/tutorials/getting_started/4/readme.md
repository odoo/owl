## Signals, Computed Values and t-model

In previous steps, we used signals to track simple values. Now we will explore
how to read values from form inputs with `t-model`, and how to derive new
values with `computed`.

Here is what you need to do:

- Add a `name` signal (initial value `""`) and an `<input>` with a placeholder
  "Name", bound to it with `t-model`
- Add an `email` signal (initial value `""`) and a corresponding input with
  placeholder "Email"
- Add a `computed` value `isValid` that returns `true` if both `name` and
  `email` are non-empty, and `email` contains a `@`
- Display "Valid" or "Invalid" in a `<div>` depending on `isValid`

### Hints

The `t-model` directive creates a two-way binding between an input and a
signal. When the user types, the signal is updated automatically:

```xml
<input t-model="this.name" placeholder="Name"/>
```

A `computed` value is derived from other signals. It updates automatically
when its dependencies change:

```js
import { signal, computed } from "@odoo/owl";

name = signal("");
greeting = computed(() => `Hello ${this.name()}`);
```

To read a computed value in the template, call it like a signal:

```xml
<t t-out="this.greeting()"/>
```

## Bonus Exercises

- Add visual styling: display "Valid" in green and "Invalid" in red.
- Add a "Submit" button that is disabled when the form is invalid.
