import { Component, mount, useState, xml } from "../../src/index";
import { makeTestFixture, nextTick, snapshotEverything, useLogLifecycle } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("list of components", () => {
  test("simple list", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
            <t t-foreach="state.elems" t-as="elem" t-key="elem.id">
                <Child value="elem.value"/>
            </t>`;
      static components = { Child };

      state = useState({
        elems: [
          { id: 1, value: "a" },
          { id: 2, value: "b" },
        ],
      });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>a</span><span>b</span>");
    parent.state.elems.push({ id: 4, value: "d" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>a</span><span>b</span><span>d</span>");

    parent.state.elems.pop();

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>a</span><span>b</span>");
  });

  test("components in a node in a t-foreach ", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<div><t t-esc="props.item"/></div>`;
      setup() {
        useLogLifecycle(steps);
      }
    }

    class Parent extends Component {
      static template = xml`
              <div>
                  <ul>
                      <t t-foreach="items" t-as="item">
                          <li t-key="'li_'+item">
                              <Child item="item"/>
                          </li>
                      </t>
                  </ul>
              </div>`;
      static components = { Child };

      setup() {
        useLogLifecycle(steps);
      }

      get items() {
        return [1, 2];
      }
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><ul><li><div>1</div></li><li><div>2</div></li></ul></div>"
    );
    expect(steps).toEqual([
      "Parent:setup",
      "Parent:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:mounted",
      "Child:mounted",
      "Parent:mounted",
    ]);
  });
});
