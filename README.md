<h1 align="center">🦉 Odoo Web Library 🦉</h1>

## Project Overview

The Odoo Web Library (OWL) is a small 
UI framework intended to be the basis for the [Odoo](https://www.odoo.com/) Web Client, and hopefully many
other Odoo related projects. OWL's two key features are:

- a declarative component system, with QWeb as a template engine, asynchronous rendering, and an underlying virtual dom,
- and a store (state management solution, loosely inspired by VueX and React/Redux).

If you are interested, you can find a discussion on what makes OWL different
from React and Vue [here](doc/comparison.md)

## Try it online!

An online playground is available at [https://odoo.github.io/owl/](https://odoo.github.io/owl/) to let you experiment with the OWL framework.

# Example

Here is a short example to illustrate interactive widgets:

```javascript
class ClickCounter extends owl.Component {
  inlineTemplate = `
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  constructor(parent, props) {
    super(parent, props);
    this.state = { value: 0 };
  }

  increment() {
    this.state.value++;
  }
}

const qweb = new owl.QWeb();
const counter = new ClickCounter({qweb});
counter.mount(document.body);
```

More interesting examples can be found on the [playground](https://odoo.github.io/owl/) application.

## Installing/Building

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-0.7.0.js](https://odoo.github.io/owl/releases/owl-0.7.0.js)
- [owl-0.7.0.min.js](https://odoo.github.io/owl/releases/owl-0.7.0.min.js)

Some npm scripts are available:

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm install`        | install every dependency required for this project |
| `npm run build`      | build a bundle of _owl_ in the _/dist/_ folder     |
| `npm run minify`     | minify the prebuilt owl.js file                    |
| `npm run test`       | run all tests                                      |
| `npm run test:watch` | run all tests, and keep a watcher                  |

## Documentation

The complete documentation can be found [here](doc/readme.md). The most important sections are:

- [Quick Start](doc/quick_start.md)
- [Component](doc/component.md)
- [Store](doc/store.md)

## License

OWL is [GPL licensed](./LICENSE).
