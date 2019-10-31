# 🦉 Environment 🦉

An environment is an object which contains a [`QWeb` instance](../reference/qweb.md).
Whenever a root component is created, it is assigned an environment (see the
reference section on [environment](../reference/environment.md). This environment
is then automatically given to each sub components (and accessible in the `this.env` property).

The environment is mostly static. Each application is free to add anything to
the environment, which is very useful, since this can be accessed by each sub
component.

Some good use cases for the environment is:

- some configuration keys,
- session information,
- generic services (such as doing rpcs, or accessing local storage).

Doing it this way means that components are easily testable: we can simply
create a test environment with mock services.

For example:

```js
async function myEnv() {
  const templates = await loadTemplates();
  const qweb = new QWeb({ templates });
  const session = getSession();

  return {
    _t: myTranslateFunction,
    session: session,
    qweb: qweb,
    services: {
      localStorage: localStorage,
      rpc: rpc
    },
    debug: false,
    inMobileMode: true
  };
}

async function start() {
  App.env = await myEnv();
  const app = new App();
  await app.mount(document.body);
}
```
