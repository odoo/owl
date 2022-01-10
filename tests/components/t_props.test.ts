import { Component, mount, useState, xml } from "../../src";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-props", () => {
  test("t-props only", async () => {
    class Comp extends Component {
      static template = xml`<div><t t-esc="props.a"/></div>`;
    }
    class Parent extends Component {
      static components = { Comp };
      static template = xml`<div><div><Comp t-props="state"/></div></div>`;
      state = useState({
        a: "first",
      });
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.textContent).toBe("first");
    parent.state.a = "";
    await nextTick();
    expect(fixture.textContent).toBe("");
    parent.state.a = "fixed";
    await nextTick();
    expect(fixture.textContent).toBe("fixed");
  });

  test("t-props and other props", async () => {
    class Comp extends Component {
      static template = xml`<div><t t-esc="props.a"/><t t-esc="props.b"/></div>`;
    }
    class Parent extends Component {
      static components = { Comp };
      static template = xml`<div><div><Comp t-props="state1" a="a"/></div></div>`;
      state1 = useState({
        a: "first",
        b: "second",
      });
      a? = "third";
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.textContent).toBe("thirdsecond");
    delete parent.a;
    parent.render();
    await nextTick();
    expect(fixture.textContent).toBe("second");
  });

  test("basic use", async () => {
    expect.assertions(5);

    let props = { a: 1, b: 2 };

    class Child extends Component {
      static template = xml`
          <span>
              <t t-esc="props.a + props.b"/>
          </span>
        `;
      setup() {
        expect(this.props).toEqual({ a: 1, b: 2 });
        expect(this.props).not.toBe(props);
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
              <Child t-props="some.obj"/>
          </div>
        `;
      static components = { Child };

      some = { obj: props };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  });

  test("t-props with props", async () => {
    expect.assertions(3); // 2 comes from snapshots

    class Child extends Component {
      static template = xml`<div />`;
      setup() {
        expect(this.props).toEqual({ a: 1, b: 2, c: "c" });
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
              <Child t-props="childProps" a="1" b="2" />
          </div>
        `;
      static components = { Child };

      childProps = { a: "a", c: "c" };
    }

    await mount(Parent, fixture);
  });

  test("child receives a copy of the t-props object, not the original", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        expect(this.props).toEqual({ a: 1, b: 2 });
        this.props.d = 5;
      }
    }
    class Parent extends Component {
      static template = xml`<Child t-props="childProps"/>`;
      static components = { Child };

      childProps = { a: 1, b: 2 };
    }

    const parent = await mount(Parent, fixture);
    expect(parent.childProps).not.toHaveProperty("d");
  });
});
