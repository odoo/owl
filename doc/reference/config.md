# 🦉 Config 🦉

The Owl framework is designed to work in many situations. However, it is
sometimes necessary to customize some behaviour. This is done by using the
global `config` object. It provides two settings:

- [`mode`](#mode) (default value: `prod`),
- [`enableTransitions`](#enabletransitions) (default value: `true`).

## Mode

By default, Owl is in _production_ mode, this means that it will try to do its
job fast, and skip some expensive operations. However, it is sometimes necessary
to have better information on what is going on, this is the purpose
of the `dev` mode.

Owl has a mode flag, in `owl.config.mode`. Its default value is `prod`, but
it can be set to `dev`:

```js
owl.config.mode = "dev";
```

Note that templates compiled with the `prod` settings will not be recompiled.
So, changing this setting is best done at startup.

An important job done by the `dev` mode is to validate props for each component
creation and update. Also, extra props will cause an error.

## `enableTransitions`

Transitions are usually nice, but they can cause issues in some specific cases,
such as automated tests. It is uncomfortable having to wait for a transition
to end before moving to the next step.

To solve this issue, Owl can be configured to ignore the `t-transition` directive.
To do that, one only needs to set the `enableTransitions` flag to false:

```js
owl.config.enableTransitions = false;
```

Note that it suffers from the same drawback as the "dev" mode: all compiled
templates, if any, will keep their current behaviours.
