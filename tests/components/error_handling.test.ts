import { Component, mount } from "../../src";
import { status } from "../../src/component/status";
import { xml } from "../../src/tags";
import { makeTestFixture, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("no component catching error lead to full app destruction", async () => {
    class ErrorComponent extends Component {
      static template = xml`<div>hey<t t-esc="props.flag and state.this.will.crash"/></div>`;
    }

    class Parent extends Component {
      static template = xml`<div><ErrorComponent flag="state.flag"/></div>`;
      static components = { ErrorComponent };
      state = { flag: false };
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div>heyfalse</div></div>");
    parent.state.flag = true;

    let error;
    try {
      await parent.render();
    } catch (e) {
      error = e;
    }
    expect(fixture.innerHTML).toBe("");
    expect(status(parent)).toBe("destroyed");
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot read property 'this' of undefined");
  });
});
