# 🦉 Mounting an application 🦉

## Content

- [Overview](#overview)
- [API](#api)

## Overview

Mounting an Owl application is done by using the `mount` method (available in
`owl.mount` if you are using the iife build, or it can be directly imported
from `owl` if you are using a module system):

```js
const mount = { owl }; // if owl is available as an object

const env = { ... };
const app = await mount(MyComponent, { target: document.body, env });
```

Another example:

```js
const config = {
  env: ...,
  props: ...,
  target: document.body,
  position: "self",
};
const app = await mount(App, config);
```

A common way to initialize an application is to first setup an environment,
then to call the `mount` method.

## API

Mount takes two parameters:

- `C`, which should be a component class (NOT instance),
- `params`, which is an object with the following keys:
  - `target (HTMLElement | DocumentFragment)`: the target of the mount operation
  - `env (optional, Env)` an environment
  - `position (optional, "first-child" | "last-child" | "self")` the position
    where it should be mounted (see below for more informations)
  - `props (optional, any)`: some initial values that are given as props. Useful
    when the root component is configurable, or when testing sub components

Here are the various positions supported by Owl:

- `first-child`: with this option, the component will be prepended inside the target,
- `last-child` (default value): with this option, the component will be
  appended in the target element,
- `self`: the target will be used as the root element for the component. This
  means that the target has to be an HTMLElement (and not a document fragment).
  In this situation, it is possible that the component cannot be unmounted. For
  example, if its target is `document.body`.

The `mount` method returns a promise that resolves to the instance of the created
component.
