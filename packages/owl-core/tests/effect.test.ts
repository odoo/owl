import { describe, expect, test, vi } from "vitest";
import { effect, proxy, signal, untrack } from "../src";
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
  });

  describe("cleanup tracking isolation", () => {
    test("atom reads inside cleanup do not register as effect dependencies on re-run", async () => {
      // When an effect re-runs, its cleanup fires first, then fn(). If the
      // cleanup reads a signal, that read must not be tracked — otherwise the
      // cleanup-only signal would silently become a dependency, causing
      // spurious re-runs.
      const trigger = signal(1);
      const onlyInCleanup = signal(100);
      const spy = vi.fn();

      effect(() => {
        spy(trigger());
        return () => {
          // cleanup reads a signal that fn() does not read
          onlyInCleanup();
        };
      });
      expectSpy(spy, 1, { args: [1] });

      // Change the cleanup-only signal — must NOT trigger a re-run.
      onlyInCleanup.set(200);
      await waitScheduler();
      expectSpy(spy, 1, { args: [1] });

      // Sanity: the effect still responds to its real dependency.
      trigger.set(2);
      await waitScheduler();
      expectSpy(spy, 2, { args: [2] });

      // And still doesn't track onlyInCleanup after the re-run.
      onlyInCleanup.set(300);
      await waitScheduler();
      expectSpy(spy, 2, { args: [2] });
    });

    test("atom reads inside cleanup do not leak to surrounding effect on manual unsubscribe", async () => {
      // If effect A calls inner.unsubscribe() from inside its body, and inner's
      // cleanup reads a signal, that read must not register as a dependency
      // of A — otherwise A re-runs every time that signal changes.
      const trigger = signal(1);
      const readInCleanup = signal(100);
      const spyA = vi.fn();

      let disposeInner: (() => void) | null = null;

      effect(() => {
        spyA(trigger());
        if (!disposeInner) {
          disposeInner = effect(() => {
            return () => {
              readInCleanup();
            };
          });
        }
      });
      expectSpy(spyA, 1, { args: [1] });

      // Unsubscribe the inner from INSIDE a fresh run of the outer.
      trigger.set(2);
      await waitScheduler();
      expectSpy(spyA, 2, { args: [2] });
      disposeInner!(); // inner's cleanup reads readInCleanup

      // Changing readInCleanup must not cause A to re-run.
      readInCleanup.set(200);
      await waitScheduler();
      expectSpy(spyA, 2, { args: [2] });
    });
  });

  describe("dispose-while-scheduled", () => {
    test("disposing a parent prevents a scheduled child from running", async () => {
      // A child effect's source changes — child is queued to re-run in
      // processEffects. Before the queue flushes, the parent is disposed,
      // which cascades into the child. The state=EXECUTED set in
      // unsubscribeEffect must prevent the child from running when
      // processEffects reaches it.
      const src = signal(1);
      const spyChild = vi.fn();
      const cleanupChild = vi.fn();

      const disposeParent = effect(() => {
        effect(() => {
          spyChild(src());
          return cleanupChild;
        });
      });
      expectSpy(spyChild, 1, { args: [1] });

      // Schedule the child to re-run, synchronously (no await).
      src.set(2);
      // Before the microtask flushes processEffects, dispose the parent.
      disposeParent();
      expect(cleanupChild).toHaveBeenCalledTimes(1);

      // Flush. The child was in the queue but was marked EXECUTED during
      // the cascade, so updateComputation is a no-op.
      await waitScheduler();
      expectSpy(spyChild, 1, { args: [1] });
      expect(cleanupChild).toHaveBeenCalledTimes(1);
    });
  });
});
