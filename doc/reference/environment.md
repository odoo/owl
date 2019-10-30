# 🦉 Environment 🦉

An environment is an object which contains a [`QWeb` instance](qweb.md). Whenever a root component is created, it is assigned an environment. This environment
is then automatically given to each sub component (and accessible in the `this.env` property).

```
    Root
    /  \
   A    B
```

This way, all components share the same `QWeb` instance.

Note: some additional information can be found here:

- [What should go into an environment?](../learning/environment.md)
- [Customizing an environment](config.md#env)

