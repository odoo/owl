import { asyncComputed, effect, proxy, signal } from "../../src";
import { makeDeferred, nextMicroTick } from "../helpers";

async function waitScheduler() {
  await nextMicroTick();
  return Promise.resolve();
}

describe("asyncComputed", () => {
  test("returns a promise that resolves to the computed value", async () => {
    const d = asyncComputed(async () => 42);
    const result = await d();
    expect(result).toBe(42);
  });

  test("tracks signal dependencies", async () => {
    const s = signal(1);
    const d = asyncComputed(async () => s() * 10);
    expect(await d()).toBe(10);
  });

  test("tracks proxy dependencies", async () => {
    const state = proxy({ a: 5 });
    const d = asyncComputed(async () => state.a + 1);
    expect(await d()).toBe(6);
  });

  test("recomputes when dependency changes", async () => {
    const s = signal(1);
    const d = asyncComputed(async () => s() * 10);
    expect(await d()).toBe(10);
    s.set(2);
    expect(await d()).toBe(20);
  });

  test("stale promise stays pending when dependency changes before resolve", async () => {
    const s = signal("a");
    const def = makeDeferred();
    let callCount = 0;

    const d = asyncComputed(async () => {
      const val = s();
      callCount++;
      if (callCount === 1) {
        await def;
      }
      return val;
    });

    // First read: starts async computation, promise pending
    const firstPromise = d();
    expect(callCount).toBe(1);

    // Change dependency before first computation resolves
    s.set("b");

    // Resolve the first (now stale) async operation
    def.resolve();
    await waitScheduler();

    // The first promise should stay pending (stale)
    let firstResolved = false;
    firstPromise.then(() => {
      firstResolved = true;
    });
    await waitScheduler();
    expect(firstResolved).toBe(false);

    // Second read gives a new promise that resolves correctly
    expect(await d()).toBe("b");
  });

  test("only latest computation resolves after rapid changes", async () => {
    const s = signal(1);
    const defs = [makeDeferred(), makeDeferred(), makeDeferred()];
    let callCount = 0;

    const d = asyncComputed(async () => {
      const val = s();
      const def = defs[callCount++];
      await def;
      return val;
    });

    // First read
    const p1 = d();

    // Rapid changes
    s.set(2);
    const p2 = d();

    s.set(3);
    const p3 = d();

    // Resolve in order
    defs[0].resolve();
    defs[1].resolve();
    defs[2].resolve();
    await waitScheduler();

    // Only the latest promise should resolve
    let p1resolved = false;
    let p2resolved = false;
    p1.then(() => {
      p1resolved = true;
    });
    p2.then(() => {
      p2resolved = true;
    });
    await waitScheduler();
    expect(p1resolved).toBe(false);
    expect(p2resolved).toBe(false);
    expect(await p3).toBe(3);
  });

  test("stale promise stays pending even when resolved out of order", async () => {
    const s = signal("first");
    const def1 = makeDeferred();
    const def2 = makeDeferred();
    let callCount = 0;

    const d = asyncComputed(async () => {
      const val = s();
      callCount++;
      if (callCount === 1) {
        await def1;
      } else {
        await def2;
      }
      return val;
    });

    const p1 = d();

    s.set("second");
    const p2 = d();

    // Resolve second (newer) computation first
    def2.resolve();
    expect(await p2).toBe("second");

    // Now resolve first (stale) computation
    def1.resolve();
    await waitScheduler();

    let p1resolved = false;
    p1.then(() => {
      p1resolved = true;
    });
    await waitScheduler();
    expect(p1resolved).toBe(false);
  });

  test("rejected promise propagates when computation is current", async () => {
    const d = asyncComputed(async () => {
      throw new Error("fail");
    });

    await expect(d()).rejects.toThrow("fail");
  });

  test("stale rejection is suppressed", async () => {
    const s = signal(1);
    const def = makeDeferred();
    let callCount = 0;

    const d = asyncComputed(async () => {
      const val = s();
      callCount++;
      if (callCount === 1) {
        await def;
      }
      return val;
    });

    const p1 = d();

    // Change dependency
    s.set(2);

    // Reject the stale computation
    def.reject(new Error("stale error"));
    await waitScheduler();

    // Stale rejection doesn't surface
    let p1rejected = false;
    p1.catch(() => {
      p1rejected = true;
    });
    await waitScheduler();
    expect(p1rejected).toBe(false);

    // New computation resolves fine
    expect(await d()).toBe(2);
  });

  test("works with effect", async () => {
    const s = signal(1);
    const results: number[] = [];

    const d = asyncComputed(async () => s() * 10);

    effect(async () => {
      results.push(await d());
    });

    await waitScheduler();
    expect(results).toEqual([10]);

    s.set(2);
    await waitScheduler();
    await waitScheduler();
    expect(results).toEqual([10, 20]);
  });

});
