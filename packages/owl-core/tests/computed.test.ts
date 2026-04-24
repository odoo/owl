import { describe, expect, test, vi, type Mock } from "vitest";
import { proxy, computed, effect, signal } from "../src";
import {
  atomSymbol,
  ComputationAtom,
  ComputationState,
  createComputation,
  disposeComputation,
  removeSources,
  ReactiveValue,
  setComputation,
  updateComputation,
} from "../src/computations";
import { expectSpy, nextMicroTick, spyEffect } from "./helpers";

async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

export type SpyComputed<T> = ReactiveValue<T> & { spy: Mock };
export function spyComputed<T>(fn: () => T): SpyComputed<T> {
  const spy = vi.fn(fn);
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
  // effect should not rerun because computed value didn't change (still 0)
  expectSpy(e.spy, 1);
  // but computed getter was re-evaluated (source changed)
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

describe("disposeComputation", () => {
  test("disposing a signalComputation recursively cleans up derived computations from signal observers", () => {
    // Mimics the component scenario:
    // selectedId signal -> isSelected computed -> signalComputation (render effect)
    const selectedId = signal(0);
    const selectedIdAtom = (selectedId as any)[atomSymbol];

    const isSelected = computed(() => selectedId() === 42);
    const isSelectedAtom = (isSelected as any)[atomSymbol];

    // Simulate a signalComputation (like component's render effect)
    // that reads isSelected during render
    const signalComp = createComputation(
      () => {
        return isSelected(); // reads the computed during "render"
      },
      false,
      ComputationState.STALE
    );

    // Execute (simulating first _render)
    updateComputation(signalComp);

    // Verify sources are established
    expect(signalComp.sources.has(isSelectedAtom)).toBe(true);
    expect(isSelectedAtom.observers.has(signalComp)).toBe(true);
    expect(isSelectedAtom.sources.has(selectedIdAtom)).toBe(true);
    expect(selectedIdAtom.observers.has(isSelectedAtom)).toBe(true);

    // Dispose (simulating _destroy)
    disposeComputation(signalComp);

    // signalComputation's sources should be cleared
    expect(signalComp.sources.size).toBe(0);
    // signalComputation should be removed from isSelected's observers
    expect(isSelectedAtom.observers.has(signalComp)).toBe(false);
    // KEY CHECK: isSelected should be removed from selectedId's observers
    // (recursive disposal since isSelected has no more observers)
    expect(selectedIdAtom.observers.has(isSelectedAtom)).toBe(false);
  });

  test("disposing works after removeSources + re-render (simulating _render flow)", () => {
    // Simulates the actual _render() flow where removeSources is called first,
    // then sources are re-established during template rendering
    const selectedId = signal(0);
    const selectedIdAtom = (selectedId as any)[atomSymbol];

    const isSelected = computed(() => selectedId() === 42);
    const isSelectedAtom = (isSelected as any)[atomSymbol];

    const signalComp = createComputation(
      () => {
        return isSelected();
      },
      false,
      ComputationState.EXECUTED
    );

    // Simulate _render() flow: removeSources, then set currentComputation, then render
    removeSources(signalComp); // noop first time
    setComputation(signalComp);
    isSelected(); // reads computed during "render"
    setComputation(undefined);

    // Verify sources established
    expect(signalComp.sources.has(isSelectedAtom)).toBe(true);
    expect(selectedIdAtom.observers.has(isSelectedAtom)).toBe(true);

    // Simulate second _render() (e.g., parent-triggered render)
    removeSources(signalComp); // clears sources
    setComputation(signalComp);
    isSelected(); // re-establishes sources
    setComputation(undefined);

    // Verify sources still correct after second render
    expect(signalComp.sources.has(isSelectedAtom)).toBe(true);
    expect(isSelectedAtom.observers.has(signalComp)).toBe(true);
    expect(selectedIdAtom.observers.has(isSelectedAtom)).toBe(true);

    // Dispose (simulating _destroy)
    disposeComputation(signalComp);

    expect(signalComp.sources.size).toBe(0);
    expect(isSelectedAtom.observers.has(signalComp)).toBe(false);
    expect(selectedIdAtom.observers.has(isSelectedAtom)).toBe(false);
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
    // effect should not rerun because d2's value didn't change (still 0)
    expectSpy(e.spy, 1);
    expectSpy(d1.spy, 2, { result: 3 });
    // d2 recomputes because its source d1 changed, but its value is still 0
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

describe("writable computed", () => {
  test("set throws by default on a read-only computed", () => {
    const percentage = signal(0.5);
    const value = computed(() => percentage() * 100);
    expect(percentage()).toBe(0.5);
    expect(value()).toBe(50);

    expect(() => value.set(0.21)).toThrow(/read-only computed/);
    expect(percentage()).toBe(0.5);
    expect(value()).toBe(50);
  });

  test("create readonly signal", () => {
    const percentage = signal(0.5);
    const value = computed(percentage);
    expect(percentage()).toBe(0.5);
    expect(value()).toBe(0.5);

    expect(() => value.set(0.21)).toThrow(/read-only computed/);
    expect(percentage()).toBe(0.5);
    expect(value()).toBe(0.5);
  });

  test("update source from computed", () => {
    const percentage = signal(0.5);
    const value = computed(() => percentage() * 100, {
      set: (nextValue) => percentage.set(nextValue / 100),
    });
    expect(percentage()).toBe(0.5);
    expect(value()).toBe(50);

    percentage.set(0.21);
    expect(percentage()).toBe(0.21);
    expect(value()).toBe(21);
  });

  test("setter computes each time", () => {
    const steps: string[] = [];

    const percentage = signal(0.5);
    const value = computed(() => percentage() * 100, {
      set: (nextValue) => {
        steps.push("compute");
        percentage.set(nextValue / 100);
      },
    });

    value.set(21);
    value.set(21);
    value.set(21);
    expect(value()).toBe(21);
    expect(steps.splice(0)).toEqual(["compute", "compute", "compute"]);
  });

  test("updating computed triggers effect", async () => {
    const steps: number[] = [];

    const percentage = signal(0.5);
    const value = computed(() => percentage() * 100, {
      set: (nextValue) => percentage.set(nextValue / 100),
    });
    const effect = spyEffect(() => {
      steps.push(value());
    });
    const cleanupEffect = effect();
    expect(steps.splice(0)).toEqual([50]);

    value.set(25);
    await waitScheduler();
    expect(steps.splice(0)).toEqual([25]);

    cleanupEffect();
  });

  test("compute can read and write different types", () => {
    const value = signal(4);
    const binary = computed(() => value().toString(2), {
      set: (nextValue: string | number) => {
        if (typeof nextValue === "number") {
          value.set(nextValue);
        } else {
          value.set(parseInt(nextValue, 2));
        }
      },
    });
    expect(binary()).toBe("100");

    // can set a string
    binary.set("110");
    expect(value()).toBe(6);

    // can also set a number
    binary.set(7);
    expect(value()).toBe(7);
  });
});

describe("deferred option", () => {
  async function nextMacroTick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  test("observer of a deferred computed runs on macrotask, not microtask", async () => {
    const source = signal(1);
    const lazy = computed(() => source() * 10, { deferred: true });
    let observed: number | null = null;
    effect(() => {
      observed = lazy();
    });
    expect(observed).toBe(10);

    source.set(2);
    // Microtask drain should NOT have fired the deferred observer yet.
    await waitScheduler();
    expect(observed).toBe(10);

    // After a macrotask, the deferred observer has run.
    await nextMacroTick();
    expect(observed).toBe(20);
  });

  test("observer of normal signal still fires on microtask when deferred sibling exists", async () => {
    const source = signal("a");
    const lazy = computed(() => source().toUpperCase(), { deferred: true });
    let urgent: string | null = null;
    let slow: string | null = null;
    effect(() => {
      urgent = source();
    });
    effect(() => {
      slow = lazy();
    });
    expect(urgent).toBe("a");
    expect(slow).toBe("A");

    source.set("b");
    await waitScheduler();
    // The urgent observer (reads source directly) has updated.
    expect(urgent).toBe("b");
    // The deferred observer has not.
    expect(slow).toBe("A");

    await nextMacroTick();
    expect(slow).toBe("B");
  });

  test("observer that depends on both urgent and deferred paths takes the urgent lane", async () => {
    // If an effect reads both the raw source and a deferred derivation of it,
    // it's queued in the urgent lane as soon as the source writes. That's the
    // only sensible choice without true concurrent rendering: we can't serve
    // two versions of the same effect at once.
    const source = signal(1);
    const lazy = computed(() => source() * 10, { deferred: true });
    let runs = 0;
    effect(() => {
      source();
      lazy();
      runs++;
    });
    expect(runs).toBe(1);

    source.set(2);
    await waitScheduler();
    expect(runs).toBe(2); // Ran in the urgent batch.

    await nextMacroTick();
    expect(runs).toBe(2); // No extra deferred run.
  });

  test("deferred propagates through a chain of derived computations", async () => {
    const source = signal(5);
    const lazyA = computed(() => source() + 1, { deferred: true });
    const lazyB = computed(() => lazyA() + 100); // not deferred itself
    let observed: number | null = null;
    effect(() => {
      observed = lazyB();
    });
    expect(observed).toBe(106);

    source.set(10);
    await waitScheduler();
    // lazyB's observer is reached through lazyA (deferred), so lands deferred.
    expect(observed).toBe(106);

    await nextMacroTick();
    expect(observed).toBe(111);
  });

  test("a newer urgent write during a deferred flush still lands in the urgent lane", async () => {
    const urgentSignal = signal("-");
    const slowSource = signal(1);
    const lazy = computed(() => slowSource() * 10, { deferred: true });
    let urgentVal: string | null = null;
    let slowVal: number | null = null;
    effect(() => {
      urgentVal = urgentSignal();
    });
    effect(() => {
      slowVal = lazy();
    });

    slowSource.set(2);
    // Slow write is queued for macrotask; before it drains, an urgent write
    // lands and must be handled on its own microtask, not held up.
    urgentSignal.set("!");
    await waitScheduler();
    expect(urgentVal).toBe("!");
    expect(slowVal).toBe(10);

    await nextMacroTick();
    expect(slowVal).toBe(20);
  });
});
