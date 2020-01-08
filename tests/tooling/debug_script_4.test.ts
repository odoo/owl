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

test("log a sub component with non stringifiable props", async () => {
  const steps: string[] = [];
  const log = console.log;
  console.log = arg => steps.push(arg);

  class Child extends Component<any,any> {
      static template = xml`<span><t t-esc="props.obj.val"/></span>`;
  }

  const circularObject: any = {val: 1};
  circularObject.circularObject = circularObject;

  class Parent extends Component<any, any> {
    static template = xml`<div><Child obj="obj"/></div>`;
    static components = { Child };
    obj = circularObject;

  }

  const parent = new Parent(null, {});
  await parent.mount(fixture);
  parent.unmount();

  expect(steps).toEqual([
    "[OWL_DEBUG] Parent<id=1> constructor, props={}",
    "[OWL_DEBUG] Parent<id=1> mount",
    "[OWL_DEBUG] Parent<id=1> willStart",
    "[OWL_DEBUG] scheduler: start running tasks queue",
    "[OWL_DEBUG] Parent<id=1> rendering template",
    "[OWL_DEBUG] Child<id=2> constructor, props=<JSON error>",
    "[OWL_DEBUG] Child<id=2> willStart",
    "[OWL_DEBUG] Child<id=2> rendering template",
    "[OWL_DEBUG] Child<id=2> mounted",
    "[OWL_DEBUG] Parent<id=1> mounted",
    "[OWL_DEBUG] scheduler: stop running tasks queue",
    "[OWL_DEBUG] Parent<id=1> willUnmount",
    "[OWL_DEBUG] Child<id=2> willUnmount"
  ]);
  console.log = log;
});
