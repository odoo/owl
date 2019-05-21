# 🦉 Tooling 🦉

## Development mode

By default, Owl is in *production* mode, this means that it will try to do its
job fast, and skip some expensive operations.  However, in some cases, it is
convenient to have better information on what is going on, this is the purpose
of the dev mode.

Owl has a mode flag, in `owl.__info__.mode`.  Its default value is `prod`, but
it can be set to `dev`:

```js
owl.__info__.mode = 'dev';
```

Note that templates compiled with the `prod` settings will not be recompiled.
So, changing this setting is best done at startup.