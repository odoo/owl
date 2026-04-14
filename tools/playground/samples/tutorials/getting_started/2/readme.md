## Sub Components

Components are meant to be composed together to build a user interface. In this
step, you will extract the `Counter` into its own sub component and use it
inside a parent `Root` component. To make it more interesting, we want to see
two independent counters.

Here is what you need to do:

- Extract the `Counter` component into its own file `counter.js` and export it
- Create a `Root` component in `main.js` that imports and uses `Counter` twice
- Register `Counter` in the static `components` object of `Root`
- Move the template of `Counter` into its own file: `counter.xml`. Reference
  it using `static template = "tutorial.Counter"` (the template name must
  match the `t-name` in the XML file)
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

To move a template to its own XML file, create a `counter.xml` with a
`t-name` attribute, and reference it by name in the component:

```xml
<templates>
  <t t-name="tutorial.Counter">
    ...
  </t>
</templates>
```

```js
static template = "tutorial.Counter";
```

**Template naming convention:** template names should follow the pattern
`addon_name.ComponentName` (e.g. `tutorial.Counter`). This avoids collisions
when multiple addons define components with the same template name.

**File naming convention:** use snake_case for file names. A component
`MyComponent` goes into `my_component.js`, with its template in
`my_component.xml` and its styles in `my_component.css`.
