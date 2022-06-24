import { Component, mount, onRendered, onWillUpdateProps, useState, xml } from "../../src";
import {
  makeDeferred,
  makeTestFixture,
  nextTick,
  snapshotEverything,
  useLogLifecycle,
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
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-esc="state.value"/>
        <Child/>
      `;
      static components = { Child };

      state = useState({ value: "A" });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("Achild");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Child:setup",
      "Child:willStart",
      "Child:willRender",
      "Child:rendered",
      "Parent:rendered",
      "Child:mounted",
      "Parent:mounted",
    ]).toBeLogged();

    parent.state.value = "B";
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Parent:patched",
    ]).toBeLogged();
  });

  test("can force a render to update sub tree", async () => {
    let childN = 0;
    let parentN = 0;
    class Child extends Component {
      static template = xml`child`;
      setup() {
        onRendered(() => childN++);
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-esc="state.value"/>
        <Child/>
      `;
      static components = { Child };

      state = { value: "A" };
      setup() {
        onRendered(() => parentN++);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("Achild");
    expect(parentN).toBe(1);
    expect(childN).toBe(1);

    parent.state.value = "B";
    parent.render(true);
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
    expect(parentN).toBe(2);
    expect(childN).toBe(2);
  });

  test("render need a boolean = true to be 'deep'", async () => {
    let childN = 0;
    let parentN = 0;
    class Child extends Component {
      static template = xml`child`;
      setup() {
        onRendered(() => childN++);
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-esc="state.value"/>
        <Child/>
      `;
      static components = { Child };

      state = { value: "A" };
      setup() {
        onRendered(() => parentN++);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("Achild");
    expect(parentN).toBe(1);
    expect(childN).toBe(1);

    parent.state.value = "B";
    parent.render("true" as any as boolean);
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
    expect(parentN).toBe(2);
    expect(childN).toBe(1);
  });

  test.only("render with deep=true followed by render with deep=false work as expected", async () => {
    class Child extends Component {
      static template = xml`child<t t-esc="env.getValue()"/>`;
      setup() {
        useLogLifecycle();
        onRendered(() => {
          if (value === 4) {
            parent.state.value = "B";
          }
        });
      }
    }

    class Parent extends Component {
      static template = xml`parent<t t-esc="state.value"/><Child/>`;
      static components = { Child };

      state = useState({ value: "A" });

      setup() {
        useLogLifecycle();
      }
    }
    let value = 3;
    const env = {
      getValue() {
        return value;
      },
    };

    const parent = await mount(Parent, fixture, { env });

    expect(fixture.innerHTML).toBe("parentAchild3");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Child:setup",
      "Child:willStart",
      "Child:willRender",
      "Child:rendered",
      "Parent:rendered",
      "Child:mounted",
      "Parent:mounted",
    ]).toBeLogged();

    value = 4;
    parent.render(true);

    // wait for child to be rendered, but dom not yet patched
    // await nextMicroTick();
    // await nextMicroTick();
    // await nextMicroTick();
    // expect([
    //   "Parent:willRender",
    //   "Child:willUpdateProps",
    //   "Child:willRender",
    //   "Child:rendered",
    //   "Parent:rendered",
    // ]).toBeLogged();

    // parent.state.value = "B";

    await nextTick();
    // await nextTick();

    expect([
      "Parent:willRender",
      "Child:willUpdateProps",
      "Child:willRender",
      "Child:rendered",
      "Parent:rendered",
      "Parent:willRender",
      "Child:willUpdateProps",
      "Child:willRender",
      "Child:rendered",
      "Parent:rendered",
      "Parent:willPatch",
      "Child:willPatch",
      "Child:patched",
      "Parent:patched",
    ]).toBeLogged();
    expect(fixture.innerHTML).toBe("parentBchild4");
  });

  test("props are reactive", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.a.b"/>`;
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child a="state"/>
      `;
      static components = { Child };

      state = useState({ b: 1 });
      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Child:setup",
      "Child:willStart",
      "Child:willRender",
      "Child:rendered",
      "Parent:rendered",
      "Child:mounted",
      "Parent:mounted",
    ]).toBeLogged();

    parent.state.b = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("3");
    expect(["Child:willRender", "Child:rendered", "Child:willPatch", "Child:patched"]).toBeLogged();
  });

  test("props are reactive (nested prop)", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.a.b.c"/>`;

      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child a="state"/>
      `;
      static components = { Child };

      state = useState({ b: { c: 1 } });

      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("1");
    expect([
      "Parent:setup",
      "Parent:willStart",
      "Parent:willRender",
      "Child:setup",
      "Child:willStart",
      "Child:willRender",
      "Child:rendered",
      "Parent:rendered",
      "Child:mounted",
      "Parent:mounted",
    ]).toBeLogged();

    parent.state.b.c = 3; // parent is now subscribed to 'b' key
    await nextTick();
    expect(fixture.innerHTML).toBe("3");
    expect(["Child:willRender", "Child:rendered", "Child:willPatch", "Child:patched"]).toBeLogged();

    parent.state.b = { c: 444 }; // triggers a parent and a child render
    await nextTick();
    expect(fixture.innerHTML).toBe("444");
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Child:willRender",
      "Child:rendered",
      "Parent:willPatch",
      "Parent:patched",
      "Child:willPatch",
      "Child:patched",
    ]).toBeLogged();
  });

  test("works as expected for dynamic number of props", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="Object.keys(props).length"/>`;
    }

    class Parent extends Component {
      static template = xml`
        <Child t-props="state"/>
      `;
      static components = { Child };

      state: any = useState({ b: 1 });
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
      static template = xml`<t t-esc="props.obj.val"/>`;

      setup() {
        useLogLifecycle();
      }
    }

    class B extends Component {
      static template = xml`<C obj="props.obj"/>`;
      static components = { C };

      setup() {
        useLogLifecycle();
        onWillUpdateProps(() => def);
      }
    }

    class A extends Component {
      static template = xml`<t t-esc="state.obj.val"/><B obj="state.obj"/>`;
      static components = { B };

      state = useState({ obj: { val: 1 } });

      setup() {
        useLogLifecycle();
      }
    }

    const parent = await mount(A, fixture);
    expect(fixture.innerHTML).toBe("11");
    expect([
      "A:setup",
      "A:willStart",
      "A:willRender",
      "B:setup",
      "B:willStart",
      "B:willRender",
      "C:setup",
      "C:willStart",
      "C:willRender",
      "C:rendered",
      "B:rendered",
      "A:rendered",
      "C:mounted",
      "B:mounted",
      "A:mounted",
    ]).toBeLogged();

    parent.state.obj.val = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("33");
    expect([
      "A:willRender",
      "A:rendered",
      "C:willRender",
      "C:rendered",
      "A:willPatch",
      "A:patched",
      "C:willPatch",
      "C:patched",
    ]).toBeLogged();

    def.resolve();
    await nextTick();
    expect([]).toBeLogged();
  });
});

test("force render in case of existing render", async () => {
  const def = makeDeferred();

  class C extends Component {
    static template = xml`C`;
    setup() {
      useLogLifecycle();
    }
  }
  class B extends Component {
    static template = xml`<C/><t t-esc="props.val"/>`;
    static components = { C };
    setup() {
      useLogLifecycle();
      onWillUpdateProps(() => def);
    }
  }
  class A extends Component {
    static template = xml`<B val="state.val"/>`;
    static components = { B };
    state = useState({ val: 1 });
    setup() {
      useLogLifecycle();
    }
  }
  const parent = await mount(A, fixture);
  expect(fixture.innerHTML).toBe("C1");
  expect([
    "A:setup",
    "A:willStart",
    "A:willRender",
    "B:setup",
    "B:willStart",
    "B:willRender",
    "C:setup",
    "C:willStart",
    "C:willRender",
    "C:rendered",
    "B:rendered",
    "A:rendered",
    "C:mounted",
    "B:mounted",
    "A:mounted",
  ]).toBeLogged();

  // trigger a new rendering, blocked in B
  parent.state.val = 2;
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  // initiate a new render with deep=true. it should cancel the current render
  // and also be blocked in B
  parent.render(true);
  await nextTick();
  expect(["A:willRender", "B:willUpdateProps", "A:rendered"]).toBeLogged();

  def.resolve();
  await nextTick();
  // we check here that the render reaches C (so, that it was properly forced)
  expect([
    "B:willRender",
    "C:willUpdateProps",
    "C:willRender",
    "C:rendered",
    "B:rendered",
    "A:willPatch",
    "B:willPatch",
    "C:willPatch",
    "C:patched",
    "B:patched",
    "A:patched",
  ]).toBeLogged();
});

test("children, default props and renderings", async () => {
  class Child extends Component {
    static template = xml`child`;
    static defaultProps = { value: 1 };
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
      <t t-esc="state.value"/>
      <Child />
    `;
    static components = { Child };

    state = useState({ value: "A" });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);

  expect(fixture.innerHTML).toBe("Achild");
  expect([
    "Parent:setup",
    "Parent:willStart",
    "Parent:willRender",
    "Child:setup",
    "Child:willStart",
    "Child:willRender",
    "Child:rendered",
    "Parent:rendered",
    "Child:mounted",
    "Parent:mounted",
  ]).toBeLogged();

  parent.state.value = "B";
  await nextTick();
  expect(fixture.innerHTML).toBe("Bchild");
  expect([
    "Parent:willRender",
    "Parent:rendered",
    "Parent:willPatch",
    "Parent:patched",
  ]).toBeLogged();
});
