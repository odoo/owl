## Focus the Input

A nice touch for any form is to automatically focus the input when the page
loads, so the user can start typing right away. In this step, you will learn
how to get a reference to a DOM element and interact with it using lifecycle
hooks.

Here is what you need to do:

- Create a `signal` in the `TodoList` component to hold a reference to the
  input element: `input = signal(null)`
- Bind it to the input element in the template using `t-ref="this.input"`
- Use the `onMounted` hook to read the signal and call `.focus()` on the
  element
- Then, extract the autofocus logic into a reusable `useAutofocus(ref)` hook in a
  `utils.js` file — it should take a signal (ref) as argument and focus the
  element on mount using `onMounted`
- Import and call `useAutofocus(this.input)` in the `TodoList` component's
  `setup` method

### Hints

The `t-ref` directive links a DOM element to a signal. After the component is
mounted, the signal contains the actual DOM element:

```js
import { signal, onMounted } from "@odoo/owl";

input = signal(null);

setup() {
    onMounted(() => {
        this.input().focus();
    });
}
```

In the template:

```xml
<input t-ref="this.input" placeholder="What needs to be done?"/>
```

Note that the signal is `null` before mounting — that is why we need
`onMounted` to safely access the DOM element.
