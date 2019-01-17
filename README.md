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

There are three commands that can be used to play with the demo application:

```
npm run demo:build
npm run demo:watch
npm run demo:serve
```

- *build* prepare a folder with all the static files compiled. It is located in
  dist/demo
- *watch* recompile the typescript files as soon as they are changed
- *serve* starts a live-server pointing to the dist/demo (which will reload the
  page whenever the files are changed)

## Notes

Before even thinking about using this in a real scenario:

- check qweb tests and see if it is reasonable
- Note: the compilation of a template should have a unique node (but sub templates
  can have multiple roots)
- remove the "if (${exprID} || ${exprID} === 0) {"