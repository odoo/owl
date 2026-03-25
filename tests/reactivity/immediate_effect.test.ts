import { immediateEffect, effect, proxy, signal } from "../../src/runtime";
import { expectSpy, nextMicroTick } from "../helpers";

async function waitScheduler() {
  await nextMicroTick();
  return Promise.resolve();
}

describe("immediateEffect", () => {
  test("immediateEffect runs directly", () => {
    const spy = jest.fn();
    immediateEffect(() => {
      spy();
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("immediateEffect reruns immediately when dependency changes", () => {
    const state = proxy({ a: 1 });
    const spy = jest.fn();
    immediateEffect(() => spy(state.a));
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    expectSpy(spy, 2, { args: [2] });
    state.a = 3;
    expectSpy(spy, 3, { args: [3] });
  });

  test("regular effect still runs in microtick", async () => {
    const state = proxy({ a: 1 });
    const spy = jest.fn();
    effect(() => spy(state.a));
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    expectSpy(spy, 1, { args: [1] });
    await waitScheduler();
    expectSpy(spy, 2, { args: [2] });
  });

  test("immediateEffect with signal", () => {
    const s = signal(1);
    const spy = jest.fn();
    immediateEffect(() => spy(s()));
    expectSpy(spy, 1, { args: [1] });
    s.set(2);
    expectSpy(spy, 2, { args: [2] });
    s.set(3);
    expectSpy(spy, 3, { args: [3] });
  });

  test("immediateEffect should unsubscribe previous dependencies", () => {
    const state = proxy({ a: 1, b: 10, c: 100 });
    const spy = jest.fn();
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
    const spy = jest.fn();
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
    const spy = jest.fn();
    const cleanup = jest.fn();
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
    const spy = jest.fn();
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
    const immediateSpy = jest.fn();
    const batchedSpy = jest.fn();

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

  describe("nested immediateEffects", () => {
    test("should track correctly", () => {
      const state = proxy({ a: 1, b: 10 });
      const spy1 = jest.fn();
      const spy2 = jest.fn();
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
  });
});
