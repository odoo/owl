import { Component, mount, onMounted, useState, xml } from "../../src/index";
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
                      <t t-foreach="items" t-as="item" t-key="'li_'+item">
                          <li>
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

  test("sub components rendered in a loop", async () => {
    class Child extends Component {
      static template = xml`<p><t t-esc="props.n"/></p>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="state.numbers" t-as="number" t-key="number" >
            <Child n="number"/>
          </t>
        </div>`;
      static components = { Child };

      state = useState({ numbers: [1, 2, 3] });
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(`<div><p>1</p><p>2</p><p>3</p></div>`);
  });

  test("sub components with some state rendered in a loop", async () => {
    let n = 1;

    class Child extends Component {
      static template = xml`<p><t t-esc="state.n"/></p>`;
      state: any;
      setup() {
        this.state = useState({ n });
        n++;
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="state.numbers" t-as="number" t-key="number">
            <Child/>
          </t>
        </div>`;
      static components = { Child };

      state = useState({
        numbers: [1, 2, 3],
      });
    }
    const parent = await mount(Parent, fixture);

    parent.state.numbers = [1, 3];
    await nextTick();
    expect(fixture.innerHTML).toBe(`<div><p>1</p><p>3</p></div>`);
  });

  test("list of sub components inside other nodes", async () => {
    // this confuses the patching algorithm...
    class SubComponent extends Component {
      static template = xml`<span>asdf</span>`;
    }
    class Parent extends Component {
      static template = xml`
      <div>
          <div t-foreach="state.blips" t-as="blip" t-key="blip.id">
              <SubComponent />
          </div>
      </div>`;
      static components = { SubComponent };
      state = useState({
        blips: [
          { a: "a", id: 1 },
          { b: "b", id: 2 },
          { c: "c", id: 4 },
        ],
      });
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><span>asdf</span></div><div><span>asdf</span></div><div><span>asdf</span></div></div>"
    );
    parent.state.blips.splice(0, 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>asdf</span></div><div><span>asdf</span></div></div>"
    );
  });

  test("t-foreach with t-component, and update", async () => {
    class Child extends Component {
      static template = xml`
          <span>
            <t t-esc="state.val"/>
            <t t-esc="props.val"/>
          </span>`;
      state = useState({ val: "A" });
      setup() {
        onMounted(() => {
          this.state.val = "B";
        });
      }
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
          <div>
            <t t-foreach="Array(2)" t-as="n" t-key="n_index">
              <Child val="n_index"/>
            </t>
          </div>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>A0</span><span>A1</span></div>");

    await nextTick(); // wait for changes triggered in mounted to be applied
    expect(fixture.innerHTML).toBe("<div><span>B0</span><span>B1</span></div>");
  });
});
