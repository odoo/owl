import { reactive, effect } from "../src";
import { Derived } from "../src/common/types";
import { derived, resetSignalHooks, setSignalHooks } from "../src/runtime/signals";
// import * as signals from "../src/runtime/signals";
import { expectSpy, nextMicroTick } from "./helpers";

async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

describe("derived", () => {
  test("derived returns correct initial value", () => {
    const state = reactive({ a: 1, b: 2 });
    const d = derived(() => state.a + state.b);
    expect(d()).toBe(3);
  });

  test("derived should not run until being called", () => {
    const state = reactive({ a: 1 });
    const spy = jest.fn(() => state.a + 100);
    const d = derived(spy);
    expect(spy).not.toHaveBeenCalled();
    expect(d()).toBe(101);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("derived updates when dependencies change", async () => {
    const state = reactive({ a: 1, b: 2 });

    const spyDerived = jest.fn(() => state.a * state.b);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    effect(spyEffect);

    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 2 });
    state.a = 3;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 2, { result: 6 });
    state.b = 4;
    await waitScheduler();
    expectSpy(spyEffect, 3);
    expectSpy(spyDerived, 3, { result: 12 });
  });

  test("derived should not update even if the effect updates", async () => {
    const state = reactive({ a: 1, b: 2 });
    const spyDerived = jest.fn(() => state.a);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => state.b + d());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 1 });
    // change unrelated state
    state.b = 3;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 1, { result: 1 });
  });

  test("derived does not update when unrelated property changes, but updates when dependencies change", async () => {
    const state = reactive({ a: 1, b: 2, c: 3 });
    const spyDerived = jest.fn(() => state.a + state.b);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    effect(spyEffect);

    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 3 });

    state.c = 10;
    await waitScheduler();
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 3 });
  });

  test("derived does not notify when value is unchanged", async () => {
    const state = reactive({ a: 1, b: 2 });
    const spyDerived = jest.fn(() => state.a + state.b);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 3 });
    state.a = 1;
    state.b = 2;
    await waitScheduler();
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 3 });
  });

  test("multiple deriveds can depend on same state", async () => {
    const state = reactive({ a: 1, b: 2 });
    const spyDerived1 = jest.fn(() => state.a + state.b);
    const d1 = derived(spyDerived1);
    const spyDerived2 = jest.fn(() => state.a * state.b);
    const d2 = derived(spyDerived2);
    const spyEffect1 = jest.fn(() => d1());
    const spyEffect2 = jest.fn(() => d2());
    effect(spyEffect1);
    effect(spyEffect2);
    expectSpy(spyEffect1, 1);
    expectSpy(spyDerived1, 1, { result: 3 });
    expectSpy(spyEffect2, 1);
    expectSpy(spyDerived2, 1, { result: 2 });
    state.a = 3;
    await waitScheduler();
    expectSpy(spyEffect1, 2);
    expectSpy(spyDerived1, 2, { result: 5 });
    expectSpy(spyEffect2, 2);
    expectSpy(spyDerived2, 2, { result: 6 });
  });

  test("derived can depend on arrays", async () => {
    const state = reactive({ arr: [1, 2, 3] });
    const spyDerived = jest.fn(() => state.arr.reduce((a, b) => a + b, 0));
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 6 });
    state.arr.push(4);
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 2, { result: 10 });
    state.arr[0] = 10;
    await waitScheduler();
    expectSpy(spyEffect, 3);
    expectSpy(spyDerived, 3, { result: 19 });
  });

  test("derived can depend on nested reactives", async () => {
    const state = reactive({ nested: { a: 1 } });
    const spyDerived = jest.fn(() => state.nested.a * 2);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 2 });
    state.nested.a = 5;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 2, { result: 10 });
  });

  test("derived can be called multiple times and returns same value if unchanged", async () => {
    const state = reactive({ a: 1, b: 2 });

    const spy = jest.fn(() => state.a + state.b);
    const d = derived(spy);
    expect(spy).not.toHaveBeenCalled();
    expect(d()).toBe(3);
    expectSpy(spy, 1, { result: 3 });
    expect(d()).toBe(3);
    expectSpy(spy, 1, { result: 3 });
    state.a = 2;
    await waitScheduler();
    expectSpy(spy, 1, { result: 3 });
    expect(d()).toBe(4);
    expectSpy(spy, 2, { result: 4 });
    expect(d()).toBe(4);
    expectSpy(spy, 2, { result: 4 });
  });

  test("derived should not subscribe to change if no effect is using it", async () => {
    const state = reactive({ a: 1, b: 10 });
    const spyDerived = jest.fn(() => state.a);
    const d = derived(spyDerived);
    expect(spyDerived).not.toHaveBeenCalled();
    const spyEffect = jest.fn(() => {
      d();
    });
    const unsubscribe = effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 1 });
    state.a = 2;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 2, { result: 2 });
    unsubscribe();
    state.a = 3;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 2, { result: 2 });
  });

  test("derived should not be recomputed when called from effect if none of its source changed", async () => {
    const state = reactive({ a: 1 });
    const spyDerived = jest.fn(() => state.a * 0);
    const d = derived(spyDerived);
    expect(spyDerived).not.toHaveBeenCalled();
    const spyEffect = jest.fn(() => {
      d();
    });
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived, 1, { result: 0 });
    state.a = 2;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived, 2, { result: 0 });
  });
});
describe("unsubscription", () => {
  const deriveds: Derived<any, any>[] = [];
  beforeAll(() => {
    setSignalHooks({ onDerived: (m: Derived<any, any>) => deriveds.push(m) });
  });
  afterAll(() => {
    resetSignalHooks();
  });
  afterEach(() => {
    deriveds.length = 0;
  });

  test("derived shoud unsubscribes from dependencies when effect is unsubscribed", async () => {
    const state = reactive({ a: 1, b: 2 });
    const spyDerived = jest.fn(() => state.a + state.b);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    d();
    expect(deriveds[0]!.observers.size).toBe(0);
    const unsubscribe = effect(spyEffect);
    expect(deriveds[0]!.observers.size).toBe(1);
    unsubscribe();
    expect(deriveds[0]!.observers.size).toBe(0);
  });
});
describe("nested derived", () => {
  test("derived can depend on another derived", async () => {
    const state = reactive({ a: 1, b: 2 });
    const spyDerived1 = jest.fn(() => state.a + state.b);
    const d1 = derived(spyDerived1);
    const spyDerived2 = jest.fn(() => d1() * 2);
    const d2 = derived(spyDerived2);
    const spyEffect = jest.fn(() => d2());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived1, 1, { result: 3 });
    expectSpy(spyDerived2, 1, { result: 6 });
    state.a = 3;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived1, 2, { result: 5 });
    expectSpy(spyDerived2, 2, { result: 10 });
  });
  test("nested derived should not recompute if none of its sources changed", async () => {
    /**
     *   s1
     *    ↓
     *   d1 = s1 * 0
     *    ↓
     *   d2 = d1
     *    ↓
     *   e1
     *
     * change s1
     * -> d1 should recomputes but d2 should not
     */
    const state = reactive({ a: 1 });
    const spyDerived1 = jest.fn(() => state.a);
    const d1 = derived(spyDerived1);
    const spyDerived2 = jest.fn(() => d1() * 0);
    const d2 = derived(spyDerived2);
    const spyEffect = jest.fn(() => d2());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived1, 1, { result: 1 });
    expectSpy(spyDerived2, 1, { result: 0 });
    state.a = 3;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived1, 2, { result: 3 });
    expectSpy(spyDerived2, 2, { result: 0 });
  });
  test("find a better name", async () => {
    /**
     *        +-------+
     *        |  s1   |
     *        +-------+
     *            v
     *        +-------+
     *        |  d1   |
     *        +-------+
     *      v           v
     *  +-------+       +-------+
     *  |  d2   |       |  d3   |
     *  +-------+       +-------+
     *    |   v          v
     *    |    +-------+
     *    |    |  d4   |
     *    |    +-------+
     *    |      |
     *    v      v
     *    +-------+
     *    |  e1   |
     *    +-------+
     *
     * change s1
     * -> d1, d2, d3, d4, e1 should recomputes
     */
    const state = reactive({ a: 1 });
    const spyDerived1 = jest.fn(() => state.a);
    const d1 = derived(spyDerived1);
    const spyDerived2 = jest.fn(() => d1() + 1); // 1 + 1 = 2
    const d2 = derived(spyDerived2);
    const spyDerived3 = jest.fn(() => d1() + 2); // 1 + 2 = 3
    const d3 = derived(spyDerived3);
    const spyDerived4 = jest.fn(() => d2() + d3()); // 2 + 3 = 5
    const d4 = derived(spyDerived4);
    const spyEffect = jest.fn(() => d4());
    effect(spyEffect);
    expectSpy(spyEffect, 1);
    expectSpy(spyDerived1, 1, { result: 1 });
    expectSpy(spyDerived2, 1, { result: 2 });
    expectSpy(spyDerived3, 1, { result: 3 });
    expectSpy(spyDerived4, 1, { result: 5 });
    state.a = 2;
    await waitScheduler();
    expectSpy(spyEffect, 2);
    expectSpy(spyDerived1, 2, { result: 2 });
    expectSpy(spyDerived2, 2, { result: 3 });
    expectSpy(spyDerived3, 2, { result: 4 });
    expectSpy(spyDerived4, 2, { result: 7 });
  });
});
