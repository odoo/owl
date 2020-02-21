<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">OWL Framework</a> 🦉</h1>

_Class based components with hooks, reactive state and concurrent mode_

## Project Overview

The Odoo Web Library (OWL) is a smallish (~<20kb gzipped) UI framework intended to
be the basis for the [Odoo](https://www.odoo.com/) Web Client. Owl is a modern
framework, written in Typescript, taking the best ideas from React and Vue in a
simple and consistent way. Owl's main features are:

- a declarative component system,
- a reactivity system based on hooks,
- concurrent mode by default,
- a store and a frontend router

Owl components are defined with ES6 classes, they use QWeb templates, an
underlying virtual DOM, integrates beautifully with hooks, and the rendering is
asynchronous.

**Try it online!** An online playground is available at
[https://odoo.github.io/owl/playground](https://odoo.github.io/owl/playground)
to let you experiment with the Owl framework. There are some code examples to
showcase some interesting features.

Owl is currently stable.  Possible future changes are explained in the
[roadmap](roadmap.md).

## Why Owl?

Why did Odoo decide to make Yet Another Framework?  This is really a question
that deserves [a long answer](doc/miscellaneous/why_owl.md). But in short, we believe that
while the current state of the art frameworks are excellent, they are not
optimized for our use case, and there is still room for something else.

If you are interested in a comparison with React or Vue, you will
find some more additional information [here](doc/miscellaneous/comparison.md).

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
one way to define components (with classes). There is no black magic. It just
works.


## Documentation

A complete documentation for Owl can be found here:

- [Main documentation page](doc/readme.md).

Some of the most important pages are:

- [Tutorial: TodoList application](doc/learning/tutorial_todoapp.md)
- [How to start an Owl project](doc/learning/quick_start.md)
- [QWeb templating language](doc/reference/qweb_templating_language.md)
- [Component](doc/reference/component.md)
- [Hooks](doc/reference/hooks.md)


## Installing Owl

Owl is available on `npm` and can be installed with the following command:

```
npm install @odoo/owl
```

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-1.0.5.js](https://github.com/odoo/owl/releases/download/v1.0.5/owl.js)
- [owl-1.0.5.min.js](https://github.com/odoo/owl/releases/download/v1.0.5/owl.min.js)

## License

OWL is [LGPL licensed](./LICENSE).
