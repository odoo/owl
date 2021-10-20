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
      a = "third";
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.textContent).toBe("thirdsecond");
    delete parent.a;
    parent.render();
    await nextTick();
    expect(fixture.textContent).toBe("second");
  });
});
