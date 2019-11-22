# 🦉 Testing and Debugging Owl components 🦉

## Content

- [Overview](#overview)
- [Unit Tests](#unit-tests)
- [Debugging](#debugging)

## Overview

It is a good practice to test applications and components to ensure that they
behave as expected. There are many ways to test a user interface: manual
testing, integration testing, unit testing, ...

In this section, we will discuss how to write unit tests for components, and
how to debug them if necessary.

## Unit Tests

Writing unit tests for Owl components really depends on the testing framework
used in a project. But usually, it involves the following steps:

- create a test file: for example `SomeComponent.test.js`,
- in that file, import the code for `SomeComponent`,
- add a test case:
  - create a real DOM element to use as test fixture,
  - create a test environment
  - create an instance of `SomeComponent`, mount it to the fixture
  - interact with the component and assert some properties.

To help with this, it is useful to have a `helper.js` file that contains some
common utility functions:

```js
export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

export function nextTick() {
  let requestAnimationFrame = owl.Component.scheduler.requestAnimationFrame;
  return new Promise(function(resolve) {
    setTimeout(() => requestAnimationFrame(() => resolve()));
  });
}

export function makeTestEnv() {
    // application specific. It needs a way to load actual templates
    const templates = ...;

    return {
        qweb: new QWeb(templates),
        ..., // each service can be mocked here
    };
}
```

With such a file, a typical test suite for Jest will look like this:

```js
// in SomeComponent.test.js
import { SomeComponent } from "../../src/ui/SomeComponent";
import { nextTick, makeTestFixture, makeTestEnv} from '../helpers';


//------------------------------------------------------------------------------
// Setup
//------------------------------------------------------------------------------
let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  // we set here the default environment for each component created in the test
  Component.env = env;
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------
describe("SomeComponent", () => {
  test("component behaves as expected", async () => {
    const props = {...}; // depends on the component
    const comp = new SomeComponent(null, props);
    await comp.mount(fixture);

    // do some assertions
    expect(...).toBe(...);

    fixture.querySelector('button').click();
    await nextTick();

    // some other assertions
    expect(...).toBe(...);
  });
});
```

Note that Owl does wait for the next animation frame to actually update the DOM.
This is why it is necessary to wait with the `nextTick` (or other methods) to
make sure that the DOM is up-to-date.

It is sometimes useful to wait until Owl is completely done updating components
(in particular, if we have a highly concurrent user interface). This next
helper simply polls every 20ms the internal Owl task queue and returns a promise
which resolves when it is empty:

```js
function afterUpdates() {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(poll, 20);
    let counter = 0;
    function poll() {
      counter++;
      if (owl.Component.scheduler.tasks.length) {
        if (counter > 10) {
          reject(new Error("timeout"));
        } else {
          timer = setTimeout(poll);
        }
      } else {
        resolve();
      }
    }
  });
}
```

## Debugging

Non trivial applications become quickly more difficult to understand. It is then
useful to have a solid understanding of what is going on. To help with that,
the following code can simply be copy/pasted in an application. Once it is
executed, it will log a lot of information on each component main hooks.

```js
let current;
Object.defineProperty(owl.Component, "current", {
  get() {
    return current;
  },
  set(comp) {
    current = comp;
    const name = comp.constructor.name;
    let __owl__;
    Object.defineProperty(current, "__owl__", {
      get() {
        return __owl__;
      },
      set(val) {
        __owl__ = val;
        debugComponent(comp, name, __owl__.id);
      }
    });
  }
});

function toStr(props) {
  let str = JSON.stringify(props || {});
  if (str.length > 200) {
    str = str.slice(0, 200) + "...";
  }
  return str;
}

function debugComponent(component, name, id) {
  console.log(`[DEBUG] constructor ${name}<id=${id}>, props=${toStr(component.props)}`);
  owl.hooks.onWillStart(() => {
    console.log(`[DEBUG] willStart: '${name}<id=${id}>'`);
  });
  owl.hooks.onMounted(() => {
    console.log(`[DEBUG] mounted: '${name}<id=${id}>'`);
  });
  owl.hooks.onWillUpdateProps(nextProps => {
    console.log(`[DEBUG] willUpdateProps: '${name}<id=${id}> nextprops=${toStr(nextProps)}`);
  });
  owl.hooks.onWillPatch(() => {
    console.log(`[DEBUG] willPatch: '${name}<id=${id}>'`);
  });
  owl.hooks.onPatched(() => {
    console.log(`[DEBUG] patched: '${name}<id=${id}>'`);
  });
  owl.hooks.onWillUnmount(() => {
    console.log(`[DEBUG] willUnmount: '${name}<id=${id}>'`);
  });
  const __render = component.__render.bind(component);
  component.__render = function(...args) {
    console.log(`[DEBUG] rendering template: '${name}<id=${id}>'`);
    __render(...args);
  };
  const render = component.render.bind(component);
  component.render = function(...args) {
    console.log(`[DEBUG] render: '${name}<id=${id}>'`);
    return render(...args);
  };
  const mount = component.mount.bind(component);
  component.mount = function(...args) {
    console.log(`[DEBUG] mount: '${name}<id=${id}>'`);
    return mount(...args);
  };
}
```

Note that it is certainly useful to run this code at some point in an application,
just to get a feel of what each user action implies, for the framework.
