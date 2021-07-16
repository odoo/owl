import { Component, mount, useState } from "../src";
import { xml } from "../src/tags";
import { NoUpdate } from "../src/utility_components";
import { makeTestFixture, nextTick, snapshotEverything } from "./helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("NoUpdate", () => {
  test("prevent renderings from above ", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.value"/>`;
    }
    class Test extends Component {
      static template = xml`
            <Child value="state.value"/>
            <NoUpdate> 
                <Child value="state.value"/>
            </NoUpdate>`;

      static components = { NoUpdate, Child };

      state = useState({ value: 1 });
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("11");
    component.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("21");
  });
});
