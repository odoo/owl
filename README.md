# Core Utility for Odoo Web Client

This is a POC, not at all production ready code!!!

## Installation

```
npm install
```

## Main scripts

### Testing

```
npm run test
npm run test:watch
```

### Building app

```
npm run build
npm run minify
```

These commands will build the app in dist/app, and minify the js bundle

### Developping

```
npm run dev
```

This will: build the app (without minification), then start a live-server with hot-reloading, and watch the file system to make sure
that assets are properly rebuilt if necessary, and then reloaded.

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
