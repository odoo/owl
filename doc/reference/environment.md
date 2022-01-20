# 🦉 Environment 🦉

## Content

- [Overview](#overview)
- [Setting an Environment](#setting-an-environment)
- [Using a sub environment](#using-a-sub-environment)
- [Content of an Environment](#content-of-an-environment)

## Overview

An environment is a shared object given to all components in a tree. It is not
used by Owl itself, but it is useful for application developers to provide a
simple communication channel between components (in addition to the props).

The `env` given to the [`App`](app.md) is assigned to the `env` component
property.

```
    Root
    /  \
   A    B
```

Note that `env` object is frozen when the application is started (unless the `unsafeEnv` [setting](app.md#configuration) is activated). This is done
to ensure a simpler mental model of what's happening in runtime. Note that it
is only shallowly frozen, so sub objects can be modified.

## Setting an environment

The correct way to customize an environment is to simply give it to the `App`,
whenever it is created.

```js
const env = {
    _t: myTranslateFunction,
    user: {...},
    services: {
        ...
    },
};

new App(Root, { env }).mount(document.body);

// or alternatively
mount(App, document.body, { env });
```

## Using a sub environment

It is sometimes useful to add one (or more) specific keys to the environment,
from the perspective of a specific component and its children. In that case, the
solution presented above will not work, since it sets the global environment.

There is a hook for this situation: [`useSubEnv`](hooks.md#usesubenv).

```js
class SomeComponent extends Component {
  setup() {
    useSubEnv({ myKey: someValue }); // myKey is now available for all child components
  }
}
```

## Content of an Environment

The `env` object content is totally up to the application developer. However,
some good use cases for additional keys in the environment are:

- some configuration keys,
- session information,
- generic services (such as doing rpcs).
- other utility functions that one want to inject, such as a translation function.

Doing it this way means that components are easily testable: we can simply
create a test environment with mock services.
