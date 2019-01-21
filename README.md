# Core Utility for Odoo Web Client

This is a POC, not at all production ready code!!!

## Installation

```
npm install
```

## Tests

```
npm run test
npm run test:watch
```
## Build code bundles

```
npm run bundle:core
npm run bundle:core:watch
```

## Demo page

There are three main commands that can be used to play with the demo application:

```
npm run demo:build
npm run demo:serve
npm run demo:watch
```

- *demo:build* prepare a folder with all the static files compiled. It is
  located in dist/demo
- *demo:serve* simply starts a live-server pointing to the dist/demo (which will
  also reload the page whenever the static files are changed)
- *demo:dev* is a single command useful for developping: it will watch the
  source files, recompile them as needed, starts a live-server.

## Notes

Before even thinking about using this in a real scenario:

- check qweb tests and see if it is reasonable
- Note: the compilation of a template should have a unique node (but sub templates
  can have multiple roots)
- remove the "if (${exprID} || ${exprID} === 0) {"
- style is props? difference between props and attrs
- text node
- t-extend???
- improve qweb generated code: do not assign object/array if no props/attrs/children
- improve qweb gen code: when building a vnode, propagate a structure with
    children/attrs/hooks, fill it properly by each directive, then and only
    then create node with minimal code