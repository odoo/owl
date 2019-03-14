**Warning!**

This is currently a proof of concept, definitely not a production-ready codebase.
We hope to use it in the Odoo web client soon.

---

# Core Utility for Odoo Web Client

## Overview

This repository contains some useful building block for building web applications.
We made some efforts to make sure the code is reusable and generic. However, since this is the basis for the Odoo web client, we will not hesitate to design
the code here to better match the Odoo architecture/design principles.

Currently, this repository contains:

- some utility functions/classes
- an implementation/extension of the QWeb template engine that outputs a virtual
  dom (using the snabbdom library)
- a Component class, which uses the QWeb engine as its underlying rendering
  mechanism. The component class is designed to be declarative, with
  asynchronous rendering.

In the future, this repository may includes other features. Here are some possible
ideas:

- a (frontend) router could be included.
- a store base class (as in the flux/redux architecture)

Note: the code is written in typescript. This does not mean that the main web
client will ever be converted to typescript (even though I would really like it).

## Web client demo

To test and play with the component class, there is a demo application located
in the _demo/_ folder. It is a rethink of what the web client could look like
if it is ever rebuilt from scratch. It is currently an experiment. But
obviously, we hope someday to be able to use this work and actually rewrite
completely the odoo web client.

## Main scripts

To install every dependency needed to play with this code:

```
npm install
```

To build a bundle of this as a library:

```
npm run build
```

To run tests:

```
npm run test
npm run test:watch
```

To play with the demo application:

```
npm run demo:build # make a build in dist/app/
npm run demo:dev   # make a build in dist/app/, and make a live server to access it
```

The _demo:dev_ task will build the app (without minification), then start a live-server with hot-reloading, and watch the file system to make sure
that assets are properly rebuilt if necessary, and then reloaded.

## Documentation

[Component](doc/component.md)
[QWeb](doc/qweb.md)
