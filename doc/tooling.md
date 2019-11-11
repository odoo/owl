# 🦉 Tooling 🦉

## Content

- [Overview](#overview)
- [Playground](#playground)
- [Benchmarks](#benchmarks)
- [Single File Component](#single-file-component)

## Overview

To help work with/improve/learn OWL, there are a few extras tools/settings.

- development mode: enable better error reporting for the developer
- a playground application: a space to experiment and learn Owl.
- a benchmarks application: allow comparison with a few common frameworks

The two applications are available in the `tools/` folder, and can be accessed
by using a static http server. A simple python
server is available in `server.py`. There is also a npm script to start it:
`npm run tools` (and its version with a watcher: `npm run tools:watch`).

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

## Single File Component

It is very useful to group code by feature instead of by type of file. It makes
it easier to scale application to larger size.

To do so, Owl currently has a small helper that makes it easy to define a
template inside a javascript (or typescript) file: the [`xml`](reference/tags.md#xml-tag)
helper. With this, a template is automatically registered to [QWeb](reference/qweb_engine.md).

This means that the template and the javascript code can be defined in the same
file. It is not currently possible to add css to the same file, but Owl may
get a `css` tag helper later.

```js
const { Component } = owl;
const { xml } = owl.tags;

// -----------------------------------------------------------------------------
// TEMPLATE
// -----------------------------------------------------------------------------
const TEMPLATE = xml/* xml */ `
	<div class="main two-columns">
		<Sidebar/>
		<Content />
	</div>`;

// -----------------------------------------------------------------------------
// CODE
// -----------------------------------------------------------------------------
class MyComponent extends Component {
  static template = TEMPLATE;
  static components = { Sidebar, Content };

  // rest of component...
}
```

Note that the above example has an inline xml comment, just after the `xml` call.
This is useful for some editor plugins, such as the VS Code addon
`Comment tagged template`, which, if installed, add syntax highlighting to the
content of the template string.
