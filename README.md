<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">OWL: the Odoo Web Library</a> 🦉</h1>

_Class based components with hooks, reactive state and concurrent mode_

## Project Overview

The Odoo Web Library (OWL) is a smallish (~<20kb gzipped) UI framework intended to
be the basis for the [Odoo](https://www.odoo.com/) Web Client. Owl is a modern
framework, written in Typescript, taking the best ideas from React and Vue in a
simple and consistent way. Owl's main features are:

- a declarative component system,
- a reactivity system based on hooks,
- a store implementation (for state management),
- a small frontend router

Owl components are defined with ES6 classes, they use QWeb templates, an
underlying virtual dom, integrates beautifully with hooks, and the rendering is
asynchronous.

**Try it online!** An online playground is available at
[https://odoo.github.io/owl/playground](https://odoo.github.io/owl/playground)
to let you experiment with the Owl framework. There are some code examples to
showcase some interesting features.

Owl is currently stable.  Possible future changes are explained in the
[roadmap](roadmap.md).

## Why Owl?

Why did Odoo decide to make Yet Another Framework?  This is really a question
that deserves [a long answer](doc/why_owl.md). But in short, we believe that
while the current state of the art frameworks are excellent, they are not
optimized for our use case, and there is still room for something else.

If you are interested in a comparison with React or Vue, you will
find some more additional information [here](doc/comparison.md).

## Example

Here is a short example to illustrate interactive components:

```javascript
const { Component, useState } = owl;
const { xml } = owl.tags;

class Counter extends Component {
  static template = xml`
    <button t-on-click="state.value++">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = useState({ value: 0 });
}

class App extends Component {
  static template = xml`
    <div>
      <span>Hello Owl</span>
      <Counter />
    </div>`;

  static components = { Counter };
}

const app = new App();
app.mount(document.body);
```

Note that the counter component is made reactive with the [`useState` hook](doc/reference/hooks.md#usestate).
Also, all examples here uses the [`xml` helper](doc/reference/tags.md#xml-tag) to define inline templates.
But this is not mandatory, many applications will load templates separately.

More interesting examples can be found on the
[playground](https://odoo.github.io/owl/playground) application.

## Design Principles

OWL is designed to be used in highly dynamic applications where changing
requirements are common and code needs to be maintained by large teams.

- **XML based**: templates are based on the XML format, which allows interesting
  applications. For example, they could be stored in a database and modified
  dynamically with `xpaths`.
- **templates compilation in the browser**: this may not be a good fit for all
  applications, but if you need to generate dynamically user interfaces in the
  browser, this is very powerful. For example, a generic form view component
  could generate a specific form user interface for each various models, from a XML view.
- **no toolchain required**: this is extremely useful for some applications, if,
  for various reasons (security/deployment/dynamic modules/specific assets tools),
  it is not ok to use standard web tools based on `npm`.

Owl is not designed to be fast nor small (even though it is quite good on those
two topics). It is a no nonsense framework to build applications. There is only
one way to define components (with classes).


## Documentation

A complete documentation for Owl can be found here:

- [Main documentation page](doc/readme.md).

The most important sections are:

- [Tutorial: TodoList application](doc/learning/tutorial_todoapp.md)
- [QWeb templating language](doc/reference/qweb_templating_language.md)
- [Component](doc/reference/component.md)
- [Hooks](doc/reference/hooks.md)

Found an issue in the documentation? A broken link? Some outdated information?
Submit a PR!

## Installing/Building

Owl can be installed with the following command:

```
npm install @odoo/owl
```

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-1.0.4.js](https://github.com/odoo/owl/releases/download/v1.0.4/owl.js)
- [owl-1.0.4.min.js](https://github.com/odoo/owl/releases/download/v1.0.4/owl.min.js)

Some npm scripts are available:

| Command          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `npm install`    | install every dependency required for this project |
| `npm run build`  | build a bundle of _owl_ in the _/dist/_ folder     |
| `npm run minify` | minify the prebuilt owl.js file                    |
| `npm run test`   | run all (owl) tests                                |

## Quick Overview

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
  orders = useState([{ id: 1, name: "Coffee", quantity: 0 }, { id: 2, name: "Tea", quantity: 0 }]);

  addToOrder(event) {
    const line = event.detail.line;
    line.quantity++;
  }
}
```

In this example, the `OrderLine` component trigger a `add-to-order` event. This
will generate a DOM event which will bubble along the DOM tree. It will then be
intercepted by the parent component, which will then get the line (from the
`detail` key) and then increment its quantity. See the section on [event handling](doc/reference/component.md#event-handling)
for more details on how events work.

Note that this example would have also worked if the `OrderLine` component
directly modifies the `line` object. However, this is not a good practice: this
only works because the `props` object received by the child component is reactive,
so the child component is then coupled to the parents implementation.

## License

OWL is [LGPL licensed](./LICENSE).
