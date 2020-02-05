# 🦉 How to debug Owl applications 🦉

Non trivial applications become quickly more difficult to understand. It is then
useful to have a solid understanding of what is going on. To help with that,
logging useful information is extremely valuable. There is a [javascript file](../../tools/debug.js) which can be evaluated in an application.

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

The above code, once pasted somewhere in the main javascript file of an owl
application, will log information looking like this:

```
[OWL_DEBUG] TodoApp<id=1> constructor, props={}
[OWL_DEBUG] TodoApp<id=1> mount
[OWL_DEBUG] TodoApp<id=1> willStart
[OWL_DEBUG] TodoApp<id=1> rendering template
[OWL_DEBUG] TodoItem<id=2> constructor, props={"id":2,"completed":false,"title":"hey"}
[OWL_DEBUG] TodoItem<id=2> willStart
[OWL_DEBUG] TodoItem<id=3> constructor, props={"id":4,"completed":false,"title":"aaa"}
[OWL_DEBUG] TodoItem<id=3> willStart
[OWL_DEBUG] TodoItem<id=2> rendering template
[OWL_DEBUG] TodoItem<id=3> rendering template
[OWL_DEBUG] TodoItem<id=3> mounted
[OWL_DEBUG] TodoItem<id=2> mounted
[OWL_DEBUG] TodoApp<id=1> mounted
```

Each component has an internal `id`, which is very useful when debugging.

Note that it is certainly useful to run this code at some point in an application,
just to get a feel of what each user action implies, for the framework.
