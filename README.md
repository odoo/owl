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

Note that the test scripts also run the example tests suites.

## Documentation

- [Quick Start](doc/quick_start.md)
- [Component](doc/component.md)
- [QWeb](doc/qweb.md)

# Examples

There are two examples of how to work with this web framework:

- [Demo Application](examples/readme.md#demo)
- [Web Client](examples/readme.md#web-client-example)
