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
function debugOwl(t,n){let e,o="[OWL_DEBUG]";function s(t){let n=JSON.stringify(t||{});return n.length>200&&(n=n.slice(0,200)+"..."),n}if(Object.defineProperty(t.Component,"current",{get:()=>e,set(i){e=i;const r=i.constructor.name;if(n.componentBlackList&&n.componentBlackList.test(r))return;if(n.componentWhiteList&&!n.componentWhiteList.test(r))return;let l;Object.defineProperty(e,"__owl__",{get:()=>l,set(e){!function(e,i,r){let l=`${i}<id=${r}>`,c=t=>console.log(`${o} ${l} ${t}`),u=t=>(!n.methodBlackList||!n.methodBlackList.includes(t))&&!(n.methodWhiteList&&!n.methodWhiteList.includes(t));u("constructor")&&c(`constructor, props=${s(e.props)}`);u("willStart")&&t.hooks.onWillStart(()=>{c("willStart")});u("mounted")&&t.hooks.onMounted(()=>{c("mounted")});u("willUpdateProps")&&t.hooks.onWillUpdateProps(t=>{c(`willUpdateProps, nextprops=${s(t)}`)});u("willPatch")&&t.hooks.onWillPatch(()=>{c("willPatch")});u("patched")&&t.hooks.onPatched(()=>{c("patched")});u("willUnmount")&&t.hooks.onWillUnmount(()=>{c("willUnmount")});const d=e.__render.bind(e);e.__render=function(...t){c("rendering template"),d(...t)};const h=e.render.bind(e);e.render=function(...t){const n=e.__owl__;let o="render";return n.isMounted||n.currentFiber||(o+=" (warning: component is not mounted, this render has no effect)"),c(o),h(...t)};const p=e.mount.bind(e);e.mount=function(...t){return c("mount"),p(...t)}}(i,r,(l=e).id)}})}}),n.logScheduler){let n=t.Component.scheduler.start,e=t.Component.scheduler.stop;t.Component.scheduler.start=function(){this.isRunning||console.log(`${o} scheduler: start running tasks queue`),n.call(this)},t.Component.scheduler.stop=function(){this.isRunning&&console.log(`${o} scheduler: stop running tasks queue`),e.call(this)}}if(n.logStore){let n=t.Store.prototype.dispatch;t.Store.prototype.dispatch=function(t,...e){return console.log(`${o} store: action '${t}' dispatched. Payload: '${s(e)}'`),n.call(this,t,...e)}}}
debugOwl(owl, {
  // componentBlackList: /App/,  // regexp
  // componentWhiteList: /SomeComponent/, // regexp
  // methodBlackList: ["mounted"], // list of method names
  // methodWhiteList: ["willStart"], // list of method names
  logScheduler: false,  // display/mute scheduler logs
  logStore: true,     // display/mute store logs
});
```

Note that it is certainly useful to run this code at some point in an application,
just to get a feel of what each user action implies, for the framework.
