import { computed, immediateEffect, effect, proxy, signal } from "../src";
import { expectSpy, waitScheduler } from "./helpers";

describe("immediateEffect", () => {
  test("immediateEffect runs directly", () => {
    const spy = vi.fn();
    immediateEffect(() => {
      spy();
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("immediateEffect reruns immediately when dependency changes", () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    immediateEffect(() => spy(state.a));
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    expectSpy(spy, 2, { args: [2] });
    state.a = 3;
    expectSpy(spy, 3, { args: [3] });
  });

  test("regular effect still runs in microtick", async () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    effect(() => spy(state.a));
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    expectSpy(spy, 1, { args: [1] });
    await waitScheduler();
    expectSpy(spy, 2, { args: [2] });
  });

  test("immediateEffect with signal", () => {
    const s = signal(1);
    const spy = vi.fn();
    immediateEffect(() => spy(s()));
    expectSpy(spy, 1, { args: [1] });
    s.set(2);
    expectSpy(spy, 2, { args: [2] });
    s.set(3);
    expectSpy(spy, 3, { args: [3] });
  });

  test("immediateEffect keeps synchronous timing through a computed", () => {
    const s = signal(1);
    const double = computed(() => s() * 2);
    const spy = vi.fn();
    immediateEffect(() => spy(double()));
    expectSpy(spy, 1, { args: [2] });
    s.set(2);
    expectSpy(spy, 2, { args: [4] });
    s.set(3);
    expectSpy(spy, 3, { args: [6] });
  });

  test("computed dependency does not degrade a direct dependency to batched", () => {
    const a = signal(1);
    const b = signal(10);
    const isPositive = computed(() => a() > 0);
    const spy = vi.fn();
    immediateEffect(() => spy(isPositive(), b()));
    expectSpy(spy, 1, { args: [true, 10] });
    // Write reaching the effect through the computed: must not leave the
    // effect parked in the batched queue...
    a.set(-1);
    expectSpy(spy, 2, { args: [false, 10] });
    // ...nor with a non-EXECUTED state that would make onWriteAtom skip
    // scheduling this later direct write in the same task.
    b.set(20);
    expectSpy(spy, 3, { args: [false, 20] });
  });

  test("immediateEffect does not rerun when a computed dependency recomputes to an equal value", () => {
    const a = signal(1);
    const isPositive = computed(() => a() > 0);
    const spy = vi.fn();
    immediateEffect(() => spy(isPositive()));
    expectSpy(spy, 1, { args: [true] });
    a.set(2);
    expectSpy(spy, 1, { args: [true] });
    a.set(-1);
    expectSpy(spy, 2, { args: [false] });
  });

  test("immediateEffect should unsubscribe previous dependencies", () => {
    const state = proxy({ a: 1, b: 10, c: 100 });
    const spy = vi.fn();
    immediateEffect(() => {
      if (state.a === 1) {
        spy(state.b);
      } else {
        spy(state.c);
      }
    });
    expectSpy(spy, 1, { args: [10] });
    state.b = 20;
    expectSpy(spy, 2, { args: [20] });
    state.a = 2;
    expectSpy(spy, 3, { args: [100] });
    state.b = 30;
    expectSpy(spy, 3, { args: [100] });
    state.c = 200;
    expectSpy(spy, 4, { args: [200] });
  });

  test("immediateEffect should not run if dependencies do not change", () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    immediateEffect(() => {
      spy(state.a);
    });
    expectSpy(spy, 1, { args: [1] });
    state.a = 1;
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    expectSpy(spy, 2, { args: [2] });
  });

  test("immediateEffect should call cleanup function", () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    const cleanup = vi.fn();
    immediateEffect(() => {
      spy(state.a);
      return cleanup;
    });
    expectSpy(spy, 1, { args: [1] });
    expect(cleanup).toHaveBeenCalledTimes(0);
    state.a = 2;
    expectSpy(spy, 2, { args: [2] });
    expect(cleanup).toHaveBeenCalledTimes(1);
    state.a = 3;
    expectSpy(spy, 3, { args: [3] });
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test("immediateEffect should be able to unsubscribe", () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    const unsubscribe = immediateEffect(() => {
      spy(state.a);
    });
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    expectSpy(spy, 2, { args: [2] });
    unsubscribe();
    state.a = 3;
    expectSpy(spy, 2, { args: [2] });
  });

  test("immediateEffect and effect can coexist", async () => {
    const state = proxy({ a: 1 });
    const immediateSpy = vi.fn();
    const batchedSpy = vi.fn();

    immediateEffect(() => immediateSpy(state.a));
    effect(() => batchedSpy(state.a));

    expectSpy(immediateSpy, 1, { args: [1] });
    expectSpy(batchedSpy, 1, { args: [1] });

    state.a = 2;

    expectSpy(immediateSpy, 2, { args: [2] });
    expectSpy(batchedSpy, 1, { args: [1] });

    await waitScheduler();

    expectSpy(batchedSpy, 2, { args: [2] });
  });

  test("a write inside an immediateEffect runs the dependent immediateEffect synchronously", () => {
    const a = signal(1);
    const b = signal(0);
    const spyB = vi.fn();
    immediateEffect(() => spyB(b()));
    immediateEffect(() => b.set(a() * 10));
    expectSpy(spyB, 2, { args: [10] });
    a.set(2);
    expectSpy(spyB, 3, { args: [20] });
  });

  test("an immediateEffect invalidated twice in one flush runs once", () => {
    const s = signal(1);
    const t = signal(0);
    const spy = vi.fn();
    // Both effects are queued by the write to `s`. The first one writes `t`,
    // which the second one also reads: the second one must not run twice.
    immediateEffect(() => {
      s();
      t.set(t() + 1);
    });
    immediateEffect(() => spy(s(), t()));
    expectSpy(spy, 1, { args: [1, 1] });
    s.set(2);
    expectSpy(spy, 2, { args: [2, 2] });
  });

  test("an immediateEffect disposed by an earlier one in the same flush does not run", () => {
    const s = signal(1);
    const spy = vi.fn();
    let dispose: () => void;
    immediateEffect(() => {
      if (s() === 2) {
        dispose();
      }
    });
    dispose = immediateEffect(() => spy(s()));
    expectSpy(spy, 1, { args: [1] });
    s.set(2);
    expectSpy(spy, 1, { args: [1] });
    s.set(3);
    expectSpy(spy, 1, { args: [1] });
  });

  test("an error thrown by an immediateEffect surfaces from the write", () => {
    const s = signal(1);
    immediateEffect(() => {
      if (s() === 2) {
        throw new Error("boom");
      }
    });
    expect(() => s.set(2)).toThrow("boom");
  });

  test("push reruns an immediateEffect reading length once", () => {
    const state = proxy([1, 2]);
    const spy = vi.fn();
    immediateEffect(() => spy(state.length));
    expectSpy(spy, 1, { args: [2] });
    state.push(3);
    expectSpy(spy, 2, { args: [3] });
  });

  test("push notifies length before an immediateEffect throws on the new index", () => {
    const state = proxy([1, 2]);
    const spy = vi.fn();
    immediateEffect(() => spy(state.length));
    immediateEffect(() => {
      if (state[2] === 3) {
        throw new Error("boom");
      }
    });
    expect(() => state.push(3)).toThrow("boom");
    expectSpy(spy, 2, { args: [3] });
  });

  describe("nested immediateEffects", () => {
    test("should track correctly", () => {
      const state = proxy({ a: 1, b: 10 });
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      immediateEffect(() => {
        spy1(state.a);
        if (state.a === 1) {
          immediateEffect(() => {
            spy2(state.b);
          });
        }
      });
      expectSpy(spy1, 1, { args: [1] });
      expectSpy(spy2, 1, { args: [10] });
      state.b = 20;
      expectSpy(spy1, 1, { args: [1] });
      expectSpy(spy2, 2, { args: [20] });
      state.a = 2;
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
      state.b = 30;
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
    });

    test("an immediateEffect nested in an effect is disposed when the parent re-runs", async () => {
      const a = signal(1);
      const b = signal(10);
      const spy = vi.fn();
      effect(() => {
        a();
        immediateEffect(() => spy(b()));
      });
      expectSpy(spy, 1, { args: [10] });
      b.set(20);
      expectSpy(spy, 2, { args: [20] });
      a.set(2);
      await waitScheduler();
      // the parent re-ran and created a fresh child
      expectSpy(spy, 3, { args: [20] });
      b.set(30);
      // only the fresh child reacts
      expectSpy(spy, 4, { args: [30] });
    });
  });
});
