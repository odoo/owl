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

To do so, Owl has two small helpers that make it easy to define a
template or a stylesheet inside a javascript (or typescript) file: the
[`xml`](reference/tags.md#xml-tag) and [`css`](reference/tags.md#css-tag)
helper.

This means that the template, the style and the javascript code can be defined in
the same file. For example:

```js
const { Component } = owl;
const { xml, css } = owl.tags;

// -----------------------------------------------------------------------------
// TEMPLATE
// -----------------------------------------------------------------------------
const TEMPLATE = xml/* xml */ `
	<div class="main">
		<Sidebar/>
		<Content />
	</div>`;

// -----------------------------------------------------------------------------
// STYLE
// -----------------------------------------------------------------------------
const STYLE = css/* css */ `
  .main {
    display: grid;
    grid-template-columns: 200px auto;
  }
`;

// -----------------------------------------------------------------------------
// CODE
// -----------------------------------------------------------------------------
class Main extends Component {
  static template = TEMPLATE;
  static style = STYLE;
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
function debugOwl(t,e){let n,o="[OWL_DEBUG]";function r(t){let e;try{e=JSON.stringify(t||{})}catch(t){e="<JSON error>"}return e.length>200&&(e=e.slice(0,200)+"..."),e}if(Object.defineProperty(t.Component,"current",{get:()=>n,set(s){n=s;const i=s.constructor.name;if(e.componentBlackList&&e.componentBlackList.test(i))return;if(e.componentWhiteList&&!e.componentWhiteList.test(i))return;let l;Object.defineProperty(n,"__owl__",{get:()=>l,set(n){!function(n,s,i){let l=`${s}<id=${i}>`,c=t=>console.log(`${o} ${l} ${t}`),u=t=>(!e.methodBlackList||!e.methodBlackList.includes(t))&&!(e.methodWhiteList&&!e.methodWhiteList.includes(t));u("constructor")&&c(`constructor, props=${r(n.props)}`);u("willStart")&&t.hooks.onWillStart(()=>{c("willStart")});u("mounted")&&t.hooks.onMounted(()=>{c("mounted")});u("willUpdateProps")&&t.hooks.onWillUpdateProps(t=>{c(`willUpdateProps, nextprops=${r(t)}`)});u("willPatch")&&t.hooks.onWillPatch(()=>{c("willPatch")});u("patched")&&t.hooks.onPatched(()=>{c("patched")});u("willUnmount")&&t.hooks.onWillUnmount(()=>{c("willUnmount")});const d=n.__render.bind(n);n.__render=function(...t){c("rendering template"),d(...t)};const h=n.render.bind(n);n.render=function(...t){const e=n.__owl__;let o="render";return e.isMounted||e.currentFiber||(o+=" (warning: component is not mounted, this render has no effect)"),c(o),h(...t)};const p=n.mount.bind(n);n.mount=function(...t){return c("mount"),p(...t)}}(s,i,(l=n).id)}})}}),e.logScheduler){let e=t.Component.scheduler.start,n=t.Component.scheduler.stop;t.Component.scheduler.start=function(){this.isRunning||console.log(`${o} scheduler: start running tasks queue`),e.call(this)},t.Component.scheduler.stop=function(){this.isRunning&&console.log(`${o} scheduler: stop running tasks queue`),n.call(this)}}if(e.logStore){let e=t.Store.prototype.dispatch;t.Store.prototype.dispatch=function(t,...n){return console.log(`${o} store: action '${t}' dispatched. Payload: '${r(n)}'`),e.call(this,t,...n)}}}
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
