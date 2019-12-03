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
function debugOwl(o,t){let e,n="[OWL_DEBUG]";function l(o){let t=JSON.stringify(o||{});return t.length>200&&(t=t.slice(0,200)+"..."),t}if(Object.defineProperty(o.Component,"current",{get:()=>e,set(s){e=s;const c=s.constructor.name;if(t.componentBlackList&&t.componentBlackList.test(c))return;if(t.componentWhiteList&&!t.componentWhiteList.test(c))return;let r;Object.defineProperty(e,"__owl__",{get:()=>r,set(e){!function(e,s,c){let r=`${s}<id=${c}>`,i=o=>(!t.methodBlackList||!t.methodBlackList.includes(o))&&!(t.methodWhiteList&&!t.methodWhiteList.includes(o));i("constructor")&&console.log(`${n} ${r} constructor, props=${l(e.props)}`);i("willStart")&&o.hooks.onWillStart(()=>{console.log(`${n} ${r} willStart`)});i("mounted")&&o.hooks.onMounted(()=>{console.log(`${n} ${r} mounted`)});i("willUpdateProps")&&o.hooks.onWillUpdateProps(o=>{console.log(`${n} ${r} willUpdateProps, nextprops=${l(o)}`)});i("willPatch")&&o.hooks.onWillPatch(()=>{console.log(`${n} ${r} willPatch`)});i("patched")&&o.hooks.onPatched(()=>{console.log(`${n} ${r} patched`)});i("willUnmount")&&o.hooks.onWillUnmount(()=>{console.log(`${n} ${r} willUnmount`)});const u=e.__render.bind(e);e.__render=function(...o){console.log(`${n} ${r} rendering template`),u(...o)};const d=e.render.bind(e);e.render=function(...o){return console.log(`${n} ${r} render`),d(...o)};const p=e.mount.bind(e);e.mount=function(...o){return console.log(`${n} ${r} mount`),p(...o)}}(s,c,(r=e).id)}})}}),t.logScheduler){let t=o.Component.scheduler.start,e=o.Component.scheduler.stop;o.Component.scheduler.start=function(){console.log(`${n} scheduler: start running tasks queue`),t.call(this)},o.Component.scheduler.stop=function(){console.log(`${n} scheduler: stop running tasks queue`),e.call(this)}}if(t.logStore){let t=o.Store.prototype.dispatch;o.Store.prototype.dispatch=function(o,...e){return console.log(`${n} store: action '${o}' dispatched. Payload: '${l(e)}'`),t.call(this,o,...e)}}}
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
