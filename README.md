<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">Owl Framework</a> 🦉</h1>

 [![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)
[![npm version](https://badge.fury.io/js/@odoo%2Fowl.svg)](https://badge.fury.io/js/@odoo%2Fowl)
[![Downloads](https://img.shields.io/npm/dm/@odoo%2Fowl.svg)](https://www.npmjs.com/package/@odoo/owl)

_Class based components with hooks, reactive state and concurrent mode_

**Try it online!** you can experiment with the Owl framework in an online [playground](https://odoo.github.io/owl/playground).

## Project Overview

The Odoo Web Library (Owl) is a smallish (~<20kb gzipped) UI framework built by
[Odoo](https://www.odoo.com/) for its products. Owl is a modern
framework, written in Typescript, taking the best ideas from React and Vue in a
simple and consistent way. Owl's main features are:

- a declarative component system,
- a reactivity system based on hooks,
- concurrent mode by default,

Owl components are defined with ES6 classes and xml templates, uses an
underlying virtual DOM, integrates beautifully with hooks, and the rendering is
asynchronous.

Quick links:

- [documentation](#documentation),
- [changelog](CHANGELOG.md) (from Owl 1.x to 2.x),
- [playground](https://odoo.github.io/owl/playground)

## Example

Here is a short example to illustrate interactive components:

```javascript
const { Component, useState, mount, xml } = owl;

class Counter extends Component {
  static template = xml`
    <button t-on-click="() => state.value++">
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

mount(App, document.body);
```

Note that the counter component is made reactive with the [`useState` hook](doc/reference/hooks.md#usestate).
Also, all examples here uses the [`xml` helper](doc/reference/tags.md#xml-tag) to define inline templates.
But this is not mandatory, many applications will load templates separately.

More interesting examples can be found on the
[playground](https://odoo.github.io/owl/playground) application.

## Documentation

### Learning Owl

Are you new to Owl? This is the place to start!

- [Tutorial: create a TodoList application](doc/learning/tutorial_todoapp.md)
- [Quick Overview](doc/learning/overview.md)
- [How to start an Owl project](doc/learning/quick_start.md)
- [How to test Components](doc/learning/how_to_test.md)
- [How to write Single File Components](doc/learning/how_to_write_sfc.md)

### Reference

You will find here a complete reference of every feature, class or object
provided by Owl.

- [Animations](doc/reference/animations.md)
- [Browser](doc/reference/browser.md)
- [Component](doc/reference/component.md)
- [Content](doc/reference/content.md)
- [Concurrency Model](doc/reference/concurrency_model.md)
- [Configuration](doc/reference/config.md)
- [Context](doc/reference/context.md)
- [Environment](doc/reference/environment.md)
- [Event Bus](doc/reference/event_bus.md)
- [Event Handling](doc/reference/event_handling.md)
- [Error Handling](doc/reference/error_handling.md)
- [Hooks](doc/reference/hooks.md)
- [Mounting a component](doc/reference/mounting.md)
- [Miscellaneous Components](doc/reference/misc.md)
- [Observer](doc/reference/observer.md)
- [Props](doc/reference/props.md)
- [Props Validation](doc/reference/props_validation.md)
- [QWeb Templating Language](doc/reference/qweb_templating_language.md)
- [QWeb Engine](doc/reference/qweb_engine.md)
- [Slots](doc/reference/slots.md)
- [Tags](doc/reference/tags.md)
- [Utils](doc/reference/utils.md)

### Other Topics

This section provides miscellaneous document that explains some topics
which cannot be considered either a tutorial, or reference documentation.

- [Owl architecture: the Virtual DOM](doc/miscellaneous/vdom.md)
- [Owl architecture: the rendering pipeline](doc/miscellaneous/rendering.md)
- [Comparison with React/Vue](doc/miscellaneous/comparison.md)
- [Why did Odoo built Owl?](doc/miscellaneous/why_owl.md)



## Installing Owl

Owl is available on `npm` and can be installed with the following command:

```
npm install @odoo/owl
```

If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl-1.4.10](https://github.com/odoo/owl/releases/tag/v1.4.10)

