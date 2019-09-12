<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">Odoo Web Library</a> 🦉</h1>

_A web framework for structured, dynamic and maintainable applications_

## Project Overview

The Odoo Web Library (OWL) is a small (~16kb gzipped) UI framework intended to be the basis for
the [Odoo](https://www.odoo.com/) Web Client, and hopefully many other Odoo
related projects. OWL's main features are:

- a _declarative component system_, (template based, with asynchronous rendering and a virtual dom)
- a store implementation (for state management)
- a small frontend router

**Try it online!** An online playground is available at [https://odoo.github.io/owl/playground](https://odoo.github.io/owl/playground) to let you experiment with the OWL framework.

## Example

Here is a short example to illustrate interactive components:

```javascript
import { Component, QWeb } from 'owl'
import { xml } from 'owl/tags'

class Counter extends Component {
  static template = xml`
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = { value: 0 };

  increment() {
    this.state.value++;
  }
}

class App extends Component {
  static template = xml`
    <div>
      <span>Hello Owl</span>
      <Counter />
    </div>`;

  static components = { Counter };

}

const app = new App({ qweb: new QWeb() });
app.mount(document.body);
```

More interesting examples can be found on the
[playground](https://odoo.github.io/owl/playground) application.

## OWL's Design Principles

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

If you are interested in a comparison with React or Vue, you will
find some more information [here](doc/comparison.md).

## Documentation

The complete documentation can be found [here](doc/readme.md). The most important sections are:

- [Quick Start](doc/quick_start.md)
- [Component](doc/component.md)
- [QWeb](doc/qweb.md)

Found an issue in the documentation? A broken link? Some outdated information?
Submit a PR!

## Installing/Building

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-0.21.0.js](https://github.com/odoo/owl/releases/download/v0.21.0/owl.js)
- [owl-0.21.0.min.js](https://github.com/odoo/owl/releases/download/v0.21.0/owl.min.js)

Some npm scripts are available:

| Command               | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `npm install`         | install every dependency required for this project                           |
| `npm run build`       | build a bundle of _owl_ in the _/dist/_ folder                               |
| `npm run minify`      | minify the prebuilt owl.js file                                              |
| `npm run test`        | run all tests                                                                |
| `npm run test:watch`  | run all tests, and keep a watcher                                            |
| `npm run tools`       | build tools applications, start a static server (see [here](doc/tooling.md)) |
| `npm run tools:watch` | same as `tools`, but with a watcher to rebuild owl                           |

## License

OWL is [LGPL licensed](./LICENSE).
