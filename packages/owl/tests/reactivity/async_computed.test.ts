import { App, Component, asyncComputed, computed, effect, signal, xml } from "../../src";
import { makeDeferred, makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

async function flush() {
  // Async computeds rely on Promise resolutions plus the scheduler tick used
  // by signal writes; a handful of microticks settles both.
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
  }
}

test("returns initial value before resolution", () => {
  const a = asyncComputed(() => makeDeferred() as Promise<number>, { initial: 7 });
  expect(a()).toBe(7);
  expect(a.loading()).toBe(true);
  expect(a.error()).toBeNull();
  a.dispose();
});

test("resolves and updates value", async () => {
  const def = makeDeferred<number>();
  const a = asyncComputed(() => def);
  expect(a.loading()).toBe(true);
  expect(a()).toBeUndefined();

  def.resolve(42);
  await flush();

  expect(a()).toBe(42);
  expect(a.loading()).toBe(false);
  expect(a.error()).toBeNull();
  a.dispose();
});

test("re-runs when a tracked dependency changes", async () => {
  const id = signal(1);
  const calls: number[] = [];

  const a = asyncComputed(async ({ abortSignal: _ }) => {
    const myId = id();
    calls.push(myId);
    return myId * 10;
  });

  await flush();
  expect(a()).toBe(10);
  expect(calls).toEqual([1]);

  id.set(2);
  await flush();
  expect(a()).toBe(20);
  expect(calls).toEqual([1, 2]);

  a.dispose();
});

test("aborts previous run's signal when deps change", async () => {
  const id = signal(1);
  const seen: { id: number; aborted: boolean }[] = [];
  const def1 = makeDeferred<number>();
  const def2 = makeDeferred<number>();
  const defs = [def1, def2];

  const a = asyncComputed(async ({ abortSignal }) => {
    const myId = id();
    const def = defs[myId - 1];
    abortSignal.addEventListener("abort", () => seen.push({ id: myId, aborted: true }));
    return def;
  });

  await Promise.resolve();
  id.set(2);
  await flush();

  expect(seen).toEqual([{ id: 1, aborted: true }]);

  def2.resolve(99);
  await flush();
  expect(a()).toBe(99);

  a.dispose();
});

test("ignores stale resolution from a superseded run", async () => {
  const id = signal(1);
  const def1 = makeDeferred<number>();
  const def2 = makeDeferred<number>();
  const defs = [def1, def2];

  const a = asyncComputed(async () => {
    const myId = id();
    return defs[myId - 1];
  });

  await Promise.resolve();
  id.set(2);
  await Promise.resolve();

  // Stale run resolves last — must be ignored.
  def2.resolve(200);
  await flush();
  expect(a()).toBe(200);

  def1.resolve(100);
  await flush();
  expect(a()).toBe(200);

  a.dispose();
});

test("loading toggles correctly across the lifecycle", async () => {
  const id = signal(1);
  const def1 = makeDeferred<number>();
  const def2 = makeDeferred<number>();
  const defs = [def1, def2];

  const a = asyncComputed(async () => defs[id() - 1]);
  expect(a.loading()).toBe(true);

  def1.resolve(1);
  await flush();
  expect(a.loading()).toBe(false);

  id.set(2);
  await flush();
  expect(a.loading()).toBe(true);

  def2.resolve(2);
  await flush();
  expect(a.loading()).toBe(false);

  a.dispose();
});

test("populates error on rejection and clears on next success", async () => {
  const id = signal(1);
  const def1 = makeDeferred<number>();
  const def2 = makeDeferred<number>();
  const defs = [def1, def2];

  const a = asyncComputed(async () => defs[id() - 1]);
  (def1.reject as (e: unknown) => void)(new Error("boom"));
  await flush();

  expect(a.error()).toMatchObject({ message: "boom" });
  expect(a.loading()).toBe(false);

  id.set(2);
  await flush();
  expect(a.error()).toBeNull();

  def2.resolve(7);
  await flush();
  expect(a.error()).toBeNull();
  expect(a()).toBe(7);

  a.dispose();
});

test("AbortError from fetcher does not populate error", async () => {
  const id = signal(1);
  const def1 = makeDeferred<number>();
  const def2 = makeDeferred<number>();
  const defs = [def1, def2];

  const a = asyncComputed(async ({ abortSignal }) => {
    const myId = id();
    await defs[myId - 1];
    abortSignal.throwIfAborted();
    return myId;
  });

  await Promise.resolve();
  id.set(2);
  // Resolve the now-stale run; the fetcher will throw AbortError after.
  def1.resolve(0);
  def2.resolve(0);
  await flush();

  expect(a.error()).toBeNull();
  expect(a()).toBe(2);

  a.dispose();
});

test("refresh() re-runs even when no deps changed", async () => {
  let counter = 0;
  const a = asyncComputed(async () => ++counter);

  await flush();
  expect(a()).toBe(1);

  a.refresh();
  await flush();
  expect(a()).toBe(2);

  a.refresh();
  await flush();
  expect(a()).toBe(3);

  a.dispose();
});

test("auto-cleanup on component destroy aborts the in-flight signal", async () => {
  let captured: AbortSignal | null = null;
  const def = makeDeferred<number>();

  class Root extends Component {
    static template = xml``;
    a = asyncComputed(async ({ abortSignal }) => {
      captured = abortSignal;
      return def;
    });
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  expect(captured).not.toBeNull();
  expect(captured!.aborted).toBe(false);

  app.destroy();
  expect(captured!.aborted).toBe(true);
});

test("works without a scope; manual dispose aborts in-flight call", async () => {
  let captured: AbortSignal | null = null;
  const def = makeDeferred<number>();

  const a = asyncComputed(async ({ abortSignal }) => {
    captured = abortSignal;
    return def;
  });

  expect(captured).not.toBeNull();
  expect(captured!.aborted).toBe(false);

  a.dispose();
  expect(captured!.aborted).toBe(true);
});

test("synchronous throw inside fetcher populates error and clears loading", async () => {
  const a = asyncComputed((() => {
    throw new Error("sync-boom");
  }) as any);

  await flush();
  expect(a.error()).toMatchObject({ message: "sync-boom" });
  expect(a.loading()).toBe(false);
  a.dispose();
});

test("reads after the first await are NOT tracked", async () => {
  const id = signal(1);
  const filter = signal("a");
  const calls: { id: number; filter: string }[] = [];

  const a = asyncComputed(async () => {
    const myId = id();
    await Promise.resolve();
    const myFilter = filter();
    calls.push({ id: myId, filter: myFilter });
    return `${myId}/${myFilter}`;
  });

  await flush();
  expect(calls).toEqual([{ id: 1, filter: "a" }]);

  // Changing filter should NOT trigger a re-run (read after await).
  filter.set("b");
  await flush();
  expect(calls).toEqual([{ id: 1, filter: "a" }]);

  // Changing id (read before await) DOES trigger a re-run; the new run
  // observes the latest filter value.
  id.set(2);
  await flush();
  expect(calls).toEqual([
    { id: 1, filter: "a" },
    { id: 2, filter: "b" },
  ]);

  a.dispose();
});

test("composes with computed: downstream computed re-runs when value resolves", async () => {
  const def1 = makeDeferred<number[]>();
  const search = signal("1");

  const list = asyncComputed<number[]>(async () => def1, { initial: [] });
  const filtered = computed(() => {
    const f = search();
    return (list() ?? []).filter((n) => String(n).includes(f));
  });

  const seen: number[][] = [];
  const stop = effect(() => {
    seen.push(filtered());
  });

  expect(seen).toEqual([[]]);

  def1.resolve([1, 12, 23, 31]);
  await flush();
  expect(seen).toEqual([[], [1, 12, 31]]);

  search.set("2");
  await flush();
  expect(seen).toEqual([[], [1, 12, 31], [12, 23]]);

  stop();
  list.dispose();
});
