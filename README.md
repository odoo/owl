<h1 align="center">🦉 Odoo Web Library 🦉</h1>

## Project Overview

The Odoo Web Library (OWL) is a small (currently around 11k minified and gzipped)
framework intended to be the basis for the Odoo Web Client, and hopefully many
other Odoo related projects.

Briefly, the OWL framework contains:

- a declarative component system, with a virtual dom based on a fork of Snabbdom
- and a store (state management solution, loosely inspired by VueX and React/Redux)

The component system is designed to be:

1. **declarative:** the user interface should be described in term of the state
   of the application, not as a sequence of imperative steps.

2. **composable:** each widget can seamlessly be created in a parent widget by
   a simple directive in its template.

3. **asynchronous rendering:** the framework will transparently wait for each
   subwidgets to be ready before applying the rendering. It uses native promises
   under the hood.

4. **uses QWeb as a template system:** the templates are described in XML
   and follow the QWeb specification. This is a requirement for Odoo.

## Try it online

You can experiment with the OWL project online: [https://odoo.github.io/owl/](https://odoo.github.io/owl/)

## Installing/Building

Some npm scripts are available:

| Command            | Description                                               |
| ------------------ | --------------------------------------------------------- |
| npm install        | install every dependency required for this project        |
| npm run build      | build a bundle of _owl_ in the _/dist/_ folder            |
| npm run build:es5  | build a bundle of _owl_ in the _/dist/_ folder (ES5 code) |
| npm run minify     | minify the prebuilt owl.js file                           |
| npm run test       | run all tests                                             |
| npm run test:watch | run all tests, and keep a watcher                         |

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
  inlineTemplate = `<div>Hello <t t-esc="props.name"/></div>`;
}

const env = {
  qweb: new owl.core.QWeb()
};

const hello = new HelloWorld(env, { name: "World" });
hello.mount(document.body);
```

The next example show interactive widgets, and how widget
composition works:

```javascript
class ClickCounter extends owl.core.Component {
  inlineTemplate = `
    <div>
      <button t-on-click="increment">Click Me! [<t t-esc="state.value"/>]</button>
    </div>`;

  constructor(parent, props) {
    super(parent, props);
    this.state = { value: 0 };
  }

  increment() {
    this.state.value++;
  }
}

class App extends owl.core.Component {
  inlineTemplate = `
    <div>
        <t t-widget="ClickCounter"/>
    </div>`;

  widgets = { ClickCounter };
}

const env = {
  qweb: new owl.core.QWeb()
};

const app = new App(env);
app.mount(document.body);
```

More interesting examples can be found on the playground application: [https://odoo.github.io/owl/](https://odoo.github.io/owl/).

## License

OWL is [GPL licensed](./LICENSE).
