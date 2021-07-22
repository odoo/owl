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
      "Parent:render",
      "Child:setup",
      "Child:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:render",
      "Child:render",
      "Child:mounted",
      "Child:mounted",
      "Parent:mounted",
    ]);
  });

  test("reconciliation alg works for t-foreach in t-foreach", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="props.blip"/></div>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
            <t t-foreach="state.s" t-as="section" t-key="section_index">
                <t t-foreach="section.blips" t-as="blip" t-key="blip_index">
                  <Child blip="blip"/>
                </t>
            </t>
        </div>`;
      static components = { Child };
      state = { s: [{ blips: ["a1", "a2"] }, { blips: ["b1"] }] };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div>a1</div><div>a2</div><div>b1</div></div>");
  });

  test("reconciliation alg works for t-foreach in t-foreach, 2", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="props.row + '_' + props.col"/></div>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <p t-foreach="state.rows" t-as="row" t-key="row">
            <p t-foreach="state.cols" t-as="col" t-key="col">
                <Child row="row" col="col"/>
              </p>
            </p>
        </div>`;
      static components = { Child };
      state = useState({ rows: [1, 2], cols: ["a", "b"] });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><p><p><div>1_a</div></p><p><div>1_b</div></p></p><p><p><div>2_a</div></p><p><div>2_b</div></p></p></div>"
    );
    parent.state.rows = [2, 1];
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><p><p><div>2_a</div></p><p><div>2_b</div></p></p><p><p><div>1_a</div></p><p><div>1_b</div></p></p></div>"
    );
  });
});
