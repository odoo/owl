import {
  Component,
  mount,
  onPatched,
  onRender,
  onWillPatch,
  onWillUnmount,
  useState,
} from "../../src";
import { xml } from "../../src/tags";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("reactivity in lifecycle", () => {
  test("can use a state hook", async () => {
    class Counter extends Component {
      static template = xml`<div><t t-esc="counter.value"/></div>`;
      counter = useState({ value: 42 });
    }
    const counter = await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.value = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("state changes in willUnmount do not trigger rerender", async () => {
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`
          <span><t t-esc="props.val"/><t t-esc="state.n"/></span>
        `;
      state = useState({ n: 2 });
      setup() {
        onRender(() => {
          steps.push("render");
        });
        onWillPatch(() => {
          steps.push("willPatch");
        });
        onPatched(() => {
          steps.push("patched");
        });
        onWillUnmount(() => {
          steps.push("willUnmount");
          this.state.n = 3;
        });
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Child t-if="state.flag" val="state.val"/>
          </div>
        `;
      static components = { Child };
      state = useState({ val: 1, flag: true });
    }
    const parent = await mount(Parent, fixture);
    expect(steps).toEqual(["render"]);
    expect(fixture.innerHTML).toBe("<div><span>12</span></div>");
    parent.state.flag = false;
    await nextTick();
    // we make sure here that no call to __render is done
    expect(steps).toEqual(["render", "willUnmount"]);
  });

  test("change state just before mounting component", async () => {
    // const steps: number[] = [];
    // class TestWidget extends Component {
    //   static template = xml`
    //       <div><t t-esc="state.val"/></div>
    //     `;
    //   state = useState({ val: 1 });
    //   __render(f) {
    //     steps.push(this.state.val);
    //     return super.__render(f);
    //   }
    // }
    // TestWidget.prototype.__render = jest.fn(TestWidget.prototype.__render);
    // const widget = new TestWidget();
    // widget.state.val = 2;
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>2</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(1);
    // // unmount and re-mount, as in this case, willStart won't be called, so it's
    // // slightly different
    // widget.unmount();
    // widget.state.val = 3;
    // await widget.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div>3</div>");
    // expect(TestWidget.prototype.__render).toHaveBeenCalledTimes(2);
    // expect(steps).toEqual([2, 3]);
  });

  test("change state while mounting component", async () => {
    const steps: any[] = [];
    let STATE;
    class Comp extends Component {
      static template = xml`
          <div><t t-esc="state.val"/></div>
        `;
      state = useState({ val: 1 });
      setup() {
        STATE = this.state;
        onRender(() => {
          steps.push(this.state.val);
        });
      }
    }
    const prom = mount(Comp, fixture);
    (STATE as any).val = 2;
    await prom;
    expect(steps).toEqual([2]);
    expect(fixture.innerHTML).toBe("<div>2</div>");
  });
});
