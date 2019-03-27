# 🦉 Odoo Web Lab 🦉

## Overview

Odoo Web Lab (OWL) is a project to collect some useful, reusable, (hopefully)
well designed building blocks for building web applications.

However, since this is the basis for the Odoo web client, we will not hesitate
to design the code here to better match the Odoo architecture/design principles.

This project is also a playground to experiment with some ideas related to web
technologies.

Currently, this repository contains:

1. **core**

   - an implementation/extension of the QWeb template engine that outputs a virtual
     dom (using the snabbdom library)
   - a Component class, which uses the QWeb engine as its underlying rendering
     mechanism. The component class is designed to be declarative, with
     asynchronous rendering.
   - some utility functions/classes

2. **extras**
   - a Store class and a connect function, to help manage the state of an application (like react-redux)
   - a Registry: this is a simple key/store mapping

In the future, this repository may includes other features. Here are some
ideas:

- a (frontend) router could be included.
- basic infrastructure code for web views (form/list/kanban)
- a mechanism to aggregate/query/dispatch rpcs (a little bit like graphql)

Note: the code is written in typescript. This does not mean that the main web
client will ever be converted to typescript (even though I would really like it).

---

**Warning!**

This is currently a proof of concept, not yet production-ready.

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
