# 🦉 Tooling 🦉


To help work/improve/learn with OWL, we have here:

- a benchmarks application
- a playground application

Both of them can be accessed by using a static http server.  A simple python
server is available in `server.py`.  There is also a npm script to start it:
`npm run extras` (and its version with a watcher: `npm run extras:watch`).


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

## Benchmarks

The benchmarks application is a very small application, implemented in different
frameworks, and in different versions of Owl.  This is a simple internal tool,
useful to compare various performance metrics on some tasks.

## Playground

The playground is an important application designed to help learning and
experimenting with Owl.  It is available [online](https://odoo.github.io/owl/playground/).
