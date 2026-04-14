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
- Define and validate these props using the `props` and `types` helpers
- Define a **default value** for the `image` prop (e.g. `"📦"`) so that
  products without an image still display something
- Import `ProductCard` in `main.js` and use it to display the hardcoded products

### Hints

To define and validate props, use the `props` function together with `types`.
The property name you assign it to is how you access it in the template:

```js
import { Component, props, types as t } from "@odoo/owl";

class ProductCard extends Component {
  props = props({
    name: t.string(),
    price: t.number(),
    "image?": t.string(),
  });
}
```

Since we named the property `props`, we access values in the template with
`this.props`:

```xml
<span t-out="this.props.name"/>
```

A `?` suffix marks a prop as optional. When `dev: true` is set in the app,
Owl will check that required props are provided and that their types match.

The `types` helper supports many other types:

- `t.boolean()`, `t.number()`, `t.string()`
- `t.function()`
- `t.object({ id: t.number(), name: t.string() })`
- `t.signal()`
- `t.array(t.string())`

The `props` function accepts a second argument for **default values**:

```js
props = props({
    name: t.string(),
    "image?": t.string(),
}, {
    image: "📦",
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
