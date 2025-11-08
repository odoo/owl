import { Component, mount, onWillStart, onWillUpdateProps, xml } from "../../src";
import { elem, makeDeferred, makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import { signal, derivedAsync, derived } from "../../src/runtime/signals";
import { Deffered } from "./task.test";

let fixture: HTMLElement;

// snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

// jest.setTimeout(100_000_000);
describe("derivedAsync", () => {
  test("test async", async () => {
    const [a, setA] = signal(1);
    class Child extends Component {
      static props = {
        n: Number,
      };
      setup() {
        onWillUpdateProps(async (nextProps) => {
          // console.log("updating props");
          await nextTick();
          return nextProps;
        });
        onWillStart(async () => {
          // console.log("will start2");
        });
      }
      static template = xml`<t t-out="this.props.n"/>`;
    }
    class Test extends Component {
      a = a;
      static template = xml`<span>n: <t t-out="this.a()"/>, <Child n="this.a()"/></span>`;
      static components = { Child };
      setup() {
        onWillStart(async () => {
          // console.log("will start");
        });
      }
    }

    const component = await mount(Test, fixture);

    await nextTick();
    expect(fixture.innerHTML).toBe("<span>n: 1, 1</span>");
    (window as any).d = true;
    setA(2);
    await nextTick();
    await nextTick();

    expect(fixture.innerHTML).toBe("<span>n: 2, 2</span>");
  });
  test("basic async derived - read before await", async () => {
    const [a, setA] = signal(1);
    const deferreds: Deffered[] = [];
    const d1 = derivedAsync(async () => {
      const deferred = makeDeferred<number>();
      deferreds.push(deferred);
      const _a = a();
      const b = await deferred;
      return _a + b + 100;
    });
    class Test extends Component {
      d1 = d1;
      static template = xml`<span>n: <t t-out="this.d1()" /></span>`;
    }

    const componentPromise = mount(Test, fixture);

    await nextTick();
    expect(fixture.innerHTML).toBe("");

    expect(deferreds.length).toBe(1);
    deferreds[0].resolve(10);
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>n: 111</span>");

    setA(2);
    await nextTick();
    expect(deferreds.length).toBe(2);
    expect(fixture.innerHTML).toBe("<span>n: 111</span>");
    deferreds[1].resolve(20);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>n: 122</span>");

    const component = await componentPromise;
    expect(elem(component)).toEqual(fixture.querySelector("span"));
  });
  test.only("basic async derived - read after await", async () => {
    const [a, setA] = signal(1);
    const deferreds: Deffered[] = [];
    const d1 = derivedAsync(async () => {
      const deferred = makeDeferred<number>();
      deferreds.push(deferred);
      const b = await deferred;
      return a() + b + 100;
    });
    class Test extends Component {
      d1 = d1;
      static template = xml`<span>n: <t t-out="this.d1()" /></span>`;
    }

    const componentPromise = mount(Test, fixture);

    await nextTick();
    expect(fixture.innerHTML).toBe("");

    expect(deferreds.length).toBe(1);
    deferreds[0].resolve(10);
    await nextTick();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>n: 111</span>");

    setA(2);
    await nextTick();
    expect(deferreds.length).toBe(2);
    expect(fixture.innerHTML).toBe("<span>n: 111</span>");
    deferreds[1].resolve(20);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>n: 122</span>");

    const component = await componentPromise;
    expect(elem(component)).toEqual(fixture.querySelector("span"));
  });
});
