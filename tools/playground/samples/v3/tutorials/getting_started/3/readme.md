## Props and Props Validation

Components become truly useful when they can receive data from their parent.
In Owl, this is done through **props**. In this step, you will build a
`ProductCard` component that receives product information as props, and learn
how to validate them.

Here is what you need to do:

- Create a `ProductCard` component in its own file (`product_card.js`) with a
  template and a CSS file (`product_card.css`)
- It should accept the following props: `name` (string), `description` (string),
  `price` (number), and `image` (optional string — a unicode emoji)
- Define and validate these props using the `useProps` and `types` helpers
- Define a **default value** for the `image` prop (e.g. `"📦"`) so that
  products without an image still display something
- Import `ProductCard` in `main.js` and use it to display the hardcoded products

### Hints

To define and validate props, use the `useProps` function together with `types`.
The property name you assign it to is how you access it in the template. See the
[useProps](https://odoo.github.io/owl/documentation/v3/owl/reference/props.html#the-useprops-function)
documentation for more details.

```js
import { Component, useProps, t } from "@odoo/owl";

class ProductCard extends Component {
  props = useProps({
    name: t.string(),
    price: t.number(),
    image: t.string().optional(),
  });
}
```

Since we named the property `props`, we access values in the template with
`this.props`:

```xml
<span t-out="this.props.name"/>
```

Calling `.optional()` on a type marks the prop as optional. When `dev: true`
is set in the app, Owl will check that required props are provided and that
their types match.

The `types` helper supports many other [validators](https://odoo.github.io/owl/documentation/v3/owl/reference/types_validation.html#validators):

- `t.boolean()`, `t.number()`, `t.string()`
- `t.function()`
- `t.object({ id: t.number(), name: t.string() })`
- `t.signal()`
- `t.array(t.string())`

Passing a value to `.optional(value)` also declares a **default value**:

```js
props = useProps({
    name: t.string(),
    image: t.string().optional("📦"),
});
```

When the parent does not provide the `image` prop, it will default to `"📦"`.

To pass props from a parent template, use JS expressions as attribute values:

```xml
<ProductCard name="this.headphone.name" price="this.headphone.price"/>
```

## Bonus Exercises

- Move the products into a list in a separate file (`products.js`), import it
  in `main.js`, and iterate over it in the template with `t-foreach`.
- Refactor `ProductCard` to receive a single `product` prop (an object) instead
  of individual props. Use `t.object({ ... })` to validate its shape.
