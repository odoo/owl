/**
 * We can only make one test per file, since the debug tool modify in place
 * the owl object in a way that is difficult to undo.
 */

import { debugOwl } from "../../tools/debug";
import * as owl from "../../src/index";

import { Component, Env } from "../../src/component/component";
import { xml } from "../../src/tags";
import { useState } from "../../src/hooks";
import { makeTestFixture, makeTestEnv, nextTick } from "../helpers";

let fixture: HTMLElement = makeTestFixture();
let env: Env = makeTestEnv();
Component.env = env;

debugOwl(owl, {});

test("can log full lifecycle", async () => {
  const steps: string[] = [];
  const log = console.log;
  console.log = (arg) => steps.push(arg);

  class Child extends Component {
    static template = xml`<div>child</div>`;
  }

  class Parent extends Component {
    static template = xml`<div><Child t-if="state.flag"/></div>`;
    static components = { Child };
    state = useState({ flag: false });
  }

  const parent = new Parent(null, {});
  await parent.mount(fixture);

  parent.state.flag = true;
  await nextTick();

  expect(steps).toEqual([
    "[OWL_DEBUG] Parent<id=1> constructor, props={}",
    "[OWL_DEBUG] Parent<id=1> mount",
    "[OWL_DEBUG] Parent<id=1> willStart",
    "[OWL_DEBUG] Parent<id=1> rendering template",
    "[OWL_DEBUG] Parent<id=1> mounted",
    "[OWL_DEBUG] Parent<id=1> render",
    "[OWL_DEBUG] Parent<id=1> rendering template",
    "[OWL_DEBUG] Child<id=2> constructor, props={}",
    "[OWL_DEBUG] Child<id=2> willStart",
    "[OWL_DEBUG] Child<id=2> rendering template",
    "[OWL_DEBUG] Parent<id=1> willPatch",
    "[OWL_DEBUG] Child<id=2> mounted",
    "[OWL_DEBUG] Parent<id=1> patched",
  ]);
  console.log = log;
});
