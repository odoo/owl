# 🦉 Quick Overview 🦉

Owl components in an application are used to define a (dynamic) tree of components.

```
        Root
        /   \
       A     B
      / \
     C   D
```

**State:** each component can manage its own local state. It is a simple ES6
class, there are no special rules:

```js
class Counter extends Component {
  static template = xml`
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = { value: 0 };

  increment() {
    this.state.value++;
    this.render();
  }
}
```

The example above shows a component with a local state. Note that since there
is nothing magical to the `state` object, we need to manually call the `render`
function whenever we update it. This can quickly become annoying (and not
efficient if we do it too much). There is a better way: using the `useState`
hook, which transforms an object into a reactive version of itself:

```js
const { useState } = owl.hooks;

class Counter extends Component {
  static template = xml`
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = useState({ value: 0 });

  increment() {
    this.state.value++;
  }
}
```

Note that the `t-on-click` handler can even be replaced by an inline statement:

```xml
    <button t-on-click="state.value++">
```

**Props:** sub components often needs some information from their parents. This
is done by adding the required information to the template. This will then be
accessible by the sub component in the `props` object. Note that there is an
important rule here: the information contained in the `props` object is not
owned by the sub component, and should never be modified.

```js
class Child extends Component {
  static template = xml`<div>Hello <t t-esc="props.name"/></div>`;
}

class Parent extends Component {
  static template = xml`
    <div>
        <Child name="'Owl'" />
        <Child name="'Framework'" />
    </div>`;
  static components = { Child };
}
```

**Communication:** there are multiple ways to communicate information between
components. However, the two most important ways are the following:

- from parent to children: by using `props`,
- from a children to one of its parent: by triggering events.

The following example illustrate both mechanisms:

```js
class OrderLine extends Component {
  static template = xml`
    <div t-on-click="add">
        <div><t t-esc="props.line.name"/></div>
        <div>Quantity: <t t-esc="props.line.quantity"/></div>
    </div>`;

  add() {
    this.trigger("add-to-order", { line: props.line });
  }
}

class Parent extends Component {
  static template = xml`
    <div t-on-add-to-order="addToOrder">
        <OrderLine
            t-foreach="orders"
            t-as="line"
            line="line" />
    </div>`;
  static components = { OrderLine };
  orders = useState([
    { id: 1, name: "Coffee", quantity: 0 },
    { id: 2, name: "Tea", quantity: 0 }
  ]);

  addToOrder(event) {
    const line = event.detail.line;
    line.quantity++;
  }
}
```

In this example, the `OrderLine` component trigger a `add-to-order` event. This
will generate a DOM event which will bubble along the DOM tree. It will then be
intercepted by the parent component, which will then get the line (from the
`detail` key) and then increment its quantity. See the page on [event handling](../reference/event_handling.md)
for more details on how events work.

Note that this example would have also worked if the `OrderLine` component
directly modifies the `line` object. However, this is not a good practice: this
only works because the `props` object received by the child component is reactive,
so the child component is then coupled to the parents implementation.
