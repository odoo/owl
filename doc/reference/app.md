# 🦉 App 🦉

## Content

- [Overview](#overview)
- [API](#api)
- [Configuration](#configuration)
- [`mount` helper](#mount-helper)
- [Loading templates](#loading-templates)

## Overview

Every Owl application has a root element, a set of templates, an environment and
possibly a few other settings. The `App` class is a simple class that represents
all of these elements. Here is an example:

```js
const {Component, App } = owl;

class MyComponent extends Component { ... }

const app = new App(MyComponent, { props: {...}, templates: "..."});
app.mount(document.body);
```

The basic workflow is: create an `App` instance configured with the root
component, the templates, and possibly other settings. Then, we mount that
instance somewhere in the DOM.

## API

- **`constructor(Root[, config])`**: first argument should be a component class (not
  an instance), and the optional second argument is a configuration object (see below).

- **`mount(target, options)`**: first argument is an html element, and the optional
  second argument is an object with mounting options (see below). Mount the app
  to a target in the DOM. Note that this is an asynchronous operation: the `mount`
  method returns a promise that resolves to the component instance whenever it
  is complete.

  The `option` object is an object with the following keys:

  - **`position (string)`**: either `first-child` or `last-child`. This option determines
    the position of the application in the target: either first or last child.

- **`destroy()`**: destroys the application

## Configuration

The `config` object is an object with some of the following keys:

- **`env (object)`**: if given, this will be the shared `env` given to each component
- **`props (object)`**: the props given to the root component
- **`dev (boolean, default=false)`**: if `true`, the application is rendered in
  [`dev` mode](#dev-mode);
- **`test (boolean, default=false)`**: `test` mode is the same as `dev` mode, except
  that Owl will not log a message to warn that Owl is in `dev` mode.
- **`translatableAttributes (string[])`**: a list of additional attributes that should
  be translated (see [translations](translations.md))
- **`translateFn (function)`**: a function that will be called by owl to translate
  templates (see [translations](translations.md))
- **`templates (string | xml document)`**: all the templates that will be used by
  the components created by the application.

## `mount` helper

Note that there is a `mount` helper to do that in just a line:

```js
const { mount, Component } = owl;

class MyComponent extends Component {
    ...
}

mount(MyComponent, document.body, { props: {...}, templates: "..."});
```

Here is the `mount` function signature:

**`mount(Component, target, config)`** with the following arguments:

- **`Component`**: a component class (Root component of the app)
- **`target`**: an html element, where the component will be mounted as last child
- **`config (optional)`**: a config object (the same as the App config object)

Most of the time, the `mount` helper is more convenient, but whenever one needs
a reference to the actual Owl App, then using the `App` class directly is
possible.

## Loading templates

Most applications will need to load templates whenever they start. Here is
what it could look like in practice:

```js
// in the main js file:
const { loadFile, mount } = owl;

// async, so we can use async/await
(async function setup() {
  const templates = await loadFile(`/some/endpoint/that/return/templates`);
  const env = {
    _t: someTranslateFn,
    templates,
    // possibly other stuff
  };

  mount(Root, document.body, { env });
})();
```

## Dev mode

Dev mode activates some additional checks and developer amenities:

- [Props validation](./props.md#props-validation) is performed
- [t-foreach](./templates.md#loops) loops check for key unicity
- Lifecycle hooks are wrapped to report their errors in a more developer-friendly way
