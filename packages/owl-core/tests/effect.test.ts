import {
  computed,
  ComputationState,
  createComputation,
  effect,
  proxy,
  signal,
  untrack,
  updateComputation,
} from "../src";
import { expectSpy, nextMicroTick } from "./helpers";

async function waitScheduler() {
  await nextMicroTick();
  return Promise.resolve();
}

describe("effect", () => {
  test("effect runs directly", () => {
    const spy = vi.fn();
    effect(() => {
      spy();
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("effect tracks proxy properties", async () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    effect(() => spy(state.a));
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    await waitScheduler();
    expectSpy(spy, 2, { args: [2] });
  });

  test("effect should unsubscribe previous dependencies", async () => {
    const state = proxy({ a: 1, b: 10, c: 100 });
    const spy = vi.fn();
    effect(() => {
      if (state.a === 1) {
        spy(state.b);
      } else {
        spy(state.c);
      }
    });
    expectSpy(spy, 1, { args: [10] });
    state.b = 20;
    await waitScheduler();
    expectSpy(spy, 2, { args: [20] });
    state.a = 2;
    await waitScheduler();
    expectSpy(spy, 3, { args: [100] });
    state.b = 30;
    await waitScheduler();
    expectSpy(spy, 3, { args: [100] });
    state.c = 200;
    await waitScheduler();
    expectSpy(spy, 4, { args: [200] });
  });

  test("effect should not run if dependencies do not change", async () => {
    const state = proxy({ a: 1 });
    const spy = vi.fn();
    effect(() => {
      spy(state.a);
    });
    expectSpy(spy, 1, { args: [1] });
    state.a = 1;
    await waitScheduler();
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    await waitScheduler();
    expectSpy(spy, 2, { args: [2] });
  });

  test("an effect that throws during flush is not re-run on a follow-up microtask", async () => {
    // The effect's body has no guard, so its only source is `uppercase`.
    // When list goes to [], the eager source walk in updateComputation
    // recomputes `uppercase` (its single source changed), which throws
    // before the effect body runs — so `runs` stays at 1.
    //
    // The throw propagates through batched()'s .then() chain as an unhandled
    // rejection. We use a named error class so vitest.config.ts'
    // `onUnhandledError` callback can filter just this error rather than
    // silencing every unhandled error in the suite.
    class IntentionalTestError extends Error {
      override name = "IntentionalTestError";
    }
    const list = signal(["a"]);
    const lastValue = computed(() => list().at(-1));
    const uppercase = computed(() => {
      const v = lastValue();
      if (v === undefined) throw new IntentionalTestError("undefined value");
      return v.toUpperCase();
    });

    let runs = 0;
    effect(() => {
      runs++;
      uppercase();
    });
    expect(runs).toBe(1);

    list.set([]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    // The eager source walk throws inside uppercase.compute(); the effect
    // body never runs, so the counter stays at the initial 1. The earlier
    // bug (queue not cleared on throw) would have produced 3.
    expect(runs).toBe(1);
  });

  test("eager source walk short-circuits once we know we have to re-run", async () => {
    // The effect has both lastValue (a guard) and uppercase (only read when
    // the guard passes) as sources. When list goes to [], lastValue is
    // recomputed first and propagates STALE to the effect; the walk stops
    // there instead of forcing uppercase — which would crash on undefined.
    // The body then re-runs, sees the guard is false, and never touches
    // uppercase.
    const list = signal(["a"]);
    let lastValueRuns = 0;
    let uppercaseRuns = 0;
    const lastValue = computed(() => {
      lastValueRuns++;
      return list().at(-1);
    });
    const uppercase = computed(() => {
      uppercaseRuns++;
      return lastValue()!.toUpperCase();
    });

    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      if (lastValue()) {
        uppercase();
      }
    });
    expect(effectRuns).toBe(1);
    expect(lastValueRuns).toBe(1);
    expect(uppercaseRuns).toBe(1);

    list.set([]);
    await waitScheduler();
    expect(effectRuns).toBe(2);
    expect(lastValueRuns).toBe(2);
    // uppercase was NOT eagerly probed; the walk short-circuited after
    // lastValue's change marked the effect STALE.
    expect(uppercaseRuns).toBe(1);
  });

  test("effects, signals, stuff", async () => {
    const s1 = signal(1);
    const s2 = signal(0);
    let result = 0;
    effect(() => {
      result = s2();
    });
    effect(() => {
      s2.set(s1());
    });
    expect(s2()).toBe(1);
    expect(result).toBe(0);
    await waitScheduler();
    expect(result).toBe(1);
    s1.set(2);
    await waitScheduler();
    expect(s2()).toBe(2);
    await waitScheduler();
    expect(result).toBe(2);
  });

  describe("nested effects", () => {
    test("should track correctly", async () => {
      const state = proxy({ a: 1, b: 10 });
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      effect(() => {
        spy1(state.a);
        if (state.a === 1) {
          effect(() => {
            spy2(state.b);
          });
        }
      });
      expectSpy(spy1, 1, { args: [1] });
      expectSpy(spy2, 1, { args: [10] });
      state.b = 20;
      await waitScheduler();
      expectSpy(spy1, 1, { args: [1] });
      expectSpy(spy2, 2, { args: [20] });
      state.a = 2;
      await waitScheduler();
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
      state.b = 30;
      await waitScheduler();
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
    });
  });

  describe("unsubscribe", () => {
    test("B re-running unsubscribes nested A, which prevents C from re-running", async () => {
      // Three effects shaped like a component render pipeline:
      //   A (compute) — nested inside B (sort) — nested inside C (template render)
      //   When B re-runs, unsubscribeEffect(B) iterates B.observers and removes A's
      //   sources. If A is not recreated by B's second run (e.g. guarded creation),
      //   A is silently dead — later source changes no longer propagate to C.
      const source = signal(1); // raw data A reads
      const sortKey = signal("asc"); // what B reads
      const result = signal(0); // A writes, C reads (simulates the chain)

      const spyA = vi.fn();
      const spyC = vi.fn();

      // C: template render effect
      effect(() => {
        spyC(result());
      });

      // B: sort effect, creates A only on its first run
      let aCreated = false;
      effect(() => {
        sortKey();
        if (!aCreated) {
          aCreated = true;
          // A: compute effect, nested child of B
          effect(() => {
            const v = source();
            spyA(v);
            result.set(v * 10);
          });
        }
      });

      await waitScheduler();
      expectSpy(spyA, 1, { args: [1] });
      expectSpy(spyC, 2, { args: [10] });

      // Source changes: A re-runs, propagates to C
      source.set(2);
      await waitScheduler();
      expectSpy(spyA, 2, { args: [2] });
      expectSpy(spyC, 3, { args: [20] });

      // Sort key changes: B re-runs. unsubscribeEffect(B) silently kills A.
      sortKey.set("desc");
      await waitScheduler();
      // A is not recreated (the guard blocks it).

      // Source changes again — but A is no longer subscribed to `source`.
      source.set(3);
      await waitScheduler();
      // A did not re-run, so `result` stays stale and C never re-renders.
      expectSpy(spyA, 2, { args: [2] });
      expectSpy(spyC, 3, { args: [20] });
    });

    test("wrapping A creation in untrack escapes B's ownership", async () => {
      // Same shape as the previous test, but A is created inside untrack(...)
      // so currentComputation is undefined when A attaches — A is NOT added to
      // B.observers, so B re-running does not dispose A.
      const source = signal(1);
      const sortKey = signal("asc");
      const result = signal(0);

      const spyA = vi.fn();
      const spyC = vi.fn();

      effect(() => {
        spyC(result());
      });

      let aCreated = false;
      effect(() => {
        sortKey();
        if (!aCreated) {
          aCreated = true;
          untrack(() => {
            effect(() => {
              const v = source();
              spyA(v);
              result.set(v * 10);
            });
          });
        }
      });

      await waitScheduler();
      expectSpy(spyA, 1, { args: [1] });
      expectSpy(spyC, 2, { args: [10] });

      source.set(2);
      await waitScheduler();
      expectSpy(spyA, 2, { args: [2] });
      expectSpy(spyC, 3, { args: [20] });

      // B re-runs — but A is not its child anymore, so A survives.
      sortKey.set("desc");
      await waitScheduler();

      source.set(3);
      await waitScheduler();
      // A is still alive and subscribed to `source`.
      expectSpy(spyA, 3, { args: [3] });
      expectSpy(spyC, 4, { args: [30] });
    });

    test("disposing a parent effect removes child effect's sources", async () => {
      // If effect A is created inside effect B, A is a child of B (A is in B.observers).
      // Disposing B then calls unsubscribeEffect(B), which iterates B.observers and
      // calls removeSources(A). So A is silently unsubscribed from all its atoms.
      const a = signal(1);
      const b = signal(10);
      const spyA = vi.fn();
      const cleanupA = vi.fn();

      const disposeB = effect(() => {
        // B depends on signal a
        a();
        // A is created as a child of B and tracks signal b independently
        effect(() => {
          spyA(b());
          return cleanupA;
        });
      });
      expectSpy(spyA, 1, { args: [10] });
      expect(cleanupA).toHaveBeenCalledTimes(0);

      // Dispose B. Since A is a child of B (A ∈ B.observers),
      // unsubscribeEffect(B) cascades: removeSources(A) is called and A's cleanup runs.
      disposeB();
      expect(cleanupA).toHaveBeenCalledTimes(1);

      // A has been silently unsubscribed from signal b.
      b.set(20);
      await waitScheduler();
      expectSpy(spyA, 1, { args: [10] });
    });

    test("should be able to unsubscribe", async () => {
      const state = proxy({ a: 1 });
      const spy = vi.fn();
      const unsubscribe = effect(() => {
        spy(state.a);
      });
      expectSpy(spy, 1, { args: [1] });
      state.a = 2;
      await waitScheduler();
      expectSpy(spy, 2, { args: [2] });
      unsubscribe();
      state.a = 3;
      await waitScheduler();
      expectSpy(spy, 2, { args: [2] });
    });

    test("disposing an effect after a queued signal write skips the re-run", async () => {
      const s = signal(1);
      const spy = vi.fn();
      const dispose = effect(() => {
        spy(s());
      });
      expectSpy(spy, 1, { args: [1] });
      s.set(2);
      dispose();
      await waitScheduler();
      expectSpy(spy, 1, { args: [1] });
    });

    test("disposing an effect skips queued re-run from a derived dependency", async () => {
      const s = signal(1);
      const c = computed(() => s() * 2);
      const spy = vi.fn();
      const dispose = effect(() => {
        spy(c());
      });
      expectSpy(spy, 1, { args: [2] });
      s.set(2);
      dispose();
      await waitScheduler();
      expectSpy(spy, 1, { args: [2] });
    });

    test("effect should call cleanup function", async () => {
      const state = proxy({ a: 1 });
      const spy = vi.fn();
      const cleanup = vi.fn();
      effect(() => {
        spy(state.a);
        return cleanup;
      });
      expectSpy(spy, 1, { args: [1] });
      expect(cleanup).toHaveBeenCalledTimes(0);
      state.a = 2;
      await waitScheduler();
      expectSpy(spy, 2, { args: [2] });
      expect(cleanup).toHaveBeenCalledTimes(1);
      state.a = 3;
      await waitScheduler();
      expectSpy(spy, 3, { args: [3] });
      expect(cleanup).toHaveBeenCalledTimes(2);
    });
    test("should call cleanup when unsubscribing nested effects", async () => {
      const state = proxy({ a: 1, b: 10, c: 100 });
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const spy3 = vi.fn();
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      const cleanup3 = vi.fn();
      const unsubscribe = effect(() => {
        spy1(state.a);
        if (state.a === 1) {
          effect(() => {
            spy2(state.b);
            return cleanup2;
          });
        }
        effect(() => {
          spy3(state.c);
          return cleanup3;
        });
        return cleanup1;
      });
      expectSpy(spy1, 1, { args: [1] });
      expectSpy(spy2, 1, { args: [10] });
      expectSpy(spy3, 1, { args: [100] });
      expect(cleanup1).toHaveBeenCalledTimes(0);
      expect(cleanup2).toHaveBeenCalledTimes(0);
      expect(cleanup3).toHaveBeenCalledTimes(0);
      state.b = 20;
      await waitScheduler();
      expectSpy(spy1, 1, { args: [1] });
      expectSpy(spy2, 2, { args: [20] });
      expectSpy(spy3, 1, { args: [100] });
      expect(cleanup1).toHaveBeenCalledTimes(0);
      expect(cleanup2).toHaveBeenCalledTimes(1);
      expect(cleanup3).toHaveBeenCalledTimes(0);
      (global as any).d = true;
      state.a = 2;
      await waitScheduler();
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
      expectSpy(spy3, 2, { args: [100] });
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(2);
      expect(cleanup3).toHaveBeenCalledTimes(1);
      state.b = 30;
      await waitScheduler();
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
      expectSpy(spy3, 2, { args: [100] });
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(2);
      expect(cleanup3).toHaveBeenCalledTimes(1);
      unsubscribe();
      expect(cleanup1).toHaveBeenCalledTimes(2);
      expect(cleanup2).toHaveBeenCalledTimes(2);
      expect(cleanup3).toHaveBeenCalledTimes(2);
      state.a = 4;
      state.b = 40;
      state.c = 400;
      await waitScheduler();
      expectSpy(spy1, 2, { args: [2] });
      expectSpy(spy2, 2, { args: [20] });
      expectSpy(spy3, 2, { args: [100] });
      expect(cleanup1).toHaveBeenCalledTimes(2);
      expect(cleanup2).toHaveBeenCalledTimes(2);
      expect(cleanup3).toHaveBeenCalledTimes(2);
    });

    test("dispose called inside another effect: cleanup's atom reads do not leak to outer", async () => {
      // The dispose function returned by effect() clears currentComputation
      // around unsubscribeEffect. If a user cleanup function reads a signal
      // while dispose is invoked from inside another effect, that read must
      // NOT attach as a source of the surrounding effect — otherwise the
      // outer effect would re-run whenever the disposed effect's cleanup
      // happened to touch unrelated state.
      const cleanupSignal = signal(0);
      let cleanupRuns = 0;

      // Inner effect with a cleanup function that reads cleanupSignal.
      const dispose = effect(() => {
        return () => {
          cleanupSignal();
          cleanupRuns++;
        };
      });
      expect(cleanupRuns).toBe(0);

      // Outer effect disposes the inner once on its first run.
      let outerRuns = 0;
      let outerDisposed = false;
      effect(() => {
        outerRuns++;
        if (!outerDisposed) {
          outerDisposed = true;
          dispose();
        }
      });
      expect(outerRuns).toBe(1);
      expect(cleanupRuns).toBe(1);

      // If the cleanup's read had leaked, this signal change would re-run
      // the outer effect. With the save/restore in place, it must not.
      cleanupSignal.set(1);
      await waitScheduler();
      expect(outerRuns).toBe(1);
    });
  });

  describe("positional source reuse", () => {
    test("re-running with unchanged read order reuses the source links", () => {
      const a = signal(1);
      const b = signal(2);
      const comp = createComputation(() => a() + b(), false);
      updateComputation(comp);
      const sources = comp.sources;
      const sourcesList = comp.sourcesList;
      expect(sourcesList.length).toBe(2);

      comp.state = ComputationState.STALE;
      updateComputation(comp);
      // same reads in the same order: the links were not torn down/rebuilt
      expect(comp.sources).toBe(sources);
      expect(comp.sourcesList).toBe(sourcesList);
      expect(comp.value).toBe(3);
    });

    test("reading a strict prefix of the previous run drops the tail", async () => {
      const stop = signal(false);
      const a = signal(1);
      const spy = vi.fn(() => (stop() ? -1 : a()));
      effect(spy);
      expectSpy(spy, 1, { result: 1 });

      stop.set(true);
      await waitScheduler();
      expectSpy(spy, 2, { result: -1 });

      // a was read after stop in the previous run and is no longer read:
      // writing it must not re-run the effect
      a.set(42);
      await waitScheduler();
      expectSpy(spy, 2);

      stop.set(false);
      await waitScheduler();
      expectSpy(spy, 3, { result: 42 });
    });

    test("repeated reads of the same atom are matched positionally", async () => {
      const a = signal(1);
      const spy = vi.fn(() => a() + a() + a());
      effect(spy);
      expectSpy(spy, 1, { result: 3 });

      a.set(2);
      await waitScheduler();
      expectSpy(spy, 2, { result: 6 });

      a.set(3);
      await waitScheduler();
      expectSpy(spy, 3, { result: 9 });
    });
  });
});
