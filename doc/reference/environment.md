# 🦉 Environment 🦉

## Content

- [Overview](#overview)
- [Setting an Environment](#setting-an-environment)
- [Content of an Environment](#content-of-an-environment)

## Overview

An environment is an object which contains a [`QWeb` instance](qweb_engine.md). Whenever
a root component is created, it is assigned an environment (see
[below](#setting-an-environment) for more info on this). This environment is
then automatically given to each sub component (and accessible in the `this.env`
property).

```
    Root
    /  \
   A    B
```

This way, all components share the same `QWeb` instance. Owl internally requires
that the environment has a `qweb` key which maps to a
[`QWeb`](qweb_engine.md) instance. This is the QWeb instance that will be used to
render each templates in this specific component tree. Note that if no `QWeb`
instance is provided, Owl will simply generate it on the fly.

The environment is mostly static. Each application is free to add anything to
the environment, which is very useful, since this can be accessed by each sub
component.

## Setting an environment

An Owl application needs an [environment](environment.md) to be executed. The
environment has an important key: the [QWeb](qweb_engine.md) instance, which will render
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

## Content of an Environment

Some good use cases for additional keys in the environment are:

- some configuration keys,
- session information,
- generic services (such as doing rpcs, or accessing local storage).

Doing it this way means that components are easily testable: we can simply
create a test environment with mock services.

For example:

```js
async function myEnv() {
  const templates = await loadTemplates();
  const qweb = new QWeb({ templates });
  const session = getSession();

  return {
    _t: myTranslateFunction,
    session: session,
    qweb: qweb,
    services: {
      localStorage: localStorage,
      rpc: rpc
    },
    debug: false,
    inMobileMode: true
  };
}

async function start() {
  App.env = await myEnv();
  const app = new App();
  await app.mount(document.body);
}
```
