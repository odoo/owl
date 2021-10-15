import { Component, mount, onMounted, useState, xml } from "../../src/index";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import { status } from "../../src/component/status";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-on", () => {
  test("t-on on destroyed components", async () => {
    const steps: string[] = [];
    let child;
    class Child extends Component {
      static template = xml`<div t-on-click="onClick"/>`;
      setup() {
        onMounted(() => {
          child = this;
        });
      }
      onClick() {
        steps.push("click");
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
    }
    const parent = await mount(Parent, fixture);
    let el = (child as any).el as HTMLElement;
    el.click();
    expect(steps).toEqual(["click"]);
    (parent as any).state.flag = false;
    await nextTick();
    expect(status(child as any)).toBe("destroyed");
    el.click();
    expect(steps).toEqual(["click"]);
  });

  test("t-on expression in t-foreach", async () => {
    class Comp extends Component {
      static template = xml`
          <div>
            <div t-foreach="state.values" t-as="val" t-key="val">
              <t t-esc="val_index"/>: <t t-esc="val + ''"/>
              <button t-on-click="otherState.vals.push(val)">Expr</button>
            </div>
          </div>
        `;
      state = useState({ values: ["a", "b"] });
      otherState = { vals: [] };
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div>0: a<button>Expr</button></div><div>1: b<button>Expr</button></div></div>"
    );
    expect(comp.otherState.vals).toStrictEqual([]);
    const buttons = fixture.querySelectorAll("button");
    buttons[0].click();
    buttons[1].click();
    expect(comp.otherState.vals).toStrictEqual(["a", "b"]);
  });

  test("t-on expression in t-foreach with t-set", async () => {
    class Comp extends Component {
      static template = xml`
          <div>
            <t t-set="bossa" t-value="'nova'"/>
            <div t-foreach="state.values" t-as="val" t-key="val">
              <t t-set="bossa" t-value="bossa + '_' + val_index" />
              <t t-esc="val_index"/>: <t t-esc="val + ''"/>
              <button t-on-click="otherState.vals.push(val + '_' + bossa)">Expr</button>
            </div>
          </div>
        `;
      state = useState({ values: ["a", "b"] });
      otherState = { vals: [] };
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div>0: a<button>Expr</button></div><div>1: b<button>Expr</button></div></div>"
    );
    expect(comp.otherState.vals).toStrictEqual([]);
    const buttons = fixture.querySelectorAll("button");
    buttons[0].click();
    buttons[1].click();
    expect(comp.otherState.vals).toStrictEqual(["a_nova_0", "b_nova_0_1"]);
  });

  test("t-on method call in t-foreach", async () => {
    class Comp extends Component {
      static template = xml`
          <div>
            <div t-foreach="state.values" t-as="val" t-key="val">
              <t t-esc="val_index"/>: <t t-esc="val + ''"/>
              <button t-on-click="addVal(val)">meth call</button>
            </div>
          </div>
        `;
      state = useState({ values: ["a", "b"] });
      otherState = { vals: new Array<string>() };
      addVal(val: string) {
        this.otherState.vals.push(val);
      }
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div>0: a<button>meth call</button></div><div>1: b<button>meth call</button></div></div>"
    );
    expect(comp.otherState.vals).toStrictEqual([]);
    const buttons = fixture.querySelectorAll("button");
    buttons[0].click();
    buttons[1].click();
    expect(comp.otherState.vals).toStrictEqual(["a", "b"]);
  });

  test("t-on expression captured in t-foreach", async () => {
    class Comp extends Component {
      static template = xml`
          <div>
            <t t-set="iter" t-value="0" />
            <div t-foreach="arr" t-as="val" t-key="val">
              <button t-on-click="otherState.vals.push(iter + '_' + iter)">expr</button>
              <t t-set="iter" t-value="iter + 1" />
            </div>
          </div>
        `;
      arr = ["a", "b"];
      otherState = { vals: new Array<string>() };
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><button>expr</button></div><div><button>expr</button></div></div>"
    );
    expect(comp.otherState.vals).toStrictEqual([]);
    const buttons = fixture.querySelectorAll("button");
    buttons[0].click();
    buttons[1].click();
    expect(comp.otherState.vals).toStrictEqual(["0_0", "1_1"]);
  });
});
