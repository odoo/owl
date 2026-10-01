import { atomSymbol, computed, effect, signal } from "../src";
import {
  type Atom,
  type ComputationAtom,
  createComputation,
  disposeComputation,
  onReadAtom,
  onWriteAtom,
  observerCount,
  setComputation,
  updateComputation,
} from "../src/computations";
import { waitScheduler } from "./helpers";

test("observer and source sets remain mutable and replaceable", () => {
  const value = signal(1);
  const atom = (value as any)[atomSymbol] as Atom;
  expect(atom.observers).toBeInstanceOf(Set);
  const observers = new Set<ComputationAtom>();
  atom.observers = observers;

  const computation = createComputation(() => value(), false);
  const sources = new Set<Atom>();
  computation.sources = sources;
  updateComputation(computation);
  expect(computation.value).toBe(1);
  expect(atom.observers).toBe(observers);
  expect(computation.sources).toBe(sources);
  expect([...observers]).toEqual([computation]);
  expect([...sources]).toEqual([atom]);
  disposeComputation(computation);
  expect(observers.size).toBe(0);
  expect(sources.size).toBe(0);
});

test("tracking primitives still accept plain atoms", async () => {
  const atom: Atom<number> = { value: 1, observers: new Set() };
  const values: number[] = [];
  const dispose = effect(() => {
    onReadAtom(atom);
    values.push(atom.value);
  });
  atom.value = 2;
  onWriteAtom(atom);
  await waitScheduler();
  expect(values).toEqual([1, 2]);
  dispose();
  expect(atom.observers.size).toBe(0);
});

test("another tracked read restores an externally removed reverse subscription", () => {
  const value = signal(1);
  const atom = (value as any)[atomSymbol] as Atom;
  const computation = createComputation(() => value(), false);
  updateComputation(computation);
  atom.observers.clear();
  setComputation(computation);
  try {
    value();
  } finally {
    setComputation(undefined);
  }
  expect(atom.observers.has(computation)).toBe(true);
  atom.observers = new Set();
  setComputation(computation);
  try {
    value();
  } finally {
    setComputation(undefined);
  }
  expect(atom.observers.has(computation)).toBe(true);
  disposeComputation(computation);
});

test.each([1, 2, 16, 17, 100])(
  "subscriptions survive %i observers and partial disposal",
  async (count) => {
    const value = signal(0);
    const atom = (value as any)[atomSymbol] as Atom;
    const calls: number[] = [];
    const stops = Array.from({ length: count }, (_, index) =>
      effect(() => {
        value();
        calls.push(index);
      })
    );
    expect(observerCount(atom)).toBe(count);
    calls.length = 0;
    value.set(1);
    await waitScheduler();
    expect(calls).toEqual(Array.from({ length: count }, (_, i) => i));

    // Delete from the middle of an observer array, retaining insertion order.
    for (let i = 0; i < count; i += 2) stops[i]();
    calls.length = 0;
    value.set(2);
    await waitScheduler();
    const remaining = Array.from({ length: count }, (_, i) => i).filter((i) => i % 2);
    expect(calls).toEqual(remaining);
    expect(observerCount(atom)).toBe(remaining.length);
    for (const stop of stops) stop();
    expect(observerCount(atom)).toBe(0);
  }
);

test("a computation can grow and shrink its dependencies across the array limit", async () => {
  const count = signal(0);
  const values = Array.from({ length: 40 }, () => signal(1));
  const atoms = values.map((value) => (value as any)[atomSymbol] as Atom);
  const total = computed(() => {
    let sum = 0;
    for (let i = 0, length = count(); i < length; i++) {
      // Reading each source twice must still establish only one dependency.
      sum += values[i]() + values[i]();
    }
    return sum;
  });
  let seen = 0;
  const stop = effect(() => {
    seen = total();
  });
  for (const length of [1, 3, 15, 16, 40, 2, 0, 40]) {
    count.set(length);
    await waitScheduler();
    expect(seen).toBe(length * 2);
    expect(atoms.map(observerCount)).toEqual(atoms.map((_, i) => Number(i < length)));
  }
  stop();
  disposeComputation((total as any)[atomSymbol]);
  expect(atoms.map(observerCount)).toEqual(atoms.map(() => 0));
});

test("throwing during recompute removes dependencies that were not read again", () => {
  const fails = signal(false);
  const value = signal(1);
  const total = computed(() => {
    if (fails()) throw new Error("recompute failed");
    return value();
  });
  expect(total()).toBe(1);
  fails.set(true);
  expect(() => total()).toThrow("recompute failed");
  expect(observerCount((value as any)[atomSymbol])).toBe(0);
  expect(observerCount((fails as any)[atomSymbol])).toBe(1);
  fails.set(false);
  expect(total()).toBe(1);
  disposeComputation((total as any)[atomSymbol]);
});

test("a branching computation graph agrees with eager evaluation after batched writes", async () => {
  let seed = 3207;
  function random(limit: number) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  }
  const raw = Array.from({ length: 8 }, (_, i) => i);
  const sources = raw.map((value) => signal(value));
  const nodes = [...sources];
  const definitions = Array.from({ length: 64 }, (_, i) => ({
    gate: random(i + sources.length),
    left: random(i + sources.length),
    right: random(i + sources.length),
  }));
  for (const { gate, left, right } of definitions) {
    nodes.push(computed(() => (nodes[gate]() & 1 ? nodes[left]() : nodes[right]()) % 17));
  }
  const seen = new Array<number>(8);
  const roots = nodes.slice(-8);
  const stops = roots.map((node, i) =>
    effect(() => {
      seen[i] = node();
    })
  );
  for (let step = 0; step < 100; step++) {
    for (let j = 0; j < 3; j++) {
      const index = random(raw.length);
      raw[index] = random(100);
      sources[index].set(raw[index]);
    }
    await waitScheduler();
    const expected = [...raw];
    for (const { gate, left, right } of definitions) {
      expected.push((expected[gate] & 1 ? expected[left] : expected[right]) % 17);
    }
    expect(seen).toEqual(expected.slice(-8));
    expect(nodes.map((node) => node())).toEqual(expected);
  }
  for (const stop of stops) stop();
  for (const node of nodes.slice(sources.length)) disposeComputation((node as any)[atomSymbol]);
});
