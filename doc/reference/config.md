# 🦉 Config 🦉

The Owl framework is designed to work in many situations. However, it is
sometimes necessary to customize some behaviour. This is done by using the
global `config` object. It currently has one key:

- [`mode`](#mode).

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
