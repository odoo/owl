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

    expectSpy(spyEffect, 1, []);
    expectSpy(spyDerived, 1, [], 2);
    await waitScheduler();
    expectSpy(spyEffect, 2, []);
    expectSpy(spyDerived, 2, [], 6);
    state.b = 4;
    await waitScheduler();
    expectSpy(spyEffect, 3, []);
    expectSpy(spyDerived, 3, [], 12);
  });

  test("derived does not update when unrelated property changes, but updates when dependencies change", async () => {
    const state = reactive({ a: 1, b: 2, c: 3 });
    const spyDerived = jest.fn(() => state.a + state.b);
    const d = derived(spyDerived);
    const spyEffect = jest.fn(() => d());
    effect(spyEffect);

    expectSpy(spyEffect, 1, []);
    expectSpy(spyDerived, 1, [], 3);

    state.c = 10;
    await waitScheduler();
    expectSpy(spyEffect, 1, []);
    expectSpy(spyDerived, 1, [], 3);
  });

  test("derived does not notify when value is unchanged", async () => {
    const state = reactive({ a: 1, b: 2 });
    const d = derived(() => state.a + state.b);
    const spy = jest.fn();
    effect(() => spy(d()));
    expectSpy(spy, 1, [3]);
    state.a = 1;
    state.b = 2;
    await waitScheduler();
    expectSpy(spy, 1, [3]);
  });

  test("multiple deriveds can depend on same state", async () => {
    const state = reactive({ a: 1, b: 2 });
    const d1 = derived(() => state.a + state.b);
    const d2 = derived(() => state.a * state.b);
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    effect(() => spy1(d1()));
    effect(() => spy2(d2()));
    expectSpy(spy1, 1, [3]);
    expectSpy(spy2, 1, [2]);
    state.a = 3;
    await waitScheduler();
    expectSpy(spy1, 2, [5]);
    expectSpy(spy2, 2, [6]);
  });

  test("derived can return objects", async () => {
    const state = reactive({ a: 1, b: 2 });
    const d = derived(() => state.a + state.b);
    const spy = jest.fn();
    effect(() => spy(d()));
    expectSpy(spy, 1, [3]);
    state.a = 5;
    await waitScheduler();
    expectSpy(spy, 2, [7]);
  });

  test("derived can depend on arrays", async () => {
    const state = reactive({ arr: [1, 2, 3] });
    const d = derived(() => state.arr.reduce((a, b) => a + b, 0));
    const spy = jest.fn();
    effect(() => spy(d()));
    expectSpy(spy, 1, [6]);
    state.arr.push(4);
    await waitScheduler();
    expectSpy(spy, 2, [10]);
    state.arr[0] = 10;
    await waitScheduler();
    expectSpy(spy, 3, [19]);
  });

  test("derived can depend on nested reactives", async () => {
    const state = reactive({ nested: { a: 1 } });
    const d = derived(() => state.nested.a * 2);
    const spy = jest.fn();
    effect(() => spy(d()));
    expectSpy(spy, 1, [2]);
    state.nested.a = 5;
    await waitScheduler();
    expectSpy(spy, 2, [10]);
  });

  test("derived can be called multiple times and returns same value if unchanged", async () => {
    const state = reactive({ a: 1, b: 2 });

    const spy = jest.fn(() => state.a + state.b);
    const d = derived(spy);
    expect(spy).not.toHaveBeenCalled();
    expect(d()).toBe(3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveReturnedWith(3);
    expect(d()).toBe(3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveReturnedWith(3);
    state.a = 2;
    await waitScheduler();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(d()).toBe(4);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveReturnedWith(4);
    expect(d()).toBe(4);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveReturnedWith(4);
  });

  test("derived should not subscribe to change if no effect is using it", async () => {
    const state = reactive({ a: 1, b: 10 });
    const spy = jest.fn();
    const d = derived(() => spy(state.a));
    expect(spy).not.toHaveBeenCalled();
    const unsubscribe = effect(() => {
      d();
    });
    expectSpy(spy, 1, [1]);
    state.a = 2;
    await waitScheduler();
    expectSpy(spy, 2, [2]);
    unsubscribe();
    state.a = 3;
    await waitScheduler();
    expectSpy(spy, 2, [2]);
  });

  test("derived should not be recomputed when called from effect if none of its source changed", async () => {
    const state = reactive({ a: 1 });
    const spy = jest.fn(() => state.a * 0);
    const d = derived(spy);
    expect(spy).not.toHaveBeenCalled();
    effect(() => {
      d();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    state.a = 2;
    await waitScheduler();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
describe("unsubscription", () => {
  const memos: Derived<any, any>[] = [];
  beforeAll(() => {
    setSignalHooks({ onDerived: (m: Derived<any, any>) => memos.push(m) });
  });
  afterAll(() => {
    resetSignalHooks();
  });
  afterEach(() => {
    memos.length = 0;
  });

  test("derived shoud unsubscribes from dependencies when effect is unsubscribed", async () => {
    const state = reactive({ a: 1, b: 2 });
    const d = derived(() => state.a + state.b);
    d();
    expect(memos[0]!.observers.size).toBe(0);
    const unsubscribe = effect(() => d());
    expect(memos[0]!.observers.size).toBe(1);
    unsubscribe();
    expect(memos[0]!.observers.size).toBe(0);
  });
});
describe("nested derived", () => {
  test("derived can depend on another derived", async () => {
    const state = reactive({ a: 1, b: 2 });
    const d1 = derived(() => state.a + state.b);
    const d2 = derived(() => d1() * 2);
    const spy = jest.fn();
    effect(() => spy(d2()));
    expectSpy(spy, 1, [6]);
    state.a = 3;
    await waitScheduler();
    expectSpy(spy, 2, [10]);
  });
});
