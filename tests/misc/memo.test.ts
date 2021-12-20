import { Component, mount, useState, xml } from "../../src";
import { Memo } from "../../src/";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("Memo", () => {
  test("if no props, prevent renderings from above ", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.value"/>`;
    }
    class Test extends Component {
      static template = xml`
              <Child value="state.value"/>
              <Memo> 
                  <Child value="state.value"/>
              </Memo>`;

      static components = { Memo, Child };

      state = useState({ value: 1 });
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("11");
    component.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("21");
  });

  test("if no props, prevent renderings from above (work with simple html) ", async () => {
    class Test extends Component {
      static template = xml`
              <t t-esc="state.value"/>
              <Memo> 
                  <t t-esc="state.value"/>
              </Memo>`;

      static components = { Memo };

      state = useState({ value: 1 });
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("11");
    component.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("21");
  });

  test("if no prop change, prevent renderings from above ", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.value"/>`;
    }

    class Test extends Component {
      static template = xml`
              <t t-esc="state.a"/>
              <t t-esc="state.b"/>
              <t t-esc="state.c"/>
              <Memo a="state.a" b="state.b"> 
                <t t-esc="state.a"/>
                <t t-esc="state.b"/>
                <t t-esc="state.c"/>
              </Memo>`;

      static components = { Memo, Child };

      state = useState({ a: "a", b: "b", c: "c" });
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("abcabc");

    component.state.c = "C";
    await nextTick();
    expect(fixture.innerHTML).toBe("abCabc");

    component.state.a = "A";
    await nextTick();
    expect(fixture.innerHTML).toBe("AbCAbC");
  });
});
