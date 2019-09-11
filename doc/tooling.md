# 🦉 Tooling 🦉

## Content

- [Overview](#overview)
- [Development Mode](#development-mode)
- [Playground](#playground)
- [Benchmarks](#benchmarks)

## Overview

To help work with/improve/learn OWL, there are a few extras tools/settings.

- development mode: enable better error reporting for the developer
- a playground application: a space to experiment and learn Owl.
- a benchmarks application: allow comparison with a few common frameworks

The two applications are available in the `tools/` folder, and can be accessed
by using a static http server. A simple python
server is available in `server.py`. There is also a npm script to start it:
`npm run tools` (and its version with a watcher: `npm run tools:watch`).

## Development Mode

By default, Owl is in _production_ mode, this means that it will try to do its
job fast, and skip some expensive operations. However, in some cases, it is
convenient to have better information on what is going on, this is the purpose
of the dev mode.

Owl has a mode flag, in `owl.__info__.mode`. Its default value is `prod`, but
it can be set to `dev`:

```js
owl.__info__.mode = "dev";
```

Note that templates compiled with the `prod` settings will not be recompiled.
So, changing this setting is best done at startup.

An important job done by the `dev` mode is to validate props for each component
creation and update. Also, extra props will cause an error.

## Playground

The playground is an important application designed to help learning and
experimenting with Owl. The last published version of Owl can be tested [online](https://odoo.github.io/owl/playground/).

It is an application similar to `jsFiddle`, but specialized for Owl: there are
three tabs (`js`, `css` and `xml`), and a simple button `Run` to execute that
code in an iframe.

## Benchmarks

Note: This is more an internal tool, useful for people working on Owl.

The benchmarks application is a very small application, implemented in different
frameworks, and in different versions of Owl. This is a simple internal tool,
useful to compare various performance metrics on some tasks.
