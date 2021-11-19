import { Component, mount, onRendered, useState } from "../../src";
import { xml } from "../../src/tags";
import { makeTestFixture, snapshotEverything, nextTick } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("rendering semantics", () => {
  test("can render a parent without rendering child", async () => {
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

      state = useState({ value: "A" });
      setup() {
        onRendered(() => parentN++);
      }
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("Achild");
    expect(parentN).toBe(1);
    expect(childN).toBe(1);

    parent.state.value = "B";
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
    expect(parentN).toBe(2);
    expect(childN).toBe(1);
  });

  test("can force a render to update sub tree", async () => {
    let childN = 0;
    let parentN = 0;
    class Child extends Component {
      static template = xml`child`;
      setup() {
        onRender(() => childN++);
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
        onRender(() => parentN++);
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

  test("blabla", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.a.b"/>`;

    }

    class Parent extends Component {
      static template = xml`
        <Child a="state"/>
      `;
      static components = { Child };

      state = useState({ b: 1 });
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("1");

    parent.state.b = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("3");
  });
});
