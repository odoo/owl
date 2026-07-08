import { atomSymbol, effect, signal } from "../src";
import { expectSpy, spyEffect, waitScheduler } from "./helpers";

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

test("trigger a signal", async () => {
  const s = signal(1);
  const e = spyEffect(() => s());
  e();
  expectSpy(e.spy, 1);
  s.set(1);
  expectSpy(e.spy, 1, { result: 1 });
  await waitScheduler();
  expectSpy(e.spy, 1, { result: 1 });
  signal.trigger(s);
  expectSpy(e.spy, 1, { result: 1 });
  await waitScheduler();
  expectSpy(e.spy, 2, { result: 1 });

  const fakeSignal = () => {};
  fakeSignal.set = () => {};
  expect(() => signal.trigger(fakeSignal)).toThrow(/Value is not a signal/);
});

describe("signal.ref", () => {
  test("starts at null and behaves like a plain signal", async () => {
    const ref = signal.ref();
    expect(ref()).toBe(null);

    const e = spyEffect(() => ref());
    e();
    expectSpy(e.spy, 1, { result: null });

    const el = {} as HTMLElement;
    ref.set(el);
    expect(ref()).toBe(el);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: el });

    ref.set(null);
    expect(ref()).toBe(null);
  });
});

describe("signal.Array", () => {
  test("can be created without an initial value", async () => {
    const reactiveArray = signal.Array<number>();
    expect(reactiveArray()).toEqual([]);

    const e = spyEffect(() => [...reactiveArray()]);
    e();
    reactiveArray().push(1);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: [1] });
  });

  test("simple use", async () => {
    const reactiveArray = signal.Array<number>([]);

    const e = spyEffect(() => reactiveArray());
    e();
    expectSpy(e.spy, 1);

    reactiveArray.set([1]);
    expectSpy(e.spy, 1, { result: [] });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: [1] });

    expect(reactiveArray()[0]).toEqual(1);
  });

  test("array element is reactive", async () => {
    const reactiveArray = signal.Array<number>([0]);

    const e = spyEffect(() => reactiveArray()[0]);
    e();
    expectSpy(e.spy, 1);

    reactiveArray()[0] = 1;
    expectSpy(e.spy, 1, { result: 0 });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });

    reactiveArray.set([2]);
    expectSpy(e.spy, 2, { result: 1 });

    await waitScheduler();
    expectSpy(e.spy, 3, { result: 2 });
  });

  test("data in array element is not reactive", async () => {
    const obj = { value: 0 };
    const reactiveArray = signal.Array<{ value: number }>([obj]);
    expect(reactiveArray()[0]).toBe(obj);

    const e = spyEffect(() => reactiveArray()[0].value);
    e();
    expectSpy(e.spy, 1);

    reactiveArray()[0].value = 1;
    expectSpy(e.spy, 1, { result: 0 });
    expect(reactiveArray()[0]).toBe(obj);

    await waitScheduler();
    expectSpy(e.spy, 1, { result: 0 });
    expect(reactiveArray()[0]).toBe(obj);
  });

  test("push an element invalidates the signal", async () => {
    const reactiveArray = signal.Array<number>([]);

    const e = spyEffect(() => reactiveArray());
    e();
    expectSpy(e.spy, 1);

    reactiveArray().push(1);
    expectSpy(e.spy, 1, { result: [1] }); // array is changed inplace

    await waitScheduler();
    expectSpy(e.spy, 2, { result: [1] }); // reactive has been invalidated

    reactiveArray.set([2]);
    expectSpy(e.spy, 2, { result: [1] });

    await waitScheduler();
    expectSpy(e.spy, 3, { result: [2] });
  });
});

describe("signal.Object", () => {
  test("can be created without an initial value", async () => {
    const reactiveObject = signal.Object<Record<string, number>>();
    expect(reactiveObject()).toEqual({});

    const e = spyEffect(() => reactiveObject());
    e();
    reactiveObject().a = 1;
    await waitScheduler();
    expectSpy(e.spy, 2, { result: { a: 1 } });
  });

  test("simple use", async () => {
    const reactiveObject = signal.Object<Record<string, any>>({});

    const e = spyEffect(() => reactiveObject());
    e();
    expectSpy(e.spy, 1);

    reactiveObject.set({ value: 1 });
    expectSpy(e.spy, 1, { result: {} });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: { value: 1 } });

    expect(reactiveObject().value).toEqual(1);
  });

  test("object element is reactive", async () => {
    const reactiveObject = signal.Object<Record<string, any>>({ a: 0 });

    const e = spyEffect(() => reactiveObject().a);
    e();
    expectSpy(e.spy, 1);

    reactiveObject().a = 1;
    expectSpy(e.spy, 1, { result: 0 });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });

    reactiveObject.set({ a: 2 });
    expectSpy(e.spy, 2, { result: 1 });

    await waitScheduler();
    expectSpy(e.spy, 3, { result: 2 });
  });

  test("data in object element are not reactive", async () => {
    const obj = { value: 0 };
    const reactiveObject = signal.Object<{ data: { value: number } }>({ data: obj });
    expect(reactiveObject().data).toBe(obj);

    const e = spyEffect(() => reactiveObject().data.value);
    e();
    expectSpy(e.spy, 1);

    reactiveObject().data.value = 1;
    expectSpy(e.spy, 1, { result: 0 });
    expect(reactiveObject().data).toBe(obj);

    await waitScheduler();
    expectSpy(e.spy, 1, { result: 0 });
    expect(reactiveObject().data).toBe(obj);
  });

  test("add or remove element on object", async () => {
    const reactiveObject = signal.Object<Record<string, any>>({});

    const e = spyEffect(() => reactiveObject());
    e();
    expectSpy(e.spy, 1);

    reactiveObject().a = 1;
    expectSpy(e.spy, 1, { result: { a: 1 } }); // array is changed inplace

    await waitScheduler();
    expectSpy(e.spy, 2, { result: { a: 1 } }); // reactive has been invalidated

    reactiveObject().b = 2;
    expectSpy(e.spy, 2, { result: { a: 1, b: 2 } }); // array is changed inplace

    await waitScheduler();
    expectSpy(e.spy, 3, { result: { a: 1, b: 2 } }); // reactive has been invalidated

    delete reactiveObject().a;
    expectSpy(e.spy, 3, { result: { b: 2 } }); // array is changed inplace

    await waitScheduler();
    expectSpy(e.spy, 4, { result: { b: 2 } }); // reactive has been invalidated
  });
});

describe("signal.Map", () => {
  test("can be created without an initial value", async () => {
    const reactiveMap = signal.Map<string, number>();
    expect(reactiveMap()).toEqual(new Map());

    const e = spyEffect(() => reactiveMap().get("a"));
    e();
    reactiveMap().set("a", 1);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });
  });

  test("simple use", async () => {
    const reactiveMap = signal.Map(new Map<string, number>());

    const e = spyEffect(() => reactiveMap().get("a"));
    e();
    expectSpy(e.spy, 1);

    reactiveMap().set("a", 1);
    expectSpy(e.spy, 1, { result: undefined });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });
  });

  test("Map item is not reactive", async () => {
    const obj = { value: 0 };
    const reactiveMap = signal.Map(new Map<string, { value: number }>([["a", obj]]));
    expect(reactiveMap().get("a")).toBe(obj);

    const e = spyEffect(() => reactiveMap().get("a")!.value);
    e();
    expectSpy(e.spy, 1);

    reactiveMap().get("a")!.value = 1;
    expectSpy(e.spy, 1, { result: 0 });
    expect(reactiveMap().get("a")).toBe(obj);

    await waitScheduler();
    expectSpy(e.spy, 1, { result: 0 });
    expect(reactiveMap().get("a")).toBe(obj);
  });

  test("get(key) only subscribes to that key", async () => {
    const reactiveMap = signal.Map(new Map<string, number>());

    const e = spyEffect(() => reactiveMap().get("a"));
    e();
    expectSpy(e.spy, 1, { result: undefined });

    // mutating an unobserved key must not trigger the effect
    reactiveMap().set("b", 42);
    await waitScheduler();
    expectSpy(e.spy, 1, { result: undefined });

    reactiveMap().set("a", 1);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });

    reactiveMap().delete("b");
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });

    reactiveMap().delete("a");
    await waitScheduler();
    expectSpy(e.spy, 3, { result: undefined });
  });

  test("has(key) only subscribes to that key", async () => {
    const reactiveMap = signal.Map(new Map<string, number>());

    const e = spyEffect(() => reactiveMap().has("a"));
    e();
    expectSpy(e.spy, 1, { result: false });

    reactiveMap().set("b", 42);
    await waitScheduler();
    expectSpy(e.spy, 1, { result: false });

    reactiveMap().set("a", 1);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: true });
  });

  test("set or delete element on map", async () => {
    const reactiveMap = signal.Map(new Map<string, number>());

    const e = spyEffect(() => [...reactiveMap()]);
    e();
    expectSpy(e.spy, 1);

    reactiveMap().set("a", 1);
    expectSpy(e.spy, 1, { result: [] });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: [["a", 1]] });

    reactiveMap().set("b", 2);
    expectSpy(e.spy, 2, { result: [["a", 1]] });

    await waitScheduler();
    expectSpy(e.spy, 3, {
      result: [
        ["a", 1],
        ["b", 2],
      ],
    });

    reactiveMap().delete("a");
    expectSpy(e.spy, 3, {
      result: [
        ["a", 1],
        ["b", 2],
      ],
    });

    await waitScheduler();
    expectSpy(e.spy, 4, { result: [["b", 2]] });
  });
});

describe("signal.Set", () => {
  test("can be created without an initial value", async () => {
    const reactiveSet = signal.Set<number>();
    expect(reactiveSet()).toEqual(new Set());

    const e = spyEffect(() => reactiveSet().has(1));
    e();
    reactiveSet().add(1);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: true });
  });

  test("simple use", async () => {
    const reactiveSet = signal.Set(new Set<number>());

    const e = spyEffect(() => [...reactiveSet()]);
    e();
    expectSpy(e.spy, 1);

    reactiveSet().add(1);
    expectSpy(e.spy, 1, { result: [] });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: [1] });
  });

  test("Set item is not reactive", async () => {
    const obj = { value: 0 };
    const reactiveSet = signal.Set(new Set<{ value: number }>([obj]));
    expect(reactiveSet().values().next().value).toBe(obj);

    const e = spyEffect(() => [...reactiveSet()]);
    e();
    expectSpy(e.spy, 1);

    reactiveSet().values().next().value!.value = 1;
    expectSpy(e.spy, 1, { result: [{ value: 1 }] }); // changed inplace
    expect(reactiveSet().values().next().value).toBe(obj);

    await waitScheduler();
    expectSpy(e.spy, 1, { result: [{ value: 1 }] });
    expect(reactiveSet().values().next().value).toBe(obj);
  });

  test("has(key) only subscribes to that key", async () => {
    const reactiveSet = signal.Set(new Set<number>());

    const e = spyEffect(() => reactiveSet().has(1));
    e();
    expectSpy(e.spy, 1, { result: false });

    // adding a different key must not trigger the effect
    reactiveSet().add(2);
    await waitScheduler();
    expectSpy(e.spy, 1, { result: false });

    reactiveSet().add(1);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: true });

    reactiveSet().delete(2);
    await waitScheduler();
    expectSpy(e.spy, 2, { result: true });

    reactiveSet().delete(1);
    await waitScheduler();
    expectSpy(e.spy, 3, { result: false });
  });

  test("replacing the whole signal still invalidates per-key observers", async () => {
    const reactiveSet = signal.Set(new Set<number>([1]));

    const e = spyEffect(() => reactiveSet().has(1));
    e();
    expectSpy(e.spy, 1, { result: true });

    reactiveSet.set(new Set<number>([2]));
    await waitScheduler();
    expectSpy(e.spy, 2, { result: false });
  });

  test("add or delete item on Set", async () => {
    const reactiveSet = signal.Set(new Set<number>());

    const e = spyEffect(() => [...reactiveSet()]);
    e();
    expectSpy(e.spy, 1);

    reactiveSet().add(1);
    expectSpy(e.spy, 1, { result: [] });

    await waitScheduler();
    expectSpy(e.spy, 2, { result: [1] });

    reactiveSet().add(2);
    expectSpy(e.spy, 2, { result: [1] });

    await waitScheduler();
    expectSpy(e.spy, 3, { result: [1, 2] });

    reactiveSet().delete(1);
    expectSpy(e.spy, 3, { result: [1, 2] });

    await waitScheduler();
    expectSpy(e.spy, 4, { result: [2] });
  });
});

describe("signal write granularity", () => {
  // Counts how many times onWriteAtom is called on the signal's own atom by
  // counting iterations of its observers set (onWriteAtom iterates it once
  // per call). A real effect is subscribed first: writes to an atom with no
  // observers skip the notification path entirely.
  function countAtomNotifications(sig: any): () => number {
    effect(() => sig());
    const atom = sig[atomSymbol];
    let count = 0;
    atom.observers = new (class extends Set<any> {
      [Symbol.iterator]() {
        count++;
        return super[Symbol.iterator]();
      }
    })(atom.observers);
    return () => count;
  }

  test("mutating a signal.Array does not notify the signal atom", () => {
    const reactiveArray = signal.Array<number>([0, 1]);
    const notified = countAtomNotifications(reactiveArray);

    // mutations only notify per-key atoms; the signal atom stands for the
    // value as a whole and is only notified by set()
    reactiveArray()[2] = 2;
    reactiveArray().push(3);
    reactiveArray().length = 1;
    delete reactiveArray()[0];
    expect(notified()).toBe(0);

    reactiveArray.set([]);
    expect(notified()).toBe(1);
  });

  test("mutating a signal.Object does not notify the signal atom", () => {
    const reactiveObject = signal.Object<Record<string, number>>({ a: 1 });
    const notified = countAtomNotifications(reactiveObject);

    reactiveObject().b = 2;
    delete reactiveObject().a;
    expect(notified()).toBe(0);

    reactiveObject.set({});
    expect(notified()).toBe(1);
  });

  test("writing an index does not re-run readers of another index", async () => {
    const data = signal.Array<number>();

    const e = spyEffect(() => data()[1]);
    e();
    expectSpy(e.spy, 1, { result: undefined });

    data()[2] = 2;
    await waitScheduler();
    expectSpy(e.spy, 1);

    data()[1] = 1;
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 1 });
  });

  test("writing a key does not re-run readers of another key", async () => {
    const obj = signal.Object<Record<string, number>>({ a: 1, b: 2 });

    const e = spyEffect(() => obj().a);
    e();
    expectSpy(e.spy, 1, { result: 1 });

    obj().b = 20;
    await waitScheduler();
    expectSpy(e.spy, 1);

    obj().a = 10;
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 10 });
  });

  test("growing an array by index write notifies length readers", async () => {
    const data = signal.Array<number>([0]);

    const e = spyEffect(() => data().length);
    e();
    expectSpy(e.spy, 1, { result: 1 });

    data()[3] = 3;
    await waitScheduler();
    expectSpy(e.spy, 2, { result: 4 });
  });

  test("writing the same value does not notify", async () => {
    const data = signal.Array<number>([0]);

    const e = spyEffect(() => data()[0]);
    e();
    expectSpy(e.spy, 1, { result: 0 });

    data()[0] = 0;
    await waitScheduler();
    expectSpy(e.spy, 1);
  });
});
