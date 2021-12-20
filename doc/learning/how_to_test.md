# 🦉 How to test Components 🦉

## Content

- [Overview](#overview)
- [Unit Tests](#unit-tests)

## Overview

It is a good practice to test applications and components to ensure that they
behave as expected. There are many ways to test a user interface: manual
testing, integration testing, unit testing, ...

In this section, we will discuss how to write unit tests for components.

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
let lastFixture = null;

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  if (lastFixture) {
    lastFixture.remove();
  }
  lastFixture = fixture;
  return fixture;
}

export async function nextTick() {
  await new Promise((resolve) => setTimeout(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
```

With such a file, a typical test suite for Jest will look like this:

```js
// in SomeComponent.test.js
import { SomeComponent } from "../../src/ui/SomeComponent";
import { nextTick, makeTestFixture } from '../helpers';


//------------------------------------------------------------------------------
// Setup
//------------------------------------------------------------------------------
let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
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
    const comp = await mount(SomeComponent, fixture, { props });

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
