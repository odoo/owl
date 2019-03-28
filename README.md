# 🦉 Odoo Web Lab 🦉

## Project Overview

Odoo Web Lab (OWL) is a project to collect some useful, reusable, (hopefully)
well designed building blocks for building web applications. However, since this is the basis for the Odoo web client, we will not hesitate
to design the code here to better match the Odoo architecture/design principles.

The most important element of this repository is certainly the component system.
It is designed to be:

1. **declarative:** the user interface should be described in term of the state
   of the application, not as a sequence of imperative steps.

2. **composable:** each widget can seamlessly be created in a parent widget by
   a simple directive in its template.

3. **asynchronous rendering:** the framework will transparently wait for each
   subwidgets to be ready before applying the rendering. It uses native promises
   under the hood.

4. **uses QWeb as a template system:** the templates are described in XML
   and follow the QWeb specification. This is a requirement for Odoo.

5. **with an imperative escape hatch:** if necessary, sub widgets can easily be
   manually created/destroyed.

Note: the code is written in typescript. This does not mean that the main web
client will ever be converted to typescript (even though I would really like it).

## Installing/Building

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

The complete documentation can be found [here](doc/readme.md). The most important sections are:

- [Quick Start](doc/quick_start.md)
- [Tutorial](doc/tutorial.md)
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

## License

React is [GPL licensed](./LICENSE).
