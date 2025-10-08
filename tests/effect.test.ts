import { reactive } from "../src/runtime/reactivity";
import { effect } from "../src/runtime/signals";
import { expectSpy, nextMicroTick } from "./helpers";

async function waitScheduler() {
  await nextMicroTick();
  return Promise.resolve();
}

describe("effect", () => {
  it("effect runs directly", () => {
    const spy = jest.fn();
    effect(() => {
      spy();
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("effect tracks reactive properties", async () => {
    const state = reactive({ a: 1 });
    const spy = jest.fn();
    effect(() => spy(state.a));
    expectSpy(spy, 1, { args: [1] });
    state.a = 2;
    await waitScheduler();
    expectSpy(spy, 2, { args: [2] });
  });
  it("effect should unsubscribe previous dependencies", async () => {
    const state = reactive({ a: 1, b: 10, c: 100 });
    const spy = jest.fn();
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
  it("effect should not run if dependencies do not change", async () => {
    const state = reactive({ a: 1 });
    const spy = jest.fn();
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
  describe("nested effects", () => {
    it("should track correctly", async () => {
      const state = reactive({ a: 1, b: 10 });
      const spy1 = jest.fn();
      const spy2 = jest.fn();
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
    it("should be able to unsubscribe", async () => {
      const state = reactive({ a: 1 });
      const spy = jest.fn();
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
    it("effect should call cleanup function", async () => {
      const state = reactive({ a: 1 });
      const spy = jest.fn();
      const cleanup = jest.fn();
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
    it("should call cleanup when unsubscribing nested effects", async () => {
      const state = reactive({ a: 1, b: 10, c: 100 });
      const spy1 = jest.fn();
      const spy2 = jest.fn();
      const spy3 = jest.fn();
      const cleanup1 = jest.fn();
      const cleanup2 = jest.fn();
      const cleanup3 = jest.fn();
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
});
