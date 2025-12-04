import { signal } from "../src/runtime/signals";
import { expectSpy, spyEffect, waitScheduler } from "./helpers";

describe("signals", () => {
  test("signal can be created and read", () => {
    const s = signal(1);
    expect(s()).toBe(1);
  });

  test("signal can be updated ", () => {
    const s = signal(1);
    expect(s()).toBe(1);
    s.set(4);
    expect(s()).toBe(4);
  });

  test("updating a signal trigger an effect", async () => {
    const s = signal(1);
    const e = spyEffect(() => s());
    e();
    expectSpy(e.spy, 1);
    s.set(22);
    expectSpy(e.spy, 1, { result: 1 });
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 22 });
  });

  test("signal can be updated with update function", () => {
    const s = signal(1);
    expect(s()).toBe(1);
    s.update((value) => value + 1);
    expect(s()).toBe(2);
  });

  test("updating a signal with same value trigger effects or not", async () => {
    const s = signal(1);
    const e = spyEffect(() => s());
    e();
    expectSpy(e.spy, 1);
    s.set(1);
    expectSpy(e.spy, 1, { result: 1 });
    await waitScheduler();
    expectSpy(e.spy, 1, { result: 1 });
    s.update();
    expectSpy(e.spy, 1, { result: 1 });
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });
  });
});
