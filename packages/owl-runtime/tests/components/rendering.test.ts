import { beforeEach, describe, expect, test } from "vitest";
import { Component, mount, props, proxy, xml } from "../../src";
import {
  makeTestFixture,
  snapshotEverything,
  nextTick,
  useLogLifecycle,
  render,
  steps,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("rendering semantics", () => {
  test("can render a parent without rendering child", async () => {
    class Child extends Component {
      static template = xml`child`;
      setup() {
        useLogLifecycle(this);
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-out="this.state.value"/>
        <Child/>
      `;
      static components = { Child };

      state = proxy({ value: "A" });
      setup() {
        useLogLifecycle(this);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("Achild");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    parent.state.value = "B";
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Parent:patched",
      ]
    `);
  });

  test("can force a render to update sub tree", async () => {
    let childN = 0;
    let parentN = 0;
    class Child extends Component {
      static template = xml`<t t-set="noop" t-value="this.notify()"/>child`;
      notify() {
        childN++;
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-out="this.state.value"/>
        <Child/>
        <t t-set="noop" t-value="this.notify()"/>
      `;
      static components = { Child };

      state = { value: "A" };
      notify() {
        parentN++;
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("Achild");
    expect(parentN).toBe(1);
    expect(childN).toBe(1);

    parent.state.value = "B";
    render(parent, true);
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
    expect(parentN).toBe(2);
    expect(childN).toBe(2);
  });

  test("render with deep=true followed by render with deep=false work as expected", async () => {
    class Child extends Component {
      static template = xml`child<t t-out="this.state.getValue()"/>`;
      state = state;
      setup() {
        useLogLifecycle(this);
      }
    }

    class Parent extends Component {
      static template = xml`parent<t t-out="this.state.value"/><Child/>`;
      static components = { Child };

      state = proxy({ value: "A" });

      setup() {
        useLogLifecycle(this);
      }
    }
    let value = 3;
    const state = {
      getValue() {
        return value;
      },
    };

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("parentAchild3");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    value = 4;
    render(parent, true);

    // Microtask scheduling: the deep render and the subsequent state mutation
    // both land in the same drain, so we observe a single combined patch.
    parent.state.value = "B";

    await nextTick();

    expect(fixture.innerHTML).toBe("parentBchild4");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Child:willPatch",
        "Child:patched",
        "Parent:patched",
      ]
    `);
  });

  test("props are proxy", async () => {
    class Child extends Component {
      static template = xml`<t t-out="this.props.a.b"/>`;
      props = props();
      setup() {
        useLogLifecycle(this);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child a="this.state"/>
      `;
      static components = { Child };

      state = proxy({ b: 1 });
      setup() {
        useLogLifecycle(this);
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    parent.state.b = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("3");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:willPatch",
        "Child:patched",
      ]
    `);
  });

  test("props are proxy (nested prop)", async () => {
    class Child extends Component {
      static template = xml`<t t-out="this.props.a.b.c"/>`;
      props = props();

      setup() {
        useLogLifecycle(this);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child a="this.state"/>
      `;
      static components = { Child };

      state = proxy({ b: { c: 1 } });

      setup() {
        useLogLifecycle(this);
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    parent.state.b.c = 3; // parent is now subscribed to 'b' key
    await nextTick();
    expect(fixture.innerHTML).toBe("3");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:willPatch",
        "Child:patched",
      ]
    `);

    parent.state.b = { c: 444 }; // triggers a parent and a child render
    await nextTick();
    expect(fixture.innerHTML).toBe("444");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Child:willPatch",
        "Child:patched",
      ]
    `);
  });

  test("works as expected for dynamic number of props", async () => {
    class Child extends Component {
      static template = xml`<t t-out="Object.keys(this.props).length"/>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`
        <Child t-props="this.state"/>
      `;
      static components = { Child };

      state: any = proxy({ b: 1 });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1");
    parent.state.newkey = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("2");
  });
});

test("children, default props and renderings", async () => {
  class Child extends Component {
    static template = xml`child`;
    props = props({
      value: { optional: true, defaultValue: 1 },
    });
    setup() {
      useLogLifecycle(this);
    }
  }

  class Parent extends Component {
    static template = xml`
      <t t-out="this.state.value"/>
      <Child />
    `;
    static components = { Child };

    state = proxy({ value: "A" });
    setup() {
      useLogLifecycle(this);
    }
  }

  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("Achild");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:mounted",
      "Parent:mounted",
    ]
  `);

  parent.state.value = "B";
  await nextTick();
  expect(fixture.innerHTML).toBe("Bchild");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Parent:patched",
    ]
  `);
});
