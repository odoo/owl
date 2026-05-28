import { bench, describe } from "vitest";
import { computed, effect, signal } from "../src";

// Reactivity microbenchmark suite. Run with `npm run bench`.
//
// Each `bench` measures one focused operation. Setup (signal/effect creation)
// happens outside the timed body where possible. For effect re-run paths the
// timed body has to include the awaited microtask flush, since the work we
// care about happens in the queueMicrotask callback.

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("signal read inside an effect", () => {
  const s = signal(0);
  // Keep an active effect so reads from `s` propagate through the tracking
  // path; without it `onReadAtom` short-circuits on the early return.
  effect(() => {
    s();
  });
  bench("signal()", () => {
    s();
  });
});

describe("signal write — observer fan-out", () => {
  function setup(observerCount: number) {
    const s = signal(0);
    for (let i = 0; i < observerCount; i++) {
      effect(() => {
        s();
      });
    }
    return s;
  }

  const s1 = setup(1);
  bench("set, 1 observer", async () => {
    s1.set(s1() + 1);
    await flushMicrotasks();
  });

  const s10 = setup(10);
  bench("set, 10 observers", async () => {
    s10.set(s10() + 1);
    await flushMicrotasks();
  });

  const s100 = setup(100);
  bench("set, 100 observers", async () => {
    s100.set(s100() + 1);
    await flushMicrotasks();
  });
});

describe("computed propagation chain", () => {
  function makeChain(depth: number) {
    const s = signal(0);
    let head: () => number = s;
    for (let i = 0; i < depth; i++) {
      const prev = head;
      head = computed(() => prev() + 1);
    }
    effect(() => {
      head();
    });
    return s;
  }

  const d1 = makeChain(1);
  bench("depth 1", async () => {
    d1.set(d1() + 1);
    await flushMicrotasks();
  });

  const d5 = makeChain(5);
  bench("depth 5", async () => {
    d5.set(d5() + 1);
    await flushMicrotasks();
  });

  const d20 = makeChain(20);
  bench("depth 20", async () => {
    d20.set(d20() + 1);
    await flushMicrotasks();
  });
});

describe("effect lifecycle", () => {
  const s = signal(0);
  bench("create + dispose (no cleanup, no children)", () => {
    const dispose = effect(() => {
      s();
    });
    dispose();
  });

  bench("create + dispose (with cleanup)", () => {
    const dispose = effect(() => {
      s();
      return () => {};
    });
    dispose();
  });

  bench("create + dispose (with nested child effect)", () => {
    const dispose = effect(() => {
      s();
      effect(() => {
        s();
      });
    });
    dispose();
  });
});

describe("effect re-run via signal write", () => {
  const s = signal(0);
  effect(() => {
    s();
  });
  bench("single effect, single signal", async () => {
    s.set(s() + 1);
    await flushMicrotasks();
  });

  const sCleanup = signal(0);
  effect(() => {
    sCleanup();
    return () => {};
  });
  bench("single effect with cleanup, single signal", async () => {
    sCleanup.set(sCleanup() + 1);
    await flushMicrotasks();
  });
});
