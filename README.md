<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">Odoo Web Library</a> 🦉</h1>

_A web framework for structured, dynamic and maintainable applications_

## Project Overview

The Odoo Web Library (OWL) is a small
UI framework intended to be the basis for the [Odoo](https://www.odoo.com/) Web Client, and hopefully many
other Odoo related projects. OWL's main feature is a _declarative component system_, with QWeb as a template engine, asynchronous rendering, and an underlying virtual dom.

**Try it online!** An online playground is available at [https://odoo.github.io/owl/playground](https://odoo.github.io/owl/playground) to let you experiment with the OWL framework.

## OWL's design principles

OWL is designed to be used in highly dynamic applications where changing
requirements are common, code needs to be maintained by large teams.

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

Owl is not designed to be fast or small (even though it is quite good on those
two topics). If you are interested in a comparison with React or Vue, you will
find some more information [here](doc/comparison.md).

# Example

Here is a short example to illustrate interactive widgets:

```javascript
class ClickCounter extends owl.Component {
  state = { value: 0 };

  increment() {
    this.state.value++;
  }
}

const TEMPLATES = `
    <button t-name="ClickCounter" t-on-click="increment">
        Click Me! [<t t-esc="state.value"/>]
    </button>`;

const qweb = new owl.QWeb(TEMPLATES);
const counter = new ClickCounter({ qweb });
counter.mount(document.body);
```

More interesting examples can be found on the [playground](https://odoo.github.io/owl/playground) application.

## Installing/Building

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-0.11.0.js](https://github.com/odoo/owl/releases/download/v0.11.0/owl.js)
- [owl-0.11.0.min.js](https://github.com/odoo/owl/releases/download/v0.11.0/owl.min.js)

Some npm scripts are available:

| Command                | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `npm install`          | install every dependency required for this project                              |
| `npm run build`        | build a bundle of _owl_ in the _/dist/_ folder                                  |
| `npm run minify`       | minify the prebuilt owl.js file                                                 |
| `npm run test`         | run all tests                                                                   |
| `npm run test:watch`   | run all tests, and keep a watcher                                               |
| `npm run extras`       | build extras applications, start a static server (see [here](extras/readme.md)) |
| `npm run extras:watch` | same as `extras`, but with a watcher to rebuild owl                             |

## Documentation

The complete documentation can be found [here](doc/readme.md). The most important sections are:

- [Quick Start](doc/quick_start.md)
- [Component](doc/component.md)
- [QWeb](doc/qweb.md)

## License

OWL is [GPL licensed](./LICENSE).
