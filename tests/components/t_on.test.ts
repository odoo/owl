import { Component, mount, onMounted, useState, xml } from "../../src/index";
import { elem, logStep, makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import { status } from "../../src/runtime/status";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-on", () => {
  test("t-on on destroyed components", async () => {
    const steps: string[] = [];
    let child: any;
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
    let el = elem(child!);
    el.click();
    expect(steps).toEqual(["click"]);
    (parent as any).state.flag = false;
    await nextTick();
    expect(status(child as any)).toBe("destroyed");
    el.click();
    expect(steps).toEqual(["click"]);
  });

  test("t-on when first component child is an empty component", async () => {
    class Child extends Component {
      static template = xml`
        <span t-foreach="props.list" t-as="c" t-key="c_index" t-esc="c"/>
      `;
    }
    class Parent extends Component {
      static template = xml`
        <div t-on-click="push"><Child list="list" t-on-click="() => {}"/></div>
      `;
      static components = { Child };
      list = useState([] as string[]);
      push() {
        this.list.push("foo");
      }
    }
    const parent = await mount(Parent, fixture);
    const el = elem(parent);
    expect(el.innerHTML).toBe("");
    el.click();
    await nextTick();
    expect(el.innerHTML).toBe("<span>foo</span>");
  });

  test("t-on expression in t-foreach", async () => {
    class Comp extends Component {
      static template = xml`
          <div>
            <div t-foreach="state.values" t-as="val" t-key="val">
              <t t-esc="val_index"/>: <t t-esc="val + ''"/>
              <button t-on-click="() => otherState.vals.push(val)">Expr</button>
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
              <button t-on-click="() => otherState.vals.push(val + '_' + bossa)">Expr</button>
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
              <button t-on-click="() => this.addVal(val)">meth call</button>
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
              <button t-on-click="() => otherState.vals.push(iter + '_' + iter)">expr</button>
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

  test("t-on on components", async () => {
    class Child extends Component {
      static template = xml`<button t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`<Child t-on-click="increment" value="state.value"/>`;
      static components = { Child };
      state = useState({ value: 1 });
      increment() {
        this.state.value++;
      }
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<button>1</button>");
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>2</button>");
  });

  test("t-on on components, variation", async () => {
    class Child extends Component {
      static template = xml`<button t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <span/>
          <Child t-on-click="increment" value="state.value"/>
          <p/>
        </div>`;
      static components = { Child };
      state = useState({ value: 1 });
      increment() {
        this.state.value++;
      }
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span></span><button>1</button><p></p></div>");

    fixture.querySelector("span")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span></span><button>1</button><p></p></div>");

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span></span><button>2</button><p></p></div>");

    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span></span><button>2</button><p></p></div>");
  });

  test("t-on on component next to t-on on div", async () => {
    class Child extends Component {
      static template = xml`<button t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Child t-on-click="increment" value="state.value"/>
          <p t-on-click="decrement">dec</p>
        </div>`;
      static components = { Child };
      state = useState({ value: 1 });
      increment() {
        this.state.value++;
      }
      decrement() {
        this.state.value--;
      }
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><button>1</button><p>dec</p></div>");
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>2</button><p>dec</p></div>");
    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>1</button><p>dec</p></div>");
  });

  test("t-on on t-slots", async () => {
    class Child extends Component {
      static template = xml`
        [<t t-esc="state.count"/>]
        <t t-slot="default" t-on-click="() => this.state.count++"/>`;

      state = useState({ count: 0 });
    }

    class Parent extends Component {
      static template = xml`
        <Child>
          <p>something</p>
        </Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(" [0] <p>something</p>");
    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe(" [1] <p>something</p>");
  });

  test("t-on on t-set-slots", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="myslot"/>`;
    }

    class Parent extends Component {
      static template = xml`
        [<t t-esc="state.count"/>]
        <Child>
          <t t-set-slot="myslot" t-on-click="() => this.state.count++">
            <p>something</p>
            <p>paragraph</p>
          </t>
        </Child>`;
      static components = { Child };
      state = useState({ count: 0 });
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(" [0] <p>something</p><p>paragraph</p>");
    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe(" [1] <p>something</p><p>paragraph</p>");
  });

  test("t-on on components, with 'prevent' modifier", async () => {
    expect.assertions(4); // 2 snaps and 2 expects
    class Child extends Component {
      static template = xml`<button t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`<Child t-on-click.prevent="increment" value="state.value"/>`;
      static components = { Child };
      state = useState({ value: 1 });
      increment(ev: MouseEvent) {
        expect(ev.defaultPrevented).toBe(true);
        this.state.value++;
      }
    }
    await mount(Parent, fixture);
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>2</button>");
  });

  test("t-on on slot, with 'prevent' modifier", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default" t-on-click.prevent="doSomething"/>`;
      doSomething(ev: MouseEvent) {
        expect(ev.defaultPrevented).toBe(true);
        logStep("hey");
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child>
          <button>button</button>
        </Child>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>button</button>");
    expect(["hey"]).toBeLogged();
  });

  test("t-on on components and t-foreach", async () => {
    class Child extends Component {
      static template = xml`<div t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`
        <t t-foreach="['John', 'Raoul', 'Gérald']" t-as="name" t-key="name">
          <Child t-on-click="() => this.log(name)" value="name"/>
        </t>`;
      static components = { Child };
      log(name: string) {
        logStep(name);
      }
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>John</div><div>Raoul</div><div>Gérald</div>");
    expect([]).toBeLogged();
    fixture.querySelectorAll("div")[0].click();
    await nextTick();
    expect(["John"]).toBeLogged();

    fixture.querySelectorAll("div")[1].click();
    await nextTick();
    expect(["Raoul"]).toBeLogged();

    fixture.querySelectorAll("div")[2].click();
    await nextTick();
    expect(["Gérald"]).toBeLogged();
  });

  test("t-on on components, with a handler update", async () => {
    class Child extends Component {
      static template = xml`<div t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`
          <t t-set="name" t-value="state.name"/>
          <Child value="name" t-on-click="() => this.log(name)"
        />`;
      static components = { Child };
      state = useState({ name: "aaron" });
      log(name: string) {
        logStep(name);
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>aaron</div>");
    expect([]).toBeLogged();

    fixture.querySelectorAll("div")[0].click();
    await nextTick();
    expect(["aaron"]).toBeLogged();

    parent.state.name = "lucas";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>lucas</div>");

    fixture.querySelectorAll("div")[0].click();
    await nextTick();
    expect(["lucas"]).toBeLogged();
  });
});
