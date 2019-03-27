**Warning!**

This is currently a proof of concept, definitely not a production-ready codebase.
We hope to use it in the Odoo web client soon.

---

# 🦉 Odoo Web Lab 🦉

## Overview

Odoo Web Lab (OWL) is a project to collect some useful, reusable, well designed
building block for building web applications.

However, since this is the basis for the Odoo web client, we will not hesitate to design
the code here to better match the Odoo architecture/design principles.

Currently, this repository contains:

- some utility functions/classes
- an implementation/extension of the QWeb template engine that outputs a virtual
  dom (using the snabbdom library)
- a Component class, which uses the QWeb engine as its underlying rendering
  mechanism. The component class is designed to be declarative, with
  asynchronous rendering.

In the future, this repository may includes other features. Here are some possible
ideas:

- a (frontend) router could be included.
- a store base class (as in the flux/redux architecture)

Note: the code is written in typescript. This does not mean that the main web
client will ever be converted to typescript (even though I would really like it).

## Main scripts

To install every dependency needed to play with this code:

```
npm install
```

To build a bundle of this as a library:

```
npm run build
```

To run tests:

```
npm run test
npm run test:watch
```

Note that the test scripts also run the example tests suites.

## Documentation

- [Quick Start](doc/quick_start.md)
- [Component](doc/component.md)
- [QWeb](doc/qweb.md)

# Examples

Here is a minimal Hello World example:

```javascript
class HelloWorld extends owl.core.Component {
  inlineTemplate = `<div>Hello <t t-esc="state.name"/></div>`;
}

const env = {
  qweb: new owl.core.QWeb()
};

const hello = new HelloWorld(env, { name: "World" });
hello.mount(document.body);
```

The next example show how interactive widgets can be created and how widget
composition works:

```javascript
class Counter extends owl.core.Component {
  inlineTemplate = `
    <div>
      <button t-on-click="increment(-1)">-</button>
      <span style="font-weight:bold">Value: <t t-esc="state.value"/></span>
      <button t-on-click="increment(1)">+</button>
    </div>`;

  constructor(parent, props) {
    super(parent, props);
    this.state = {
      value: props.initialState || 0
    };
  }

  increment(delta) {
    this.updateState({ value: this.state.value + delta });
  }
}

class App extends owl.core.Component {
  inlineTemplate = `
    <div>
        <t t-widget="Counter" t-props="{initialState: 1}"/>
        <t t-widget="Counter" t-props="{initialState: 42}"/>
    </div>`;

  widgets = { Counter };
}

const env = {
  qweb: new owl.core.QWeb()
};

const app = new App(env);
app.mount(document.body);
```

More interesting examples on how to work with this web framework can be found in the _examples/_ folder:

- [Todo Application](examples/readme.md#todo-app)
- [Web Client](examples/readme.md#web-client-example)
- [Benchmarks](examples/readme.md#benchmarks)
