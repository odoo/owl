<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">Odoo Web Library</a> 🦉</h1>

## Project Overview

The Odoo Web Library (OWL) is a small 
UI framework intended to be the basis for the [Odoo](https://www.odoo.com/) Web Client, and hopefully many
other Odoo related projects. OWL's main feature is a _declarative component system_, with QWeb as a template engine, asynchronous rendering, and an underlying virtual dom.

If you are interested, you can find a discussion on what makes OWL different
from React and Vue [here](doc/comparison.md)

## What makes OWL different

- **XML based**: templates are based on the XML format, which allows interesting
  applications.  For example, they could be stored in a database and modified
  dynamically with `xpaths`.
- **templates compilation in the browser**: this may not be a good fit for all
  applications, but if you need to generate dynamically user interfaces in the
  browser, this is very powerful.  For example, a generic form view component
  could generate a specific form user interface for each various models, from a XML view.
- **no toolchain required**: this is extremely useful for some applications, if,
  for various reasons (security/deployment/dynamic modules/specific assets tools),
  it is not ok to use standard web tools based on `npm`.


## Try it online!

An online playground is available at [https://odoo.github.io/owl/playground](https://odoo.github.io/owl/playground) to let you experiment with the OWL framework.

# Example

Here is a short example to illustrate interactive widgets:

```javascript
class ClickCounter extends owl.Component {
  inlineTemplate = `
    <button t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = { value: 0 };

  increment() {
    this.state.value++;
  }
}

const qweb = new owl.QWeb();
const counter = new ClickCounter({qweb});
counter.mount(document.body);
```

More interesting examples can be found on the [playground](https://odoo.github.io/owl/playground) application.

## Installing/Building

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-0.8.0.js](https://github.com/odoo/owl/releases/download/v0.8.0/owl-0.8.0.js)
- [owl-0.8.0.min.js](https://github.com/odoo/owl/releases/download/v0.8.0/owl-0.8.0.min.js)

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
