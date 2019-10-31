# 🦉 Environment 🦉

An environment is an object which contains a [`QWeb` instance](qweb.md). Whenever
a root component is created, it is assigned an environment (see
[below](#setting-an-environment) for more info on this). This environment is
then automatically given to each sub component (and accessible in the `this.env`
property).

```
    Root
    /  \
   A    B
```

This way, all components share the same `QWeb` instance.

Note: some additional information about what should go into an environment
can be found in the [learning section](../learning/environment.md).

## Setting an environment

An Owl application needs an [environment](environment.md) to be executed. The
environment has an important key: the [QWeb](qweb.md) instance, which will render
all templates.

Whenever a root component `App` is mounted, Owl will setup a valid environment by
following the next steps:

- take the `env` object defined on `App.env` (if no `env` was explicitely setup,
  this will be return the empty `env` object defined on `Component`)
- if `env.qweb` is not set, then Owl will create a `QWeb` instance.

The correct way to customize an environment is to simply set it up on the root
component class, before the first component is created:

```js
App.env = {
    _t: myTranslateFunction,
    user: {...},
    services: {
        ...
    },
};
const app = new App();
app.mount(document.body);
```

It is also possible to simply share an environment between all root components,
by simply doing this:

```js
Component.env = myEnv; // will be the default env for all components
```
