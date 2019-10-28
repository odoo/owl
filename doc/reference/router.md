# 🦉 Router 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [Route Definition](#route-definition)
  - [Router](#router)
  - [Navigation Guards](#navigation-guards)
  - [RouteComponent](#routecomponent)
  - [Link](#link)

## Overview

It is often useful to organize an application around urls. If the application is
a single page application, then we need a way to manage those urls in the browser.
This is why there are many different routers for different frameworks. A generic
router can do the job just fine, but a specialized router for Owl can give a
better developer experience.

The Owl router support the following features:

- `history` or `hash` mode
- declarative routes
- route redirection
- navigation guards
- parameterized routes
- a `<Link/>` component
- a `<RouteComponent/>` component

Note that it is still in early stage of developments, and there are probably
still some issues.

## Example

To use the Owl router, there are some steps that needs to be done:

- declare some routes
- create a router
- add it to the environment

```js
async function protectRoute({ env, to }) {
  if (!env.session.authUser) {
    env.session.setNextRoute(to.name);
    return { to: "SIGN_IN" };
  }
  return true;
}

export const ROUTES = [
  { name: "LANDING", path: "/", component: Landing },
  { name: "TASK", path: "/tasks/{{id}}", component: Task },
  { name: "SIGN_UP", path: "/signup", component: SignUp },
  { name: "SIGN_IN", path: "/signin", component: SignIn },
  { name: "ADMIN", path: "/admin", component: Admin, beforeRouteEnter: protectRoute },
  { name: "ACCOUNT", path: "/account", component: Account, beforeRouteEnter: protectRoute },
  { name: "UNKNOWN", path: "*", redirect: { to: "LANDING" } }
];

function makeEnvironment() {
    ...
    const env = { qweb };
    env.session = new Session(env);
    env.router = new owl.router.Router(env, ROUTES);
    await env.router.start();
    return env;
}
```

Notice that the router needs to be started. This is an asynchronous operation
because it needs to apply the potential navigation guards on the current route
(which may or may not mean that the application is redirected to another route).

## Reference

### Route definition

A route need to be defined as an object with the following keys:

- `name` (optional): a (unique) string useful to identify the current route. If not
  given, it will be assigned an automatic name,
- `path`: a string describing the url. It can be static: `/admin` or dynamic: `/users/{{id}}`.
  It also can be `*`, to catch all remaining routes.
- `component` (optional): an Owl component that will be used by the `t-routecomponent`
  directive if the route is active
- `redirect` (optional): should be destination object (with optional keys `path`, `to` and `params`) if given, the application will be redirected to the destination whenever we match this route
- `beforeRouteEnter`: defines a [navigation guard](#navigation-guards).

### `Router`

The `Router` constructor takes three arguments:

- `env`: a valid environment,
- a list of routes,
- an optional object (with the only key `mode` which can be `history` (default
  value) or `hash`).

`history` will use the browser [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) as the mechanism to manage URL.\
Example: `https://yourdomain.tld/my_custom_route`.\
For this mechanism to work, you need a way to configure your web server accordingly.

`hash` will manipulate the hash of the URL.\
Example: `https://yourdomain.tld/index.html#/my_custom_route`.

```js
const ROUTES = [...];
const router = new owl.router.Router(env, ROUTES, {mode: 'history'});
```

Note that the route are defined in a list, and the order matters: the router
tries to find a match by going down the list.

The router needs to be added to the environment in the `router` sub key.

Once a router is created, it needs to be started. This is necessary to initialize
its current state to the current URL (and also, to potentially apply any
navigation guards and/or redirecting).

```js
await router.start();
```

Once started, the router will keep track of the current url and reflect its
value in two keys:

- `router.currentRoute`
- `router.currentParams`

The router also has a `navigate` method, useful to programmatically change the
application to another state (and the url):

```js
router.navigate({ to: "USER", params: { id: 51 } });
```

### Navigation Guards

Navigation guards are very useful to be able to execute some business logic/
perform some actions or redirect to other routes whenever the application is
entering a new route. For example, the following guard checks if there is an
authenticated user, and if it is not the case, redirect to the sign in route.

```js
async function protectRoute({ env, to }) {
  if (!env.session.authUser) {
    env.session.setNextRoute(to.name);
    return { to: "SIGN_IN" };
  }
  return true;
}
```

A navigation guard is a function that returns a promise, which either resolves
to `true` (the navigation is accepted), or to another destination object.

### `RouteComponent`

The `RouteComponent` component directs Owl to render the component associated
to the currently active route (if any):

```xml
<div t-name="App">
    <NavBar />
    <RouteComponent />
</div>
```

### `Link`

The `Link` component is a Owl component which render as a `<a>` tag with any
content. It will compute the proper href from its props, and allow Owl to
properly navigate to a given url if clicked on it.

```xml
<Link to="'HOME'">Home</Link>
```
