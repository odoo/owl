import {
  Component,
  computed,
  mount,
  onPatched,
  onWillPatch,
  onWillUnmount,
  props,
  signal,
  proxy,
  xml,
} from "../../src";
import { atomSymbol, Atom } from "../../src/runtime/reactivity/computations";
import { makeTestFixture, nextTick, snapshotEverything, steps, useLogLifecycle } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("reactivity in lifecycle", () => {
  test("an external proxy object should be tracked", async () => {
    const obj1 = proxy({ value: 1 });
    const obj2 = proxy({ value: 100 });
    class TestSubComponent extends Component {
      obj2 = obj2;

      static template = xml`<div>
        <t t-out="this.obj2.value"/>
      </div>`;
    }
    class TestComponent extends Component {
      obj1 = obj1;
      static template = xml`<div>
        <t t-out="this.obj1.value"/>
        <TestSubComponent/>
      </div>`;
      static components = { TestSubComponent };
    }
    await mount(TestComponent, fixture);
    expect(fixture.innerHTML).toBe("<div>1<div>100</div></div>");
    obj1.value = 2;
    obj2.value = 200;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div>2<div>200</div></div>");
  });
  test("can use a state hook", async () => {
    class Counter extends Component {
      static template = xml`<div><t t-out="this.counter.value"/></div>`;
      counter = proxy({ value: 42 });
    }
    const counter = await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.value = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("can use a state hook 2", async () => {
    let n = 0;
    class Comp extends Component {
      static template = xml`<t t-set="noop" t-value="this.notify()"/><div><t t-out="this.state.a"/></div>`;
      state = proxy({ a: 5, b: 7 });
      notify() {
        n++;
      }
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("<div>5</div>");
    expect(n).toBe(1);
    comp.state.a = 11;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>11</div>");
    expect(n).toBe(2);
    comp.state.b = 13;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>11</div>");
    expect(n).toBe(2); // no new rendering occured: b was never read via state!
  });

  test("can use a state hook on Map", async () => {
    class Counter extends Component {
      static template = xml`<div><t t-out="this.counter.get('value')"/></div>`;
      counter = proxy(new Map([["value", 42]]));
    }
    const counter = await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");
    counter.counter.set("value", 3);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3</div>");
  });

  test("state changes in willUnmount do not trigger rerender", async () => {
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`
          <t t-set="noop" t-value="this.notify()"/>
          <span><t t-out="this.props.val"/><t t-out="this.state.n"/></span>
        `;
      props = props();
      state = proxy({ n: 2 });
      setup() {
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

      notify() {
        steps.push("render");
      }
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Child t-if="this.state.flag" val="this.state.val"/>
          </div>
        `;
      static components = { Child };
      state = proxy({ val: 1, flag: true });
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
    //       <div><t t-out="state.val"/></div>
    //     `;
    //   state = proxy({ val: 1 });
    //   __render(f) {
    //     steps.push(this.state.val);
    //     return super.__render(f);
    //   }
    // }
    // TestWidget.prototype.__render = vi.fn(TestWidget.prototype.__render);
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
          <t t-set="noop" t-value="this.notify()"/>
          <div><t t-out="this.state.val"/></div>
        `;
      state = proxy({ val: 1 });
      setup() {
        STATE = this.state;
      }
      notify() {
        steps.push(this.state.val);
      }
    }
    const prom = mount(Comp, fixture);
    (STATE as any).val = 2;
    await prom;
    // The first render happens synchronously (fast path, no willStart),
    // so the template executes with val=1. Then val=2 triggers a re-render.
    expect(steps).toEqual([1, 2]);
    expect(fixture.innerHTML).toBe("<div>2</div>");
  });

  test("Child component doesn't render when state they depend on changes but their parent is about to unmount them", async () => {
    class Child extends Component {
      static template = xml`<t t-out="this.props.state.content.a"/>`;
      props = props();
      setup() {
        useLogLifecycle(this);
      }
    }
    class Parent extends Component {
      static template = xml`<Child t-if="this.state.renderChild" state="this.state"/>`;
      static components = { Child };
      state: any = proxy({ renderChild: true, content: { a: 2 } });
      setup() {
        useLogLifecycle(this);
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("2");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:setup",
        "Parent:willStart",
        "Child:setup",
        "Child:willStart",
        "Child:mounted",
        "Parent:mounted",
      ]
    `);

    parent.state.content = null;
    parent.state.renderChild = false;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      [
        "Parent:willPatch",
        "Child:willUnmount",
        "Child:willDestroy",
        "Parent:patched",
      ]
    `);
  });

  test("Component is automatically subscribed to proxy object received as prop", async () => {
    let childRenderCount = 0;
    let parentRenderCount = 0;
    class Child extends Component {
      static template = xml`
          <t t-set="noop" t-value="this.notify()"/>
          <t t-out="this.props.obj.a"/><t t-out="this.props.proxyObj.b"/>`;
      props = props();
      notify() {
        childRenderCount++;
      }
    }
    class Parent extends Component {
      static template = xml`<t t-set="noop" t-value="this.notify()"/><Child obj="this.obj" proxyObj="this.proxyObj"/>`;
      static components = { Child };
      obj = { a: 1 };
      proxyObj = proxy({ b: 2 });
      notify() {
        parentRenderCount++;
      }
    }
    const comp = await mount(Parent, fixture);
    expect([parentRenderCount, childRenderCount]).toEqual([1, 1]);
    expect(fixture.innerHTML).toBe("12");
    comp.obj.a = 3; // non proxy object, shouldn't cause render
    await nextTick();
    expect([parentRenderCount, childRenderCount]).toEqual([1, 1]);
    expect(fixture.innerHTML).toBe("12");
    comp.proxyObj.b = 4;
    await nextTick();
    // Only child should be rendered: the parent never read the b key in proxyObj
    expect([parentRenderCount, childRenderCount]).toEqual([1, 2]);
    expect(fixture.innerHTML).toBe("34");
  });
});

describe("components and computed", () => {
  test("Child is not rerender when reactive is computed", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml``;

      setup() {
        steps.push("Child created");
      }
    }
    class Parent extends Component {
      static template = xml`<t t-out="this.c()"/><Child/>`;
      static components = { Child };

      c = computed(() => 1);

      setup() {
        steps.push("Parent created");
      }
    }

    await mount(Parent, fixture);
    expect(fixture.textContent).toBe("1");
    expect(steps.splice(0)).toEqual(["Parent created", "Child created"]);
  });

  test("simple component and computed value", async () => {
    class Parent extends Component {
      static template = xml`
            <t t-out="this.value++"/>
            <t t-out="this.c()"/>
        `;
      value = 1;
      c = computed(() => 1);
    }
    await mount(Parent, fixture);
    expect(fixture.textContent).toBe("11");
  });
});

test("reading reactive state in setup should work as expected", async () => {
  const s = signal(1);
  const steps: string[] = [];

  class B extends Component {
    static template = xml`<t t-out="this.c()"/>`;

    c = computed(() => s() + 1);

    setup() {
      // we read the content of the signal s in setup, not in render
      steps.push(`setup: ${this.c()}`);
    }
  }
  class A extends Component {
    static components = { B };
    static template = xml`<B/>`;
  }
  await mount(A, fixture);
  expect(fixture.innerHTML).toBe("2");
  s.set(33);
  await nextTick();
  expect(fixture.innerHTML).toBe("34");
  expect(steps).toEqual(["setup: 2"]);
});

describe("reactive cleanup on component destruction", () => {
  test("destroying a component with computed cleans up signal observers", async () => {
    const selectedId = signal(0);
    const selectedIdAtom: Atom = (selectedId as any)[atomSymbol];

    class Child extends Component {
      static template = xml`<span t-out="this.isSelected()"/>`;
      p = props();
      isSelected = computed(() => this.p.selected() === 1);
    }

    class Parent extends Component {
      static template = xml`<div><Child t-if="this.show()" selected="this.selectedId"/></div>`;
      static components = { Child };
      show = signal(true);
      selectedId = selectedId;
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>false</span></div>");

    // The child's isSelected computed should be in selectedId's observers
    expect(selectedIdAtom.observers.size).toBe(1);

    // Destroy the child by toggling show
    parent.show.set(false);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    // After child destruction, isSelected computed should be cleaned up
    // from selectedId's observers
    expect(selectedIdAtom.observers.size).toBe(0);
  });

  test("destroying multiple children with computeds cleans up all signal observers", async () => {
    const selectedId = signal(0);
    const selectedIdAtom: Atom = (selectedId as any)[atomSymbol];

    class Row extends Component {
      static template = xml`<span t-out="this.isSelected()"/>`;
      p = props();
      isSelected = computed(() => this.p.selected() === this.p.id);
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-foreach="this.rows()" t-as="row" t-key="row">
            <Row id="row" selected="this.selectedId"/>
          </t>
        </div>`;
      static components = { Row };
      rows = signal([1, 2, 3]);
      selectedId = selectedId;
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      "<div><span>false</span><span>false</span><span>false</span></div>"
    );

    // 3 row computeds should be in selectedId's observers
    expect(selectedIdAtom.observers.size).toBe(3);

    // Clear all rows
    parent.rows.set([]);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    // All computeds should be cleaned up
    expect(selectedIdAtom.observers.size).toBe(0);
  });

  test("benchmark-like scenario: signal.Array rows with computed isSelected", async () => {
    // This closely mimics the benchmark's owl3_signal setup
    const selectedId = signal(0);
    const selectedIdAtom: Atom = (selectedId as any)[atomSymbol];

    class TableRow extends Component {
      static template = xml`
        <tr t-att-class="this.isSelected() ? 'danger' : ''">
          <td t-out="this.p.row.id"/>
          <td><a t-out="this.p.row.label()"/></td>
        </tr>`;
      p = props();
      isSelected = computed(() => {
        return this.p.selected() === this.p.row.id;
      });
    }

    class Root extends Component {
      static template = xml`
        <table><tbody>
          <t t-foreach="this.rows()" t-as="row" t-key="row.id">
            <TableRow row="row" selected="this.selectedId"/>
          </t>
        </tbody></table>`;
      static components = { TableRow };
      rows = signal.Array<{ id: number; label: ReturnType<typeof signal<string>> }>([]);
      selectedId = selectedId;
    }

    function buildRows(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        label: signal(`Item ${i + 1}`),
      }));
    }

    const root = await mount(Root, fixture);
    expect(selectedIdAtom.observers.size).toBe(0);

    // Create rows
    root.rows.set(buildRows(10));
    await nextTick();
    expect(selectedIdAtom.observers.size).toBe(10);

    // Clear rows - this should clean up all computed observers
    root.rows.set([]);
    await nextTick();
    expect(fixture.querySelector("tbody")!.innerHTML).toBe("");
    expect(selectedIdAtom.observers.size).toBe(0);

    // Create again and clear again - should not accumulate
    root.rows.set(buildRows(5));
    await nextTick();
    expect(selectedIdAtom.observers.size).toBe(5);

    root.rows.set([]);
    await nextTick();
    expect(selectedIdAtom.observers.size).toBe(0);
  });
});
