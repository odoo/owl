import { signal } from "../src";
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
