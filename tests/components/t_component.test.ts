import { Component, mount } from "../../src";
import { xml } from "../../src/tags";
import { makeTestFixture, nextTick, snapshotEverything, useLogLifecycle } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-component", () => {
  test("t-component works in simple case", async () => {
    let steps: string[] = [];

    class Child extends Component {
      static template = xml`<div>child</div>`;
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<t t-component="Child"/>`;
      Child = Child;
      setup() {
        useLogLifecycle(steps);
      }
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div>child</div>");
    expect(steps).toEqual([
      "Parent:setup",
      "Parent:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:mounted",
      "Parent:mounted",
    ]);
  });

  test("switching dynamic component", async () => {
    let steps: string[] = [];

    class ChildA extends Component {
      static template = xml`<div>child a</div>`;
      setup() {
        useLogLifecycle(steps);
      }
    }

    class ChildB extends Component {
      static template = xml`child b`;
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`<t t-component="Child"/>`;
      Child = ChildA;
      setup() {
        useLogLifecycle(steps);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div>child a</div>");

    parent.Child = ChildB;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("child b");
    expect(steps).toEqual([
      "Parent:setup",
      "Parent:willStart",
      "ChildA:setup",
      "ChildA:willStart",
      "ChildA:mounted",
      "Parent:mounted",
      "ChildB:setup",
      "ChildB:willStart",
      "Parent:willPatch",
      "ChildA:willUnmount",
      "ChildB:mounted",
      "Parent:patched",
      "ChildA:destroyed",
    ]);
  });
});
