import { Component, mount, props, proxy, xml } from "../../src";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-props", () => {
  test("t-props only", async () => {
    class Comp extends Component {
      static template = xml`<div><t t-esc="this.props.a"/></div>`;
      props = props();
    }
    class Parent extends Component {
      static components = { Comp };
      static template = xml`<div><div><Comp t-props="state"/></div></div>`;
      state = proxy({
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
      static template = xml`<div><t t-esc="this.props.a"/><t t-esc="this.props.b"/></div>`;
      props = props();
    }
    class Parent extends Component {
      static components = { Comp };
      static template = xml`<div><div><Comp t-props="state1" a="a"/></div></div>`;
      state1 = proxy({
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

    const state = { a: 1, b: 2 };

    class Child extends Component {
      static template = xml`
          <span>
              <t t-esc="this.props.a + this.props.b"/>
          </span>
        `;
      props = props();
      setup() {
        expect(this.props).toEqual({ a: 1, b: 2 });
        expect(this.props).not.toBe(state);
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
              <Child t-props="some.obj"/>
          </div>
        `;
      static components = { Child };

      some = { obj: state };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  });

  test("t-props with props", async () => {
    expect.assertions(3); // 2 comes from snapshots

    class Child extends Component {
      static template = xml`<div />`;
      props = props();
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
      props = props();
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
