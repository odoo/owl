# 🦉 Tooling 🦉

## Content

- [Overview](#overview)
- [Playground](#playground)
- [Benchmarks](#benchmarks)
- [Single File Component](#single-file-component)
- [Debugging Script](#debugging-script)

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

## Debugging Script

## Debugging

Non trivial applications become quickly more difficult to understand. It is then
useful to have a solid understanding of what is going on. To help with that,
logging useful information is extremely valuable. There is a [javascript file](../tools/debug.js) which can be evaluated in an application.

Once it is executed, it will log a lot of information on each component main hooks. The following code is a minified version to make it easier to copy/paste:

```
let debugSetup = {
  // componentBlackList: /App/,  // regexp
  // componentWhiteList: /SomeComponent/, // regexp
  // methodBlackList: ["mounted"], // list of method names
  // methodWhiteList: ["willStart"], // list of method names
  logScheduler: false,  // display/mute scheduler logs
  logStore: true,     // display/mute store logs
};
{let o,t="[OWL_DEBUG]";function toStr(o){let t=JSON.stringify(o||{});return t.length>200&&(t=t.slice(0,200)+"..."),t}function debugComponent(o,e,n){let l=`${e}<id=${n}>`,r=o=>(!debugSetup.methodBlackList||!debugSetup.methodBlackList.includes(o))&&!(debugSetup.methodWhiteList&&!debugSetup.methodWhiteList.includes(o));r("constructor")&&console.log(`${t} ${l} constructor, props=${toStr(o.props)}`),r("willStart")&&owl.hooks.onWillStart(()=>{console.log(`${t} ${l} willStart`)}),r("mounted")&&owl.hooks.onMounted(()=>{console.log(`${t} ${l} mounted`)}),r("willUpdateProps")&&owl.hooks.onWillUpdateProps(o=>{console.log(`${t} ${l} willUpdateProps, nextprops=${toStr(o)}`)}),r("willPatch")&&owl.hooks.onWillPatch(()=>{console.log(`${t} ${l} willPatch`)}),r("patched")&&owl.hooks.onPatched(()=>{console.log(`${t} ${l} patched`)}),r("willUnmount")&&owl.hooks.onWillUnmount(()=>{console.log(`${t} ${l} willUnmount`)});const s=o.__render.bind(o);o.__render=function(...o){console.log(`${t} ${l} rendering template`),s(...o)};const u=o.render.bind(o);o.render=function(...o){return console.log(`${t} ${l} render`),u(...o)};const c=o.mount.bind(o);o.mount=function(...o){return console.log(`${t} ${l} mount`),c(...o)}}if(Object.defineProperty(owl.Component,"current",{get:()=>o,set(t){o=t;const e=t.constructor.name;if(debugSetup.componentBlackList&&debugSetup.componentBlackList.test(e))return;if(debugSetup.componentWhiteList&&!debugSetup.componentWhiteList.test(e))return;let n;Object.defineProperty(o,"__owl__",{get:()=>n,set(o){debugComponent(t,e,(n=o).id)}})}}),debugSetup.logScheduler){let o;Object.defineProperty(owl.Component.scheduler,"isRunning",{get:()=>o,set(e){e?console.log(`${t} scheduler: start running tasks queue`):console.log(`${t} scheduler: stop running tasks queue`),o=e}})}if(debugSetup.logStore){let o=owl.Store.prototype.dispatch;owl.Store.prototype.dispatch=function(e,...n){return console.log(`${t} store: action '${e}' dispatched. Payload: '${toStr(n)}'`),o.call(this,e,...n)}}}

```

Note that it is certainly useful to run this code at some point in an application,
just to get a feel of what each user action implies, for the framework.
