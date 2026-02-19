import { Component, mount, onWillUpdateProps, props, proxy, xml } from "../../src";
import {
  makeTestFixture,
  snapshotEverything,
  nextTick,
  useLogLifecycle,
  makeDeferred,
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

  test("rendering is atomic (for one subtree)", async () => {
    const def = makeDeferred();

    class C extends Component {
      static template = xml`<t t-out="this.props.obj.val"/>`;
      props = props();

      setup() {
        useLogLifecycle(this);
      }
    }

    class B extends Component {
      static template = xml`<C obj="this.props.obj"/>`;
      static components = { C };
      props = props();

      setup() {
        useLogLifecycle(this);
        onWillUpdateProps(() => def);
      }
    }

    class A extends Component {
      static template = xml`<t t-out="this.state.obj.val"/><B obj="this.state.obj"/>`;
      static components = { B };

      state = proxy({ obj: { val: 1 } });

      setup() {
        useLogLifecycle(this);
      }
    }

    const parent = await mount(A, fixture);
    expect(fixture.innerHTML).toBe("11");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:setup",
        "A:willStart",
        "B:setup",
        "B:willStart",
        "C:setup",
        "C:willStart",
        "C:mounted",
        "B:mounted",
        "A:mounted",
      ]
    `);

    parent.state.obj.val = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("33");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "A:willPatch",
        "A:patched",
        "C:willPatch",
        "C:patched",
      ]
    `);

    def.resolve();
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`[]`);
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
