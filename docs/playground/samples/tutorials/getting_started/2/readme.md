## Sub Components

Components are meant to be composed together to build a user interface. In this
step, you will extract the `Counter` into its own sub component and use it
inside a parent `Root` component. To make it more interesting, we want to see
two independent counters.

Here is what you need to do:

- Extract the `Counter` component into its own file `counter.js` and export it
- Create a `Root` component in `main.js` that imports and uses `Counter` twice
- Register `Counter` in the static `components` object of `Root`
- Add a `counter` CSS class on the root `<div>` of the Counter template and
  create a `counter.css` file to style it (inline-block, margin, padding, border).
  A component is a reusable unit of UI: js, xml and css.

### Hints

To export a component from its own file:

```js
export class Counter extends Component {
    ...
}
```

To import and register it in a parent component:

```js
import { Counter } from "./counter";

class Root extends Component {
    static components = { Counter };
    static template = xml`
        <Counter />
        <Counter />`;
}
```

Each `<Counter />` instance will have its own independent state.

## Bonus Exercises

- Move the template of `Counter` into its own template file: `counter.xml`.
  You can reference it using `static template = "Counter"` (the template name
  must match).
