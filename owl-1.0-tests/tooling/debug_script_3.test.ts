/**
 * We can only make one test per file, since the debug tool modify in place
 * the owl object in a way that is difficult to undo.
 */

import { debugOwl } from "../../tools/debug";
import * as owl from "../../src/index";

import { Component, Env } from "../../src/component/component";
import { xml } from "../../src/tags";
import { makeTestFixture, makeTestEnv } from "../helpers";

let fixture: HTMLElement = makeTestFixture();
let env: Env = makeTestEnv();
Component.env = env;

debugOwl(owl, { logScheduler: true });

test("log a specific message for render method calls if component is not mounted", async () => {
  const steps: string[] = [];
  const log = console.log;
  console.log = (arg) => steps.push(arg);

  class Parent extends Component {
    static template = xml`<div><t t-esc="state.value"/></div>`;
    state = owl.hooks.useState({ value: 1 });
  }

  const parent = new Parent(null, {});
  await parent.mount(fixture);
  parent.unmount();
  parent.state.value = 2;

  expect(steps).toEqual([
    "[OWL_DEBUG] Parent<id=1> constructor, props={}",
    "[OWL_DEBUG] Parent<id=1> mount",
    "[OWL_DEBUG] Parent<id=1> willStart",
    "[OWL_DEBUG] scheduler: start running tasks queue",
    "[OWL_DEBUG] Parent<id=1> rendering template",
    "[OWL_DEBUG] Parent<id=1> mounted",
    "[OWL_DEBUG] scheduler: stop running tasks queue",
    "[OWL_DEBUG] Parent<id=1> willUnmount",
    "[OWL_DEBUG] Parent<id=1> render (warning: component is not mounted, this render has no effect)",
  ]);
  console.log = log;
});
