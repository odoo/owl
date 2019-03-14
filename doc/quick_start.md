# Quick Start

To build an application (or a sub-part of an application), we need two things:

- an environment
- a root widget

Here are a few steps that may be useful to get started:

- get the templates
- create a qweb engine, with the templates
- create an environment
- create an instance of the root widget
- mount the root widget to a DOM element

## Simple example

In a oversimplified example, here is what it could look like:

```javascript
const templates = await loadTemplates();

const qweb = new QWeb();
qweb.loadTemplates(templates);

const env = {
  qweb: qweb
};

const root = new RootWidget(env, { initialState: 17 });

const target = document.getElementById("app");
root.mount(target);
```

## Managing state

The environment is propagated to each subchildren. So, it is convenient to use
to give a reference to some global object. This is potentially very useful
in a redux-like architecture:

```javascript
...

const store = new Store();

const env = {
    qweb: qweb,
    store: store,
};

const state = store.getState()
const root = new RootWidget(env, state);

store.on('state_change', nextState => {
    root.updateProps(nextState);
});

const target = document.getElementById('app');
root.mount(target);
```
