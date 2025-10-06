import { Memo } from "../src/common/types";
import { derived, effect, hooks, reactive } from "../src/runtime/reactivity";
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
    const d = derived(() => state.a * state.b);
    const spy = jest.fn();
    effect(() => spy(d()));
    expectSpy(spy, 1, [2]);
    state.a = 3;
    await waitScheduler();
    expectSpy(spy, 2, [6]);
    state.b = 4;
    await waitScheduler();
    expectSpy(spy, 3, [12]);
  });

  test("derived does not update when unrelated property changes", async () => {
    const state = reactive({ a: 1, b: 2, c: 3 });
    const d = derived(() => state.a + state.b);
    const spy = jest.fn();
    effect(() => spy(d()));
    expectSpy(spy, 1, [3]);
    state.c = 10;
    await waitScheduler();
    expectSpy(spy, 1, [3]);
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
    // todo: should not be called unless in an effect
    expect(spy).toHaveBeenCalledTimes(2);
    expect(d()).toBe(4);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveReturnedWith(4);
    expect(d()).toBe(4);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveReturnedWith(4);
  });
});
describe("unsubscription", () => {
  let currentMakeMemo: any;
  let memos: Memo<any, any>[] = [];

  beforeAll(() => {
    currentMakeMemo = hooks.makeMemo;
  });
  afterAll(() => {
    hooks.makeMemo = currentMakeMemo;
  });
  beforeEach(() => {
    hooks.makeMemo = (m: Memo<any, any>) => memos.push(m);
  });
  afterEach(() => {
    memos.splice(0);
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
