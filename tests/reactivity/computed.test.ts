import { proxy, computed, signal } from "../../src";
import { atomSymbol, ComputationAtom } from "../../src/runtime/reactivity/computations";
import { expectSpy, nextMicroTick, spyEffect } from "../helpers";

async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

export type SpyComputed<T> = (() => T) & { spy: jest.Mock<any, T[]> };
export function spyComputed<T>(fn: () => T): SpyComputed<T> {
  const spy = jest.fn(fn);
  const d = computed(spy) as SpyComputed<T>;
  d.spy = spy;
  return d;
}

test("computed returns correct initial value", () => {
  const state = proxy({ a: 1, b: 2 });
  const d = computed(() => state.a + state.b);
  expect(d()).toBe(3);
});

test("computed should not run until being called", () => {
  const state = proxy({ a: 1 });
  const d = spyComputed(() => state.a + 100);
  expect(d.spy).not.toHaveBeenCalled();
  expect(d()).toBe(101);
  expect(d.spy).toHaveBeenCalledTimes(1);
});

test("computed updates when dependencies change", async () => {
  const state = proxy({ a: 1, b: 2 });

  const d = spyComputed(() => state.a * state.b);
  const e = spyEffect(() => d());
  e();

  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 2 });
  state.a = 3;
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 2, { result: 6 });
  state.b = 4;
  await waitScheduler();
  expectSpy(e.spy, 3);
  expectSpy(d.spy, 3, { result: 12 });
});

test("computed should not update even if the effect updates", async () => {
  const state = proxy({ a: 1, b: 2 });
  const d = spyComputed(() => state.a);
  const e = spyEffect(() => state.b + d());
  e();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 1 });
  // change unrelated state
  state.b = 3;
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 1, { result: 1 });
});

test("computed does not update when unrelated property changes, but updates when dependencies change", async () => {
  const state = proxy({ a: 1, b: 2, c: 3 });
  const d = spyComputed(() => state.a + state.b);
  const e = spyEffect(() => d());
  e();

  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 3 });

  state.c = 10;
  await waitScheduler();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 3 });
});

test("computed does not notify when value is unchanged", async () => {
  const state = proxy({ a: 1, b: 2 });
  const d = spyComputed(() => state.a + state.b);
  const e = spyEffect(() => d());
  e();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 3 });
  state.a = 1;
  state.b = 2;
  await waitScheduler();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 3 });
});

test("multiple deriveds can depend on same state", async () => {
  const state = proxy({ a: 1, b: 2 });
  const d1 = spyComputed(() => state.a + state.b);
  const d2 = spyComputed(() => state.a * state.b);
  const e1 = spyEffect(() => d1());
  const e2 = spyEffect(() => d2());
  e1();
  e2();
  expectSpy(e1.spy, 1);
  expectSpy(d1.spy, 1, { result: 3 });
  expectSpy(e2.spy, 1);
  expectSpy(d2.spy, 1, { result: 2 });
  state.a = 3;
  await waitScheduler();
  expectSpy(e1.spy, 2);
  expectSpy(d1.spy, 2, { result: 5 });
  expectSpy(e2.spy, 2);
  expectSpy(d2.spy, 2, { result: 6 });
});

test("computed can depend on arrays", async () => {
  const state = proxy({ arr: [1, 2, 3] });
  const d = spyComputed(() => state.arr.reduce((a, b) => a + b, 0));
  const e = spyEffect(() => d());
  e();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 6 });
  state.arr.push(4);
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 2, { result: 10 });
  state.arr[0] = 10;
  await waitScheduler();
  expectSpy(e.spy, 3);
  expectSpy(d.spy, 3, { result: 19 });
});

test("computed can depend on nested proxys", async () => {
  const state = proxy({ nested: { a: 1 } });
  const d = spyComputed(() => state.nested.a * 2);
  const e = spyEffect(() => d());
  e();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 2 });
  state.nested.a = 5;
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 2, { result: 10 });
});

test("computed can be called multiple times and returns same value if unchanged", async () => {
  const state = proxy({ a: 1, b: 2 });

  const d = spyComputed(() => state.a + state.b);
  expect(d.spy).not.toHaveBeenCalled();
  expect(d()).toBe(3);
  expectSpy(d.spy, 1, { result: 3 });
  expect(d()).toBe(3);
  expectSpy(d.spy, 1, { result: 3 });
  state.a = 2;
  await waitScheduler();
  expectSpy(d.spy, 1, { result: 3 });
  expect(d()).toBe(4);
  expectSpy(d.spy, 2, { result: 4 });
  expect(d()).toBe(4);
  expectSpy(d.spy, 2, { result: 4 });
});

test("computed should not subscribe to change if no effect is using it", async () => {
  const state = proxy({ a: 1, b: 10 });
  const d = spyComputed(() => state.a);
  expect(d.spy).not.toHaveBeenCalled();
  const e = spyEffect(() => {
    d();
  });
  const unsubscribe = e();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 1 });
  state.a = 2;
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 2, { result: 2 });
  unsubscribe();
  state.a = 3;
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 2, { result: 2 });
});

test("computed should not be recomputed when called from effect if none of its source changed", async () => {
  const state = proxy({ a: 1 });
  const d = spyComputed(() => state.a * 0);
  expect(d.spy).not.toHaveBeenCalled();
  const e = spyEffect(() => {
    d();
  });
  e();
  expectSpy(e.spy, 1);
  expectSpy(d.spy, 1, { result: 0 });
  state.a = 2;
  await waitScheduler();
  expectSpy(e.spy, 2);
  expectSpy(d.spy, 2, { result: 0 });
});

describe("unsubscription", () => {
  test("computed shoud unsubscribes from dependencies when effect is unsubscribed", async () => {
    function computedWithDerived<T>(fn: () => T): SpyComputed<T> & { atom: ComputationAtom } {
      const compute: any = spyComputed(fn);
      compute.atom = compute[atomSymbol];
      return compute;
    }

    const state = proxy({ a: 1, b: 2 });
    const d = computedWithDerived(() => state.a + state.b);
    const e = spyEffect(() => d());
    d();
    expect(d.atom.observers.size).toBe(0);
    const unsubscribe = e();
    expect(d.atom.observers.size).toBe(1);
    unsubscribe();
    expect(d.atom.observers.size).toBe(0);
  });
});

describe("nested computed", () => {
  test("computed can depend on another computed", async () => {
    const state = proxy({ a: 1, b: 2 });
    const d1 = spyComputed(() => state.a + state.b);
    const d2 = spyComputed(() => d1() * 2);
    const e = spyEffect(() => d2());
    e();
    expectSpy(e.spy, 1);
    expectSpy(d1.spy, 1, { result: 3 });
    expectSpy(d2.spy, 1, { result: 6 });
    state.a = 3;
    await waitScheduler();
    expectSpy(e.spy, 2);
    expectSpy(d1.spy, 2, { result: 5 });
    expectSpy(d2.spy, 2, { result: 10 });
  });

  test("nested computed should not recompute if none of its sources changed", async () => {
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
    const state = proxy({ a: 1 });
    const d1 = spyComputed(() => state.a);
    const d2 = spyComputed(() => d1() * 0);
    const e = spyEffect(() => d2());
    e();
    expectSpy(e.spy, 1);
    expectSpy(d1.spy, 1, { result: 1 });
    expectSpy(d2.spy, 1, { result: 0 });
    state.a = 3;
    await waitScheduler();
    expectSpy(e.spy, 2);
    expectSpy(d1.spy, 2, { result: 3 });
    expectSpy(d2.spy, 2, { result: 0 });
  });

  test("recompute children if source changed", async () => {
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
    const state = proxy({ a: 1 });
    const d1 = spyComputed(() => state.a);
    const d2 = spyComputed(() => d1() + 1); // 1 + 1 = 2
    const d3 = spyComputed(() => d1() + 2); // 1 + 2 = 3
    const d4 = spyComputed(() => d2() + d3()); // 2 + 3 = 5
    const e = spyEffect(() => d4());
    e();
    expectSpy(e.spy, 1);
    expectSpy(d1.spy, 1, { result: 1 });
    expectSpy(d2.spy, 1, { result: 2 });
    expectSpy(d3.spy, 1, { result: 3 });
    expectSpy(d4.spy, 1, { result: 5 });
    state.a = 2;
    await waitScheduler();
    expectSpy(e.spy, 2);
    expectSpy(d1.spy, 2, { result: 2 });
    expectSpy(d2.spy, 2, { result: 3 });
    expectSpy(d3.spy, 2, { result: 4 });
    expectSpy(d4.spy, 2, { result: 7 });
  });
});
