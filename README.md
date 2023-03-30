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
- a fine grained reactivity system similar to Vue,
- hooks
- fragments
- asynchronous rendering

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
    <button t-on-click="() => state.value = state.value + props.increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>`;

  state = useState({ value: 0 });
}

class Root extends Component {
  static template = xml`
    <span>Hello Owl</span>
    <Counter increment="2"/>`;

  static components = { Counter };
}

mount(Root, document.body);
```

Note that the counter component is made reactive with the [`useState` hook](doc/reference/hooks.md#usestate).
Also, all examples here uses the [`xml` helper](doc/reference/templates.md#inline-templates) to define inline templates.
But this is not mandatory, many applications will load templates separately.

More interesting examples can be found on the
[playground](https://odoo.github.io/owl/playground) application.

## Documentation

### Learning Owl

Are you new to Owl? This is the place to start!

- [Tutorial: create a TodoList application](doc/learning/tutorial_todoapp.md)
- [How to start an Owl project](doc/learning/quick_start.md)
- [How to test Components](doc/learning/how_to_test.md)

### Reference

- [Overview](doc/readme.md)
- [App](doc/reference/app.md)
- [Component](doc/reference/component.md)
- [Component Lifecycle](doc/reference/component.md#lifecycle)
- [Concurrency Model](doc/reference/concurrency_model.md)
- [Dev mode](doc/reference/app.md#dev-mode)
- [Dynamic sub components](doc/reference/component.md#dynamic-sub-components)
- [Environment](doc/reference/environment.md)
- [Error Handling](doc/reference/error_handling.md)
- [Event Handling](doc/reference/event_handling.md)
- [Form Input Bindings](doc/reference/input_bindings.md)
- [Fragments](doc/reference/templates.md#fragments)
- [Hooks](doc/reference/hooks.md)
- [Loading Templates](doc/reference/app.md#loading-templates)
- [Mounting a component](doc/reference/app.md#mount-helper)
- [Portal](doc/reference/portal.md)
- [Precompiling templates](doc/reference/precompiling_templates.md)
- [Props](doc/reference/props.md)
- [Props Validation](doc/reference/props.md#props-validation)
- [Reactivity](doc/reference/reactivity.md)
- [Rendering SVG](doc/reference/templates.md#rendering-svg)
- [Refs](doc/reference/refs.md)
- [Slots](doc/reference/slots.md)
- [Sub components](doc/reference/component.md#sub-components)
- [Sub templates](doc/reference/templates.md#sub-templates)
- [Templates (Qweb)](doc/reference/templates.md)
- [Translations](doc/reference/translations.md)
- [Utils](doc/reference/utils.md)

### Other Topics

- [Notes On Owl Architecture](doc/miscellaneous/architecture.md)
- [Comparison with React/Vue](doc/miscellaneous/comparison.md)
- [Why did Odoo build Owl?](doc/miscellaneous/why_owl.md)
- [Changelog (from owl 1.x to 2.x)](CHANGELOG.md)
- [Notes on compiled templates](doc/miscellaneous/compiled_template.md)
- [Owl devtools extension](doc/tools/devtools.md)

## Installing Owl

Owl is available on `npm` and can be installed with the following command:

```
npm install @odoo/owl
```
If you want to use a simple `<script>` tag, the last release can be downloaded here:

- [owl](https://github.com/odoo/owl/releases/latest)

## Installing Owl devtools

The Owl devtools browser extension is also available in the [release](https://github.com/odoo/owl/releases/latest):
Unzip the owl-devtools.zip file and follow the instructions depending on your browser:

### Chrome

Go to your chrome extensions admin panel, activate developer mode and click on `Load unpacked`.
Select the devtools-chrome folder and that's it, your extension is active! 
There is a convenient refresh button on the extension card (still on the same admin page) to update your code. 
Do note that if you got some problems, you may need to completly remove and reload the extension to completly refresh the extension.

### Firefox 
Go to the address about:debugging#/runtime/this-firefox and click on `Load temporary Add-on...`.
Select any file in the devtools-firefox folder and that's it, your extension is active! 
Here, you can use the reload button to refresh the extension.

Note that you may have to open another window or reload your tab to see the extension working.
Also note that the extension will only be active on pages that have a sufficient version of owl.


