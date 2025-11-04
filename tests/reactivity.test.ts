import {
  Component,
  mount,
  onWillRender,
  onWillStart,
  onWillUpdateProps,
  useState,
  xml,
} from "../src";
import { markRaw, reactive, toRaw } from "../src/runtime/reactivity";
import { changesMap, effect } from "../src/runtime/signals";
import { reactiveMap } from "../src/runtime/listOperation";

import {
  makeDeferred,
  makeTestFixture,
  nextMicroTick,
  nextTick,
  snapshotEverything,
  spyEffect,
  steps,
  useLogLifecycle,
} from "./helpers";

function createReactive(value: any) {
  return reactive(value);
}

async function waitScheduler() {
  await nextMicroTick();
  return Promise.resolve();
}

function expectSpy(spy: jest.Mock, callTime: number, args: any[]): void {
  expect(spy).toHaveBeenCalledTimes(callTime);
  expect(spy).lastCalledWith(...args);
}

describe("Reactivity", () => {
  test("can read", async () => {
    const state = createReactive({ a: 1 });
    expect(state.a).toBe(1);
  });

  test("can create new keys", () => {
    const state = createReactive({});
    state.a = 1;
    expect(state.a).toBe(1);
  });

  test("can update", () => {
    const state = createReactive({ a: 1 });
    state.a = 2;
    expect(state.a).toBe(2);
  });

  test("can delete existing keys", () => {
    const state = createReactive({ a: 1 });
    delete state.a;
    expect(state).not.toHaveProperty("a");
  });

  test("act like an object", () => {
    const state = createReactive({ a: 1 });
    expect(Object.keys(state)).toEqual(["a"]);
    expect(Object.values(state)).toEqual([1]);
    expect(typeof state).toBe("object");
  });

  test("act like an array", () => {
    const state = createReactive(["a", "b"]);
    expect(state.length).toBe(2);
    expect(state).toEqual(["a", "b"]);
    expect(typeof state).toBe("object");
    expect(Array.isArray(state)).toBe(true);
  });

  test("Throw error if value is not proxifiable", () => {
    expect(() => createReactive(1)).toThrow("Cannot make the given value reactive");
  });

  test("effect is called when changing an observed property 1", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: 1 });
    effect(() => spy(state.a));
    expectSpy(spy, 1, [1]);
    state.a = 100;
    expectSpy(spy, 1, [1]);
    await waitScheduler();
    expectSpy(spy, 2, [100]);
    state.a = state.a + 5; // key is modified
    expectSpy(spy, 2, [100]);
    await waitScheduler();
    expectSpy(spy, 3, [105]);
  });

  test("effect is called when changing an observed property 2", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: { k: 1 } });
    effect(() => spy(state.a.k));
    expectSpy(spy, 1, [1]);
    state.a.k = state.a.k + 100;
    expectSpy(spy, 1, [1]);
    await waitScheduler();
    expectSpy(spy, 2, [101]);
    state.a.k = state.a.k + 5; // key is modified
    expectSpy(spy, 2, [101]);
    await waitScheduler();
    expectSpy(spy, 3, [106]);
  });

  test("reactive from object with a getter 1", async () => {
    const spy = jest.fn();
    let value = 1;
    const state = createReactive({
      get a() {
        return value;
      },
      set a(val) {
        value = val;
      },
    });
    effect(() => spy(state.a));
    expectSpy(spy, 1, [1]);
    state.a = state.a + 100;
    expectSpy(spy, 1, [1]);
    await waitScheduler();
    expectSpy(spy, 2, [101]);
  });

  test("reactive from object with a getter 2", async () => {
    const spy = jest.fn();
    let value = { b: 1 };
    const state = createReactive({
      get a() {
        return value;
      },
    });
    effect(() => spy(state.a.b));
    expectSpy(spy, 1, [1]);
    state.a.b = 100;
    expectSpy(spy, 1, [1]);
    await waitScheduler();
    expectSpy(spy, 2, [100]);
  });

  test("Operator 'in' causes key's presence to be observed", async () => {
    const spy = jest.fn();
    const state = createReactive({});
    effect(() => spy("a" in state));
    expectSpy(spy, 1, [false]);
    state.a = 100;
    await waitScheduler();
    expectSpy(spy, 2, [true]);

    state.a = 3; // Write on existing property shouldn't notify
    expectSpy(spy, 2, [true]);
    await waitScheduler();
    expectSpy(spy, 2, [true]);

    delete state.a;
    expectSpy(spy, 2, [true]);
    await waitScheduler();
    expectSpy(spy, 3, [false]);
    expect(spy).lastCalledWith(false);
  });

  //   // Skipped because the hasOwnProperty trap is tripped by *writing*. We
  //   // (probably) do not want to subscribe to changes on writes.
  //   test.skip("hasOwnProperty causes the key's presence to be observed", async () => {
  //     let n = 0;
  //     const state = createReactive({}, () => n++);

  //     Object.hasOwnProperty.call(state, "a");
  //     state.a = 2;
  //     expect(n).toBe(1);

  //     Object.hasOwnProperty.call(state, "a");
  //     state.a = 3;
  //     expect(n).toBe(1);

  //     Object.hasOwnProperty.call(state, "a");
  //     delete state.a;
  //     expect(n).toBe(2);
  //   });

  test("setting property to same value does not trigger callback", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: 1 });
    effect(() => spy(state.a));
    expectSpy(spy, 1, [1]);
    state.a = 1; // same value
    await waitScheduler();
    expectSpy(spy, 1, [1]);
    state.a = state.a + 5; // read and modifies property a to have value 6
    expectSpy(spy, 1, [1]);
    await waitScheduler();
    expectSpy(spy, 2, [6]);
    state.a = 6; // same value
    expectSpy(spy, 2, [6]);
    await waitScheduler();
    expectSpy(spy, 2, [6]);
  });

  test("observe cycles", async () => {
    const spy = jest.fn();
    const a = { a: {} };
    a.a = a;

    const state = createReactive(a);
    effect(() => spy(state.a));
    expectSpy(spy, 1, [state.a]);

    state.k;
    state.k = 2;
    expectSpy(spy, 1, [state.a]);
    await waitScheduler();
    expectSpy(spy, 1, [state.a]);

    delete state.l;
    await waitScheduler();
    expectSpy(spy, 1, [state.a]);

    delete state.k;
    await waitScheduler();
    expectSpy(spy, 1, [state.a]);

    state.a = 1;
    await waitScheduler();
    expectSpy(spy, 2, [1]);

    state.a = state.a + 100;
    await waitScheduler();
    expectSpy(spy, 3, [101]);
  });

  test("equality", async () => {
    const spy = jest.fn();
    const a = { a: {}, b: 1 };
    a.a = a;
    const state = createReactive(a);
    effect(() => spy(state.a, state.b));

    expect(state).toBe(state.a);
    state.b = state.b + 1;
    await waitScheduler();
    expectSpy(spy, 2, [state.a, 2]);
    expect(state).toBe(state.a);
  });

  test("two observers for same source", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();

    const obj = { a: 1 } as any;
    const state = createReactive(obj);
    const state2 = createReactive(obj);
    effect(() => spy1(state.a));
    effect(() => spy2(state2.a));

    state.a = 100;
    await waitScheduler();
    expectSpy(spy1, 2, [100]);
    expectSpy(spy2, 2, [100]);
  });

  test("create reactive from another", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const state = createReactive({ a: 1 });
    const state2 = createReactive(state);
    effect(() => spy1(state.a));
    effect(() => spy2(state2.a));

    state2.a = state2.a + 100;
    await waitScheduler();
    expectSpy(spy1, 2, [101]);
    expectSpy(spy2, 2, [101]);
  });

  test("throws on primitive values", () => {
    expect(() => createReactive(1)).toThrowError();
    expect(() => createReactive("asf")).toThrowError();
    expect(() => createReactive(true)).toThrowError();
    expect(() => createReactive(null)).toThrowError();
    expect(() => createReactive(undefined)).toThrowError();
  });

  test("throws on dates", () => {
    const date = new Date();
    expect(() => createReactive(date)).toThrow("Cannot make the given value reactive");
  });

  test("can observe object with some key set to null", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: { b: null } } as any);
    effect(() => spy(state.a.b));
    state.a.b = Boolean(state.a.b);
    await waitScheduler();
    expectSpy(spy, 2, [false]);
  });

  test("contains initial values", () => {
    const state = createReactive({ a: 1, b: 2 });
    expect(state.a).toBe(1);
    expect(state.b).toBe(2);
    expect((state as any).c).toBeUndefined();
  });

  test("properly handle dates", async () => {
    const spy = jest.fn();
    const date = new Date();
    const state = createReactive({ date });
    effect(() => spy(state.date));

    expect(typeof state.date.getFullYear()).toBe("number");
    expect(state.date).toBe(date);

    state.date = new Date();
    await waitScheduler();
    expectSpy(spy, 2, [state.date]);
    expect(state.date).not.toBe(date);
  });

  test("properly handle promise", async () => {
    let resolved = false;
    const state = createReactive({ prom: Promise.resolve() });

    expect(state.prom).toBeInstanceOf(Promise);
    state.prom.then(() => (resolved = true));
    expect(resolved).toBe(false);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  test("can observe value change in array in an object", async () => {
    const spy = jest.fn();
    const state = createReactive({ arr: [1, 2] }) as any;
    effect(() => spy(state.arr[0]));

    expect(Array.isArray(state.arr)).toBe(true);

    state.arr[0] = state.arr[0] + "nope";
    await waitScheduler();
    expectSpy(spy, 2, ["1nope"]);

    expect(state.arr[0]).toBe("1nope");
    expect(state.arr).toEqual(["1nope", 2]);
  });

  test("can observe: changing array in object to another array", async () => {
    const spy = jest.fn();
    const state = createReactive({ arr: [1, 2] }) as any;
    effect(() => spy(state.arr[0]));

    expect(Array.isArray(state.arr)).toBe(true);
    expectSpy(spy, 1, [1]);

    state.arr = [2, 1];
    await waitScheduler();
    expectSpy(spy, 2, [2]);
    expect(state.arr[0]).toBe(2);
    expect(state.arr).toEqual([2, 1]);
  });

  test("getting the same property twice returns the same object", () => {
    const state = createReactive({ a: { b: 1 } });
    const a1 = state.a;
    const a2 = state.a;
    expect(a1).toBe(a2);
  });

  test("various object property changes", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: 1 });
    effect(() => spy(state.a));
    expectSpy(spy, 1, [1]);

    state.a = state.a + 2;
    await waitScheduler();
    expectSpy(spy, 2, [3]);

    state.a;
    // same value again: no notification
    state.a = 3;
    await waitScheduler();
    expectSpy(spy, 2, [3]);

    state.a = 4;
    await waitScheduler();
    expectSpy(spy, 3, [4]);
  });

  test("properly observe arrays", async () => {
    const spy = jest.fn();
    const state = createReactive([]);
    effect(() => spy([...state]));

    expect(Array.isArray(state)).toBe(true);
    expect(state.length).toBe(0);
    expectSpy(spy, 1, [[]]);

    state.push(1);
    await waitScheduler();
    expectSpy(spy, 2, [[1]]);
    expect(state.length).toBe(1);
    expect(state).toEqual([1]);

    state.splice(1, 0, "hey");
    await waitScheduler();
    expectSpy(spy, 3, [[1, "hey"]]);
    expect(state).toEqual([1, "hey"]);
    expect(state.length).toBe(2);

    // clear all observations caused by previous expects
    debugger;
    state[0] = 2;
    await waitScheduler();
    expectSpy(spy, 4, [[2, "hey"]]);

    state.unshift("lindemans");
    await waitScheduler();
    expectSpy(spy, 5, [["lindemans", 2, "hey"]]);
    expect(state).toEqual(["lindemans", 2, "hey"]);
    expect(state.length).toBe(3);

    // clear all observations caused by previous expects
    state[1] = 3;
    await waitScheduler();
    expectSpy(spy, 6, [["lindemans", 3, "hey"]]);

    state.reverse();
    await waitScheduler();
    expectSpy(spy, 7, [["hey", 3, "lindemans"]]);
    expect(state).toEqual(["hey", 3, "lindemans"]);
    expect(state.length).toBe(3);

    state.pop();
    await waitScheduler();
    expectSpy(spy, 8, [["hey", 3]]);
    expect(state).toEqual(["hey", 3]);
    expect(state.length).toBe(2);

    state.shift();
    await waitScheduler();
    expectSpy(spy, 9, [[3]]);
    expect(state).toEqual([3]);
    expect(state.length).toBe(1);
  });
  test("object pushed into arrays are observed", async () => {
    const spy = jest.fn();
    const arr: any = createReactive([]);
    effect(() => spy(arr[0]?.kriek));

    arr.push({ kriek: 5 });
    await waitScheduler();
    expectSpy(spy, 2, [5]);

    arr[0].kriek = 6;
    await waitScheduler();
    expectSpy(spy, 3, [6]);

    arr[0].kriek = arr[0].kriek + 6;
    await waitScheduler();
    expectSpy(spy, 4, [12]);
  });

  test("set new property on observed object", async () => {
    const spy = jest.fn();
    const state = createReactive({});
    effect(() => spy(Object.keys(state)));
    expectSpy(spy, 1, [[]]);

    state.b = 8;
    await waitScheduler();
    expectSpy(spy, 2, [["b"]]);
    expect(state.b).toBe(8);
    expect(Object.keys(state)).toEqual(["b"]);
  });

  test("set new property object when key changes are not observed", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: 1 });
    effect(() => spy(state.a));
    expectSpy(spy, 1, [1]);

    state.b = 8;
    await waitScheduler();
    expectSpy(spy, 1, [1]); // Not observing key changes: shouldn't get notified
    expect(state.b).toBe(8);
    expect(state).toEqual({ a: 1, b: 8 });
  });

  test("delete property from observed object", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: 1, b: 8 });
    effect(() => spy(Object.keys(state)));
    expectSpy(spy, 1, [["a", "b"]]);

    delete state.b;
    await waitScheduler();
    expectSpy(spy, 2, [["a"]]);
    expect(state).toEqual({ a: 1 });
  });

  //todo
  test.skip("delete property from observed object 2", async () => {
    const spy = jest.fn();
    const obj = { a: { b: 1 } };
    const state = createReactive(obj.a);
    const state2 = createReactive(obj);
    effect(() => spy(Object.keys(state2)));
    expect(state2.a).toBe(state);
    expectSpy(spy, 1, [["a"]]);

    Object.keys(state2);
    delete state2.a;
    await waitScheduler();
    expectSpy(spy, 2, [[]]);

    state.new = 2;
    await waitScheduler();
    expectSpy(spy, 3, [["new"]]);
  });

  test("set element in observed array", async () => {
    const spy = jest.fn();
    const arr = createReactive(["a"]);
    effect(() => spy(arr[1]));
    arr[1] = "b";
    await waitScheduler();
    expectSpy(spy, 2, ["b"]);
    expect(arr).toEqual(["a", "b"]);
  });

  test("properly observe arrays in object", async () => {
    const spy = jest.fn();
    const state = createReactive({ arr: [] }) as any;
    effect(() => spy(state.arr.length));

    expect(state.arr.length).toBe(0);
    expectSpy(spy, 1, [0]);

    state.arr.push(1);
    await waitScheduler();
    expectSpy(spy, 2, [1]);
    expect(state.arr.length).toBe(1);
  });

  test("properly observe objects in array", async () => {
    const spy = jest.fn();
    const state = createReactive({ arr: [{ something: 1 }] }) as any;
    effect(() => spy(state.arr[0].something));
    expectSpy(spy, 1, [1]);

    state.arr[0].something = state.arr[0].something + 1;
    await waitScheduler();
    expectSpy(spy, 2, [2]);
    expect(state.arr[0].something).toBe(2);
  });

  test("properly observe objects in object", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: { b: 1 } }) as any;
    effect(() => spy(state.a.b));
    expectSpy(spy, 1, [1]);

    state.a.b = state.a.b + 2;
    await waitScheduler();
    expectSpy(spy, 2, [3]);
  });

  test("Observing the same object through the same reactive preserves referential equality", async () => {
    const o = {} as any;
    o.o = o;
    const state = createReactive(o);
    expect(state.o).toBe(state);
    expect(state.o.o).toBe(state);
  });

  test("reobserve new object values", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: 1 });
    effect(() => spy(state.a?.b || state.a));
    expectSpy(spy, 1, [1]);

    state.a++;
    await waitScheduler();
    expectSpy(spy, 2, [2]);

    state.a = { b: 100 };
    await waitScheduler();
    expectSpy(spy, 3, [100]);

    state.a.b = state.a.b + 3;
    await waitScheduler();
    expectSpy(spy, 4, [103]);
  });

  test("deep observe misc changes", async () => {
    const spy = jest.fn();
    const state = createReactive({ o: { a: 1 }, arr: [1], n: 13 }) as any;
    effect(() => spy(state.o.a, state.arr.length, state.n));
    expectSpy(spy, 1, [1, 1, 13]);

    state.o.a = state.o.a + 2;
    await waitScheduler();
    expectSpy(spy, 2, [3, 1, 13]);

    state.arr.push(2);
    await waitScheduler();
    expectSpy(spy, 3, [3, 2, 13]);

    state.n = 155;
    await waitScheduler();
    expectSpy(spy, 4, [3, 2, 155]);

    state.n = state.n + 1;
    await waitScheduler();
    expectSpy(spy, 5, [3, 2, 156]);
  });

  test("properly handle already observed object", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();

    const obj1 = createReactive({ a: 1 });
    const obj2 = createReactive({ b: 1 });

    effect(() => spy1(obj1.a));
    effect(() => spy2(obj2.b));

    obj1.a = obj1.a + 2;
    obj2.b = obj2.b + 3;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 2, [4]);

    (window as any).d = true;
    obj2.b = obj1;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 3, [obj1]);

    obj1.a = 33;
    await waitScheduler();
    expectSpy(spy1, 3, [33]);
    expectSpy(spy2, 3, [obj1]);

    obj2.b.a = obj2.b.a + 2;
    await waitScheduler();
    expectSpy(spy1, 4, [35]);
    expectSpy(spy2, 3, [obj1]);
  });

  test("properly handle already observed object in observed object", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const obj1 = createReactive({ a: { c: 2 } });
    const obj2 = createReactive({ b: 1 });

    effect(() => spy1(obj1.a.c));
    effect(() => spy2(obj2.c?.a?.c));

    obj2.c = obj1;
    await waitScheduler();
    expectSpy(spy1, 1, [2]);
    expectSpy(spy2, 2, [2]);

    obj1.a.c = obj1.a.c + 33;
    await waitScheduler();
    expectSpy(spy1, 2, [35]);
    expectSpy(spy2, 3, [35]);

    obj2.c.a.c = obj2.c.a.c + 3;
    await waitScheduler();
    expectSpy(spy1, 3, [38]);
    expectSpy(spy2, 4, [38]);
  });

  test("can reobserve nested properties in object", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const state = createReactive({ a: [{ b: 1 }] }) as any;

    const state2 = createReactive(state) as any;

    effect(() => spy1(state.a[0].b));
    effect(() => spy2(state2.c));

    state.a[0].b = state.a[0].b + 2;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 1, [undefined]);

    state2.c = 2;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 2, [2]);
  });

  test("rereading some property again give exactly same result", () => {
    const state = createReactive({ a: { b: 1 } });
    const obj1 = state.a;
    const obj2 = state.a;
    expect(obj1).toBe(obj2);
  });

  test("can reobserve new properties in object", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const state = createReactive({ a: [{ b: 1 }] }) as any;

    effect(() => spy1(state.a[0].b.c));
    effect(() => spy2(state.a[0].b));

    state.a[0].b = { c: 1 };
    await waitScheduler();
    expectSpy(spy1, 2, [1]);
    expectSpy(spy2, 2, [{ c: 1 }]);

    state.a[0].b.c = state.a[0].b.c + 2;
    await waitScheduler();
    expectSpy(spy1, 3, [3]);
    expectSpy(spy2, 2, [{ c: 3 }]);
  });

  test("can set a property more than once", async () => {
    const spy = jest.fn();
    const state = createReactive({}) as any;
    effect(() => spy(state.aku));

    state.aky = state.aku;
    expectSpy(spy, 1, [undefined]);

    state.aku = "always finds annoying problems";
    await waitScheduler();
    expectSpy(spy, 2, ["always finds annoying problems"]);

    state.aku = "always finds good problems";
    await waitScheduler();
    expectSpy(spy, 3, ["always finds good problems"]);
  });

  test("properly handle swapping elements", async () => {
    const spy = jest.fn();
    const arrDict = { arr: [] };
    const state = createReactive({ a: arrDict, b: 1 }) as any;
    effect(() => {
      Array.isArray(state.b?.arr) && [...state.b.arr];
      return spy(state.a, state.b);
    });
    expectSpy(spy, 1, [arrDict, 1]);

    // swap a and b
    const b = state.b;
    const a = state.a;
    state.b = a;
    state.a = b;
    await waitScheduler();
    expectSpy(spy, 2, [1, arrDict]);

    // push something into array to make sure it works
    state.b.arr.push("blanche");
    await waitScheduler();
    expectSpy(spy, 3, [1, arrDict]);
  });

  test("properly handle assigning object containing array to reactive", async () => {
    const spy = jest.fn();
    const state = createReactive({ a: { arr: [], val: "test" } }) as any;
    effect(() => spy(state.a, [...state.a.arr]));
    expectSpy(spy, 1, [state.a, []]);

    state.a = { ...state.a, val: "test2" };
    await waitScheduler();
    expectSpy(spy, 2, [state.a, []]);

    // push something into array to make sure it works
    state.a.arr.push("blanche");
    await waitScheduler();
    expectSpy(spy, 3, [state.a, ["blanche"]]);
  });

  test("accept cycles in observed object", async () => {
    const spy = jest.fn();
    let obj1: any = {};
    let obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    obj1 = createReactive(obj1) as any;
    obj2 = obj1.a;
    effect(() => spy(obj1.key));
    expectSpy(spy, 1, [undefined]);

    obj1.key = 3;
    await waitScheduler();
    expectSpy(spy, 2, [3]);
  });

  test("call callback when reactive is changed", async () => {
    const spy = jest.fn();
    const state: any = createReactive({ a: 1, b: { c: 2 }, d: [{ e: 3 }], f: 4 });
    effect(() => spy(state.a, state.b.c, state.d[0].e, state.f));
    expectSpy(spy, 1, [1, 2, 3, 4]);

    state.a = state.a + 2;
    await waitScheduler();
    expectSpy(spy, 2, [3, 2, 3, 4]);

    state.b.c = state.b.c + 3;
    await waitScheduler();
    expectSpy(spy, 3, [3, 5, 3, 4]);

    state.d[0].e = state.d[0].e + 5;
    await waitScheduler();
    expectSpy(spy, 4, [3, 5, 8, 4]);

    state.a = 111;
    state.f = 222;
    await waitScheduler();
    expectSpy(spy, 5, [111, 5, 8, 222]);
  });

  test("reactive inside other reactive", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const inner = createReactive({ a: 1 });
    const outer = createReactive({ b: inner });

    effect(() => spy1(inner.a));
    effect(() => spy2(outer.b.a));

    expectSpy(spy1, 1, [1]);
    expectSpy(spy2, 1, [1]);

    outer.b.a = outer.b.a + 2;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 2, [3]);
  });

  test("reactive inside other reactive, variant", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const inner = createReactive({ a: 1 });
    const outer = createReactive({ b: inner, c: 0 });
    effect(() => spy1(inner.a));
    effect(() => spy2(outer.c));
    expectSpy(spy1, 1, [1]);
    expectSpy(spy2, 1, [0]);

    inner.a = inner.a + 2;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 1, [0]);

    outer.c = outer.c + 3;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 2, [3]);
  });

  test("reactive inside other reactive, variant 2", async () => {
    const spy1 = jest.fn();
    const spy2 = jest.fn();
    const spy3 = jest.fn();
    const obj1 = createReactive({ a: 1 });
    const obj2 = createReactive({ b: {} });
    const obj3 = createReactive({ c: {} });

    effect(() => spy1(obj1.a));
    effect(() => spy2(obj2.b));
    effect(() => spy3(obj3.c));

    // assign the same object shouldn't notify reactivity
    obj2.b = obj2.b;
    obj3.c = obj3.c;
    await waitScheduler();
    expectSpy(spy1, 1, [1]);
    expectSpy(spy2, 1, [{}]);
    expectSpy(spy3, 1, [{}]);

    obj2.b = obj1;
    obj3.c = obj1;
    await waitScheduler();
    expectSpy(spy1, 1, [1]);
    expectSpy(spy2, 2, [obj1]);
    expectSpy(spy3, 2, [obj1]);

    obj1.a = obj1.a + 2;
    await waitScheduler();
    expectSpy(spy1, 2, [3]);
    expectSpy(spy2, 2, [obj1]);
    expectSpy(spy3, 2, [obj1]);

    obj2.b.a = obj2.b.a + 1;
    await waitScheduler();
    expectSpy(spy1, 3, [4]);
    expectSpy(spy2, 2, [obj1]);
    expectSpy(spy3, 2, [obj1]);
  });

  //   test("notification is not done after unregistration", async () => {
  //     let n = 0;
  //     const observer = () => n++;
  //     const unregisterObserver = registerObserver(observer);
  //     const state = atom({ a: 1 } as any, observer);

  //     state.a = state.a;
  //     await nextMicroTick();
  //     expect(n).toBe(0);

  //     unregisterObserver();

  //     state.a = { b: 2 };
  //     await nextMicroTick();
  //     expect(n).toBe(0);

  //     state.a.b = state.a.b + 3;
  //     await nextMicroTick();
  //     expect(n).toBe(0);
  //   });

  test("don't react to changes in subobject that has been deleted", async () => {
    const spy = jest.fn();
    const a = { k: {} } as any;
    const state = createReactive(a);

    effect(() => spy(state.k?.l));

    state.k.l = 1;
    await waitScheduler();
    expectSpy(spy, 2, [1]);

    const kVal = state.k;

    delete state.k;
    await waitScheduler();
    expectSpy(spy, 3, [undefined]);

    kVal.l = 2;
    await waitScheduler();
    expectSpy(spy, 3, [undefined]); // kVal must no longer be observed
  });

  test("don't react to changes in subobject that has been deleted", async () => {
    const spy = jest.fn();
    const b = {} as any;
    const a = { k: b } as any;
    const state2 = createReactive(b);
    const state = createReactive(a);

    effect(() => spy(state.k?.d));

    state.c = 1;
    state.k.d = 2;
    await waitScheduler();
    expectSpy(spy, 2, [2]);

    delete state.k;
    await waitScheduler();
    expectSpy(spy, 3, [undefined]);

    state2.e = 3;
    await waitScheduler();
    expectSpy(spy, 3, [undefined]);
  });

  test("don't react to changes in subobject that has been deleted 3", async () => {
    const spy = jest.fn();
    const b = {} as any;
    const a = { k: b } as any;
    const state = createReactive(a);
    const state2 = createReactive(b);

    effect(() => spy(state.k?.d));

    state.c = 1;
    state.k.d = 2;
    await waitScheduler();
    expectSpy(spy, 2, [2]);

    delete state.k;
    await waitScheduler();
    expectSpy(spy, 3, [undefined]);

    state2.e = 3;
    await waitScheduler();
    expectSpy(spy, 3, [undefined]);
  });

  test("don't react to changes in subobject that has been replaced", async () => {
    const spy = jest.fn();
    const a = { k: { n: 1 } } as any;
    const state = createReactive(a);
    const kVal = state.k; // read k

    effect(() => spy(state.k.n));
    expectSpy(spy, 1, [1]);

    state.k = { n: state.k.n + 1 };
    await waitScheduler();
    expectSpy(spy, 2, [2]);
    expect(state.k).toEqual({ n: 2 });

    kVal.n = 3;
    await waitScheduler();
    expectSpy(spy, 2, [2]);
    expect(state.k).toEqual({ n: 2 });
  });

  test("can access properties on reactive of frozen objects", async () => {
    const obj = Object.freeze({ a: {} });
    const state = createReactive(obj);
    expect(() => state.a).not.toThrow();
    expect(state.a).toBe(obj.a);
  });

  test("writing on object with reactive in prototype chain doesn't notify", async () => {
    const spy = jest.fn();
    const state = createReactive({ val: 0 });
    effect(() => spy(state.val));
    const nonReactive = Object.create(state);
    nonReactive.val++;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(toRaw(state)).toEqual({ val: 0 });
    expect(toRaw(nonReactive)).toEqual({ val: 1 });
    state.val++;
    await waitScheduler();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(toRaw(state)).toEqual({ val: 1 });
    expect(toRaw(nonReactive)).toEqual({ val: 1 });
  });

  test("creating key on object with reactive in prototype chain doesn't notify", async () => {
    const spy = jest.fn();
    const parent = createReactive({});
    const child = Object.create(parent);
    effect(() => spy(Object.keys(parent)));
    child.val = 0;
    await waitScheduler();
    expectSpy(spy, 1, [[]]);
  });

  test("reactive of object with reactive in prototype chain is not the object from the prototype chain", async () => {
    const spy = jest.fn();
    const parent = createReactive({ val: 0 });
    const child = createReactive(Object.create(parent));
    effect(() => spy(child.val));
    expect(child).not.toBe(parent);

    child.val++;
    await waitScheduler();
    expectSpy(spy, 2, [1]);
    expect(parent.val).toBe(0);
    expect(child.val).toBe(1);
  });

  test("can create reactive of object with non-reactive in prototype chain", async () => {
    const spy = jest.fn();
    const parent = markRaw({ val: 0 });
    const child = createReactive(Object.create(parent));
    effect(() => spy(child.val));
    child.val++;
    await waitScheduler();
    expectSpy(spy, 2, [1]);
    expect(parent).toEqual({ val: 0 });
    expect(child).toEqual({ val: 1 });
  });
});

describe("Collections", () => {
  describe("Set", () => {
    test("can make reactive Set", () => {
      const set = new Set<number>();
      const obj = reactive(set);
      expect(obj).not.toBe(set);
    });

    test("can read", async () => {
      const state = reactive(new Set([1]));
      expect(state.has(1)).toBe(true);
      expect(state.has(0)).toBe(false);
    });

    test("can add entries", () => {
      const state = reactive(new Set());
      state.add(1);
      expect(state.has(1)).toBe(true);
    });

    test("can remove entries", () => {
      const state = reactive(new Set([1]));
      state.delete(1);
      expect(state.has(1)).toBe(false);
    });

    test("can clear entries", () => {
      const state = reactive(new Set([1]));
      expect(state.size).toBe(1);
      state.clear();
      expect(state.size).toBe(0);
    });

    test("act like a Set", () => {
      const state = reactive(new Set([1]));
      expect([...state.entries()]).toEqual([[1, 1]]);
      expect([...state.values()]).toEqual([1]);
      expect([...state.keys()]).toEqual([1]);
      expect([...state]).toEqual([1]); // Checks Symbol.iterator
      expect(state.size).toBe(1);
      expect(typeof state).toBe("object");
      expect(state).toBeInstanceOf(Set);
    });

    test("reactive Set contains its keys", () => {
      const state = reactive(new Set([{}]));
      expect(state.has(state.keys().next().value)).toBe(true);
    });

    test("reactive Set contains its values", () => {
      const state = reactive(new Set([{}]));
      expect(state.has(state.values().next().value)).toBe(true);
    });

    test("reactive Set contains its entries' keys and values", () => {
      const state = reactive(new Set([{}]));
      const [key, val] = state.entries().next().value;
      expect(state.has(key)).toBe(true);
      expect(state.has(val)).toBe(true);
    });

    test("checking for a key subscribes the callback to changes to that key", async () => {
      const spy = jest.fn();
      const state = reactive(new Set([1]));
      effect(() => spy(state.has(2)));

      expectSpy(spy, 1, [false]);
      state.add(2);
      await waitScheduler();
      expectSpy(spy, 2, [true]);
      state.delete(2);
      await waitScheduler();
      expectSpy(spy, 3, [false]);
      state.add(2);
      await waitScheduler();
      expectSpy(spy, 4, [true]);
      state.clear();
      await waitScheduler();
      expectSpy(spy, 5, [false]);
      state.clear(); // clearing again doesn't notify again
      await waitScheduler();
      expectSpy(spy, 5, [false]);

      state.add(3); // setting unobserved key doesn't notify
      await waitScheduler();
      expectSpy(spy, 5, [false]);
      expect(state.has(3)).toBe(true); // subscribe to 3
      state.add(3); // adding observed key doesn't notify if key was already present
      await waitScheduler();
      expectSpy(spy, 5, [false]);
      expect(state.has(4)).toBe(false); // subscribe to 4
      state.delete(4); // deleting observed key doesn't notify if key was already not present
      await waitScheduler();
      expectSpy(spy, 5, [false]);
    });

    test("iterating on keys returns reactives", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Set([obj]));
      const reactiveObj = state.keys().next().value!;
      effect(() => spy(reactiveObj.a));
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a; // observe key "a" in sub-reactive;
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating on values returns reactives", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Set([obj]));
      const reactiveObj = state.values().next().value!;
      effect(() => spy(reactiveObj.a));
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a; // observe key "a" in sub-reactive;
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating on entries returns reactives", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Set([obj]));
      const [reactiveObj, reactiveObj2] = state.entries().next().value!;
      expect(reactiveObj2).toBe(reactiveObj);
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      effect(() => spy(reactiveObj.a));
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a; // observe key "a" in sub-reactive;
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating on reactive Set returns reactives", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Set([obj]));
      const reactiveObj = state[Symbol.iterator]().next().value!;
      effect(() => spy(reactiveObj.a));
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a; // observe key "a" in sub-reactive;
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating with forEach returns reactives", async () => {
      const keyObj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Set([keyObj]));
      let reactiveKeyObj: any, reactiveValObj: any, thisObj: any, mapObj: any;
      const thisArg = {};
      state.forEach(function (this: any, val, key, map) {
        [reactiveValObj, reactiveKeyObj, mapObj, thisObj] = [val, key, map, this];
      }, thisArg);
      expect(reactiveKeyObj).not.toBe(keyObj);
      expect(reactiveValObj).not.toBe(keyObj);
      expect(mapObj).toBe(state); // third argument should be the reactive
      expect(thisObj).toBe(thisArg); // thisArg should not be made reactive
      expect(toRaw(reactiveKeyObj as any)).toBe(keyObj);
      expect(toRaw(reactiveValObj as any)).toBe(keyObj);
      expect(reactiveKeyObj).toBe(reactiveValObj); // reactiveKeyObj and reactiveValObj should be the same object

      effect(() => spy(reactiveKeyObj.a));
      expectSpy(spy, 1, [2]);

      reactiveKeyObj!.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);

      reactiveKeyObj!.a; // observe key "a" in key sub-reactive;
      reactiveKeyObj!.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);

      reactiveKeyObj!.a = 1; // setting same value again shouldn't notify
      reactiveValObj!.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });
  });

  describe("WeakSet", () => {
    test("cannot make reactive WeakSet", () => {
      const set = new WeakSet();
      expect(() => reactive(set)).toThrowError("Cannot make the given value reactive");
    });

    test("WeakSet in reactive is original WeakSet", () => {
      const obj = { set: new WeakSet() };
      const state = reactive(obj);
      expect(state.set).toBe(obj.set);
    });
  });

  describe("Map", () => {
    test("can make reactive Map", () => {
      const map = new Map();
      const obj = reactive(map);
      expect(obj).not.toBe(map);
    });

    test("can read", async () => {
      const state = reactive(new Map([[1, 0]]));
      expect(state.has(1)).toBe(true);
      expect(state.has(0)).toBe(false);
      expect(state.get(1)).toBe(0);
      expect(state.get(0)).toBeUndefined();
    });

    test("can add entries", () => {
      const state = reactive(new Map());
      state.set(1, 2);
      expect(state.has(1)).toBe(true);
      expect(state.get(1)).toBe(2);
    });

    test("can remove entries", () => {
      const state = reactive(new Map([[1, 2]]));
      state.delete(1);
      expect(state.has(1)).toBe(false);
      expect(state.get(1)).toBeUndefined();
    });

    test("can clear entries", () => {
      const state = reactive(new Map([[1, 2]]));
      expect(state.size).toBe(1);
      state.clear();
      expect(state.size).toBe(0);
    });

    test("act like a Map", () => {
      const state = reactive(new Map([[1, 2]]));
      expect([...state.entries()]).toEqual([[1, 2]]);
      expect([...state.values()]).toEqual([2]);
      expect([...state.keys()]).toEqual([1]);
      expect([...state]).toEqual([[1, 2]]); // Checks Symbol.iterator
      expect(state.size).toBe(1);
      expect(typeof state).toBe("object");
      expect(state).toBeInstanceOf(Map);
    });

    test("reactive Map contains its keys", () => {
      const state = reactive(new Map([[{}, 1]]));
      expect(state.has(state.keys().next().value)).toBe(true);
    });

    test("reactive Map values are equal to doing a get on the appropriate key", () => {
      const state = reactive(new Map([[1, {}]]));
      expect(state.get(1)).toBe(state.values().next().value);
    });

    test("reactive Map contains its entries' keys, and the associated value is the same as doing get", () => {
      const state = reactive(new Map([[{}, {}]]));
      const [key, val] = state.entries().next().value;
      expect(state.has(key)).toBe(true);
      expect(val).toBe(state.get(key));
    });

    test("checking for a key with 'has' subscribes the callback to changes to that key", async () => {
      const spy = jest.fn();
      const state = reactive(new Map([[1, 2]]));
      effect(() => spy(state.has(2)));

      expectSpy(spy, 1, [false]);
      state.set(2, 3);
      await waitScheduler();
      expectSpy(spy, 2, [true]);
      state.delete(2);
      await waitScheduler();
      expectSpy(spy, 3, [false]);
      state.set(2, 3);
      await waitScheduler();
      expectSpy(spy, 4, [true]);
      state.clear();
      await waitScheduler();
      expectSpy(spy, 5, [false]);
      state.clear(); // clearing again doesn't notify again
      await waitScheduler();
      expectSpy(spy, 5, [false]);

      state.set(3, 4); // setting unobserved key doesn't notify
      await waitScheduler();
      expectSpy(spy, 5, [false]);
      expect(state.has(3)).toBe(true); // subscribe to 3
      state.set(3, 4); // setting the same value doesn't notify
      await waitScheduler();
      expectSpy(spy, 5, [false]);
      expect(state.has(4)).toBe(false); // subscribe to 4
      state.delete(4); // deleting observed key doesn't notify if key was already not present
      await waitScheduler();
      expectSpy(spy, 5, [false]);
    });

    test("checking for a key with 'get' subscribes the callback to changes to that key", async () => {
      const spy = jest.fn();
      const state = reactive(new Map([[1, 2]]));
      effect(() => spy(state.get(2)));

      expectSpy(spy, 1, [undefined]);
      state.set(2, 3);
      await waitScheduler();
      expectSpy(spy, 2, [3]);
      expect(state.get(2)).toBe(3); // subscribe to 2
      state.delete(2);
      await waitScheduler();
      expectSpy(spy, 3, [undefined]);
      state.delete(2); // deleting again doesn't notify again
      await waitScheduler();
      expectSpy(spy, 3, [undefined]);
      state.set(2, 3);
      await waitScheduler();
      expectSpy(spy, 4, [3]);
      expect(state.get(2)).toBe(3); // subscribe to 2
      state.clear();
      await waitScheduler();
      expectSpy(spy, 5, [undefined]);
      expect(state.get(2)).toBeUndefined(); // subscribe to 2
      state.clear(); // clearing again doesn't notify again
      await waitScheduler();
      expectSpy(spy, 5, [undefined]);

      state.set(3, 4); // setting unobserved key doesn't notify
      await waitScheduler();
      expectSpy(spy, 5, [undefined]);
      expect(state.get(3)).toBe(4); // subscribe to 3
      state.set(3, 4); // setting the same value doesn't notify
      await waitScheduler();
      expectSpy(spy, 5, [undefined]);
      expect(state.get(4)).toBe(undefined); // subscribe to 4
      state.delete(4); // deleting observed key doesn't notify if key was already not present
      await waitScheduler();
      expectSpy(spy, 5, [undefined]);
    });

    test("getting values returns a reactive", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Map([[1, obj]]));
      const reactiveObj = state.get(1)!;
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      effect(() => spy(reactiveObj.a));
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating on values returns reactives", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Map([[1, obj]]));
      const reactiveObj = state.values().next().value!;
      effect(() => spy(reactiveObj.a));
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating on keys returns reactives", async () => {
      const obj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Map([[obj, 1]]));
      const reactiveObj = state.keys().next().value!;
      expect(reactiveObj).not.toBe(obj);
      expect(toRaw(reactiveObj as any)).toBe(obj);
      effect(() => spy(reactiveObj.a));
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });

    test("iterating on reactive map returns reactives", async () => {
      const keyObj = { a: 2 };
      const valObj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Map([[keyObj, valObj]]));
      const [reactiveKeyObj, reactiveValObj] = state[Symbol.iterator]().next().value!;
      effect(() => spy(reactiveKeyObj.a, reactiveValObj.a));
      expect(reactiveKeyObj).not.toBe(keyObj);
      expect(reactiveValObj).not.toBe(valObj);
      expect(toRaw(reactiveKeyObj as any)).toBe(keyObj);
      expect(toRaw(reactiveValObj as any)).toBe(valObj);
      expectSpy(spy, 1, [2, 2]);
      reactiveKeyObj.a = 0;
      reactiveValObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0, 0]);
      reactiveKeyObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1, 0]);
      reactiveValObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 4, [1, 1]);
      reactiveKeyObj.a = 1; // setting same value again shouldn't notify
      reactiveValObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 4, [1, 1]);
    });

    test("iterating on entries returns reactives", async () => {
      const keyObj = { a: 2 };
      const valObj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new Map([[keyObj, valObj]]));
      const [reactiveKeyObj, reactiveValObj] = state.entries().next().value!;
      effect(() => spy(reactiveKeyObj.a, reactiveValObj.a));
      expect(reactiveKeyObj).not.toBe(keyObj);
      expect(reactiveValObj).not.toBe(valObj);
      expect(toRaw(reactiveKeyObj as any)).toBe(keyObj);
      expect(toRaw(reactiveValObj as any)).toBe(valObj);
      expectSpy(spy, 1, [2, 2]);
      reactiveKeyObj.a = 0;
      reactiveValObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0, 0]);
      reactiveKeyObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1, 0]);
      reactiveValObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 4, [1, 1]);
      reactiveKeyObj.a = 1; // setting same value again shouldn't notify
      reactiveValObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 4, [1, 1]);
    });

    test("iterating with forEach returns reactives", async () => {
      const keyObj = { a: 2 };
      const valObj = { a: 2 };
      const thisArg = {};
      const spy = jest.fn();
      const state = reactive(new Map([[keyObj, valObj]]));
      let reactiveKeyObj: any, reactiveValObj: any, thisObj: any, mapObj: any;
      state.forEach(function (this: any, val, key, map) {
        [reactiveValObj, reactiveKeyObj, mapObj, thisObj] = [val, key, map, this];
      }, thisArg);
      expect(reactiveKeyObj).not.toBe(keyObj);
      expect(reactiveValObj).not.toBe(valObj);
      expect(mapObj).toBe(state); // third argument should be the reactive
      expect(thisObj).toBe(thisArg); // thisArg should not be made reactive
      expect(toRaw(reactiveKeyObj as any)).toBe(keyObj);
      expect(toRaw(reactiveValObj as any)).toBe(valObj);

      effect(() => spy(reactiveKeyObj.a, reactiveValObj.a));
      expectSpy(spy, 1, [2, 2]);

      reactiveKeyObj!.a = 0;
      reactiveValObj!.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0, 0]);

      reactiveKeyObj!.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1, 0]);

      reactiveValObj!.a = 1;
      await waitScheduler();
      expectSpy(spy, 4, [1, 1]);

      reactiveKeyObj!.a = 1; // setting same value again shouldn't notify
      reactiveValObj!.a = 1;
      await waitScheduler();
      expectSpy(spy, 4, [1, 1]);
    });
  });

  describe("WeakMap", () => {
    test("can make reactive WeakMap", () => {
      const map = new WeakMap();
      const obj = reactive(map);
      expect(obj).not.toBe(map);
    });

    test("can read", async () => {
      const obj = {};
      const obj2 = {};
      const state = reactive(new WeakMap([[obj, 0]]));
      expect(state.has(obj)).toBe(true);
      expect(state.has(obj2)).toBe(false);
      expect(state.get(obj)).toBe(0);
      expect(state.get(obj2)).toBeUndefined();
    });

    test("can add entries", () => {
      const obj = {};
      const state = reactive(new WeakMap());
      state.set(obj, 2);
      expect(state.has(obj)).toBe(true);
      expect(state.get(obj)).toBe(2);
    });

    test("can remove entries", () => {
      const obj = {};
      const state = reactive(new WeakMap([[obj, 2]]));
      state.delete(obj);
      expect(state.has(obj)).toBe(false);
      expect(state.get(obj)).toBeUndefined();
    });

    test("act like a WeakMap", () => {
      const obj = {};
      const state = reactive(new WeakMap([[obj, 2]]));
      expect(typeof state).toBe("object");
      expect(state).toBeInstanceOf(WeakMap);
    });

    test("checking for a key with 'has' subscribes the callback to changes to that key", async () => {
      const spy = jest.fn();
      const obj = {};
      const obj2 = {};
      const obj3 = {};
      const state = reactive(new WeakMap([[obj2, 2]]));

      effect(() => spy(state.has(obj)));

      expectSpy(spy, 1, [false]);
      state.set(obj, 3);
      await waitScheduler();
      expectSpy(spy, 2, [true]);
      expect(state.has(obj)).toBe(true); // subscribe to obj
      state.delete(obj);
      await waitScheduler();
      expectSpy(spy, 3, [false]);
      state.set(obj, 3);
      state.delete(obj);
      await waitScheduler();
      // todo: should be 3 or 4?
      expectSpy(spy, 4, [false]);
      expect(state.has(obj)).toBe(false); // subscribe to obj

      state.set(obj3, 4); // setting unobserved key doesn't notify
      await waitScheduler();
      expectSpy(spy, 4, [false]);
    });

    test("checking for a key with 'get' subscribes the callback to changes to that key", async () => {
      const spy = jest.fn();
      const obj = {};
      const obj2 = {};
      const obj3 = {};
      const state = reactive(new WeakMap([[obj2, 2]]));

      effect(() => spy(state.get(obj)));

      expectSpy(spy, 1, [undefined]);
      state.set(obj, 3);
      await waitScheduler();
      expectSpy(spy, 2, [3]);
      expect(state.get(obj)).toBe(3); // subscribe to obj
      state.delete(obj);
      await waitScheduler();
      expectSpy(spy, 3, [undefined]);
      state.set(obj, 3);
      state.delete(obj);
      await waitScheduler();
      expectSpy(spy, 4, [undefined]);
      expect(state.get(obj)).toBeUndefined(); // subscribe to obj

      state.set(obj3, 4); // setting unobserved key doesn't notify
      await waitScheduler();
      expectSpy(spy, 4, [undefined]);
    });

    test("getting values returns a reactive", async () => {
      const keyObj = {};
      const valObj = { a: 2 };
      const spy = jest.fn();
      const state = reactive(new WeakMap([[keyObj, valObj]]));
      const reactiveObj = state.get(keyObj)!;
      expect(reactiveObj).not.toBe(valObj);
      expect(toRaw(reactiveObj as any)).toBe(valObj);
      effect(() => spy(reactiveObj.a));
      expectSpy(spy, 1, [2]);
      reactiveObj.a = 0;
      await waitScheduler();
      expectSpy(spy, 2, [0]);
      reactiveObj.a = 1;
      await waitScheduler();
      expectSpy(spy, 3, [1]);
      reactiveObj.a = 1; // setting same value again shouldn't notify
      await waitScheduler();
      expectSpy(spy, 3, [1]);
    });
  });
});

describe("markRaw", () => {
  test("markRaw works as expected: value is not observed", async () => {
    const obj1: any = markRaw({ value: 1 });
    const obj2 = { value: 1 };
    const spy = jest.fn();
    const r = reactive({ obj1, obj2 });
    effect(() => spy(r.obj2.value));
    expectSpy(spy, 1, [1]);
    r.obj1.value = r.obj1.value + 1;
    await waitScheduler();
    expectSpy(spy, 1, [1]);
    r.obj2.value = r.obj2.value + 1;
    await waitScheduler();
    expectSpy(spy, 2, [2]);
    expect(r.obj1).toBe(obj1);
    expect(r.obj2).not.toBe(obj2);
  });
});

describe("toRaw", () => {
  test("toRaw works as expected", () => {
    const obj = { value: 1 };
    const reactiveObj = reactive(obj);
    expect(reactiveObj).not.toBe(obj);
    expect(toRaw(reactiveObj)).toBe(obj);
  });

  test("giving a non reactive to toRaw return the object itself", () => {
    const obj = { value: 1 };
    expect(toRaw(obj)).toBe(obj);
  });
});

describe("Reactivity: useState", () => {
  let fixture: HTMLElement;

  snapshotEverything();

  beforeEach(() => {
    fixture = makeTestFixture();
  });

  /**
   * A context can be defined as a reactive with a default observer.
   * It can be exposed and share by multiple components or other objects
   * (via useState for instance)
   */

  test("very simple use, with initial value", async () => {
    const testContext = createReactive({ value: 123 });

    class Comp extends Component {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useState(testContext);
    }
    await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
  });

  test("useContext=useState hook is reactive, for one component", async () => {
    const testContext = createReactive({ value: 123 });

    class Comp extends Component {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useState(testContext);
    }
    const comp = await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
    (comp as any).contextObj.value = 321;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>321</div>");
  });

  test("two components can subscribe to same context", async () => {
    const testContext = createReactive({ value: 123 });

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useState(testContext);
      setup() {
        useLogLifecycle();
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
    }
    await mount(Parent, fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Parent:setup",
          "Parent:willStart",
          "Parent:willRender",
          "Child:setup",
          "Child:willStart",
          "Child:setup",
          "Child:willStart",
          "Parent:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:mounted",
          "Child:mounted",
          "Parent:mounted",
        ]
      `);

    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.value = 321;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Child:willRender",
          "Child:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:willPatch",
          "Child:patched",
          "Child:willPatch",
          "Child:patched",
        ]
      `);
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("two components are updated in parallel", async () => {
    const testContext = createReactive({ value: 123 });

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useState(testContext);
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
    }

    await mount(Parent, fixture);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Parent:setup",
          "Parent:willStart",
          "Parent:willRender",
          "Child:setup",
          "Child:willStart",
          "Child:setup",
          "Child:willStart",
          "Parent:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:mounted",
          "Child:mounted",
          "Parent:mounted",
        ]
      `);

    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.value = 321;
    await nextMicroTick();
    await nextMicroTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Child:willRender",
          "Child:rendered",
          "Child:willRender",
          "Child:rendered",
        ]
      `);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");

    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Child:willPatch",
          "Child:patched",
          "Child:willPatch",
          "Child:patched",
        ]
      `);
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("two independent components on different levels are updated in parallel", async () => {
    const testContext = createReactive({ value: 123 });

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      static components = {};
      contextObj = useState(testContext);
      setup() {
        useLogLifecycle();
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /></div>`;
      static components = { Child };
      setup() {
        useLogLifecycle();
      }
    }

    class GrandFather extends Component {
      static template = xml`<div><Child /><Parent /></div>`;
      static components = { Child, Parent };
      setup() {
        useLogLifecycle();
      }
    }

    await mount(GrandFather, fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span><div><span>123</span></div></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "GrandFather:setup",
          "GrandFather:willStart",
          "GrandFather:willRender",
          "Child:setup",
          "Child:willStart",
          "Parent:setup",
          "Parent:willStart",
          "GrandFather:rendered",
          "Child:willRender",
          "Child:rendered",
          "Parent:willRender",
          "Child:setup",
          "Child:willStart",
          "Parent:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:mounted",
          "Parent:mounted",
          "Child:mounted",
          "GrandFather:mounted",
        ]
      `);

    testContext.value = 321;
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe("<div><span>123</span><div><span>123</span></div></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Child:willRender",
          "Child:rendered",
          "Child:willRender",
          "Child:rendered",
        ]
      `);

    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><div><span>321</span></div></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Child:willPatch",
          "Child:patched",
          "Child:willPatch",
          "Child:patched",
        ]
      `);
  });

  test("one components can subscribe twice to same context", async () => {
    const testContext = createReactive({ a: 1, b: 2 });
    const steps: string[] = [];

    class Comp extends Component {
      static template = xml`<div><t t-esc="contextObj1.a"/><t t-esc="contextObj2.b"/></div>`;
      contextObj1 = useState(testContext);
      contextObj2 = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.push("comp");
        });
      }
    }
    await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("<div>12</div>");
    expect(steps).toEqual(["comp"]);
    testContext.a = 3;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>32</div>");
    expect(steps).toEqual(["comp", "comp"]);
  });

  test("parent and children subscribed to same context", async () => {
    const testContext = createReactive({ a: 123, b: 321 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.push("child");
        });
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child /><t t-esc="contextObj.b"/></div>`;
      static components = { Child };
      contextObj = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.push("parent");
        });
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span>321</div>");
    expect(steps).toEqual(["parent", "child"]);

    (parent as any).contextObj.a = 124;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>124</span>321</div>");

    expect(steps).toEqual(["parent", "child", "child"]);
  });

  test.skip("several nodes on different level use same context", async () => {
    const testContext = createReactive({ a: 123, b: 456 });
    const steps: Set<string> = new Set();

    /**
     * Scheme:
     *         L1A
     *        /   \
     *      L2A   L2B
     *       |
     *      L3A
     */

    class L3A extends Component {
      static template = xml`<div><t t-esc="contextObj.a"/> <t t-esc="contextObj.b"/></div>`;
      contextObj = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.add("L3A");
        });
      }
    }

    class L2B extends Component {
      static template = xml`<div><t t-esc="contextObj.b"/></div>`;
      contextObj = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.add("L2B");
        });
      }
    }

    class L2A extends Component {
      static template = xml`<div><t t-esc="contextObj.a"/><L3A /></div>`;
      static components = { L3A };
      contextObj = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.add("L2A");
        });
      }
    }

    class L1A extends Component {
      static template = xml`<div><L2A /><L2B /></div>`;
      static components = { L2A, L2B };
      contextObj = useState(testContext);
      setup() {
        onWillRender(() => {
          steps.add("L1A");
        });
      }
    }

    await mount(L1A, fixture);
    expect(fixture.innerHTML).toBe("<div><div>123<div>123 456</div></div><div>456</div></div>");
    expect([...steps]).toEqual(["L1A", "L2A", "L2B", "L3A"]);
    steps.clear();

    testContext.a = 321;
    await nextMicroTick();
    await nextMicroTick();
    expect([...steps]).toEqual(["L2A"]);
    await nextTick();
    expect([...steps]).toEqual(["L2A", "L3A"]);
    expect(fixture.innerHTML).toBe("<div><div>321<div>321 456</div></div><div>456</div></div>");
    steps.clear();

    testContext.b = 654;
    await nextMicroTick();
    await nextMicroTick();
    expect([...steps]).toEqual(["L2B", "L3A"]);
    await nextTick();
    expect([...steps]).toEqual(["L2B", "L3A"]);
    expect(fixture.innerHTML).toBe("<div><div>321<div>321 654</div></div><div>654</div></div>");
    steps.clear();

    testContext.a = 777;
    testContext.b = 777;
    await nextMicroTick();
    await nextMicroTick();
    expect([...steps]).toEqual(["L2A", "L2B"]);
    await nextTick();
    expect([...steps]).toEqual(["L2A", "L2B", "L3A"]);
    expect(fixture.innerHTML).toBe("<div><div>777<div>777 777</div></div><div>777</div></div>");
    steps.clear();

    testContext.c = 444;
    await nextMicroTick();
    await nextMicroTick();
    expect([...steps]).toEqual(["L1A"]);
    await nextTick();
    expect([...steps]).toEqual(["L1A", "L2A", "L2B", "L3A"]);
  });

  test("destroyed component is inactive", async () => {
    const testContext = createReactive({ a: 123 });

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useState(testContext);
      setup() {
        useLogLifecycle();
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
      setup() {
        useLogLifecycle();
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Parent:setup",
          "Parent:willStart",
          "Parent:willRender",
          "Child:setup",
          "Child:willStart",
          "Parent:rendered",
          "Child:willRender",
          "Child:rendered",
          "Child:mounted",
          "Parent:mounted",
        ]
      `);

    testContext.a = 321;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Child:willRender",
          "Child:rendered",
          "Child:willPatch",
          "Child:patched",
        ]
      `);

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
        Array [
          "Parent:willRender",
          "Parent:rendered",
          "Parent:willPatch",
          "Child:willUnmount",
          "Child:willDestroy",
          "Parent:patched",
        ]
      `);

    testContext.a = 456;
    await nextTick();
    expect(steps.splice(0)).toMatchInlineSnapshot(`Array []`);
  });

  test("destroyed component before being mounted is inactive", async () => {
    const testContext = createReactive({ a: 123 });
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onWillStart(() => {
          return makeDeferred();
        });
        onWillRender(() => {
          steps.push("child");
        });
      }
    }
    let parent: any;
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
      setup() {
        parent = this;
      }
    }

    const prom = mount(Parent, fixture); // cannot work
    await nextTick(); // wait for Child to be instantiated
    testContext.a = 321;
    await nextMicroTick();
    parent.state.flag = false;
    await prom;
    expect(fixture.innerHTML).toBe("<div></div>");
    testContext.a = 456;
    await nextMicroTick();
    expect(steps).toEqual([]);
  });

  test("useless atoms should be deleted", async () => {
    const testContext = createReactive({
      1: { id: 1, quantity: 3, description: "First quantity" },
      2: { id: 2, quantity: 5, description: "Second quantity" },
    });

    const secondQuantity = testContext[2];

    const steps: Set<string> = new Set();

    class Quantity extends Component {
      static template = xml`<div><t t-esc="state.quantity"/></div>`;
      state = useState(testContext[this.props.id]);

      setup() {
        onWillRender(() => {
          steps.add(`quantity${this.props.id}`);
        });
      }
    }

    class ListOfQuantities extends Component {
      static template = xml`
          <div>
            <t t-foreach="Object.keys(state)" t-as="id" t-key="id">
              <Quantity id="id"/>
            </t>
            Total: <t t-esc="total"/>
            Count: <t t-esc="Object.keys(state).length"/>
          </div>`;
      static components = { Quantity };
      state = useState(testContext);

      setup() {
        onWillRender(() => {
          steps.add("list");
        });
      }

      get total() {
        let total = 0;
        for (const { quantity } of Object.values(this.state) as any) {
          total += quantity;
        }
        return total;
      }
    }

    await mount(ListOfQuantities, fixture);
    expect(fixture.innerHTML).toBe("<div><div>3</div><div>5</div> Total: 8 Count: 2</div>");
    expect([...steps]).toEqual(["list", "quantity1", "quantity2"]);
    steps.clear();

    delete testContext[2];
    await nextMicroTick();
    await nextMicroTick();
    expect([...steps]).toEqual(["list"]);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>3</div> Total: 3 Count: 1</div>");
    expect([...steps]).toEqual(["list"]);
    steps.clear();

    secondQuantity.quantity = 2;
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe("<div><div>3</div> Total: 3 Count: 1</div>");
    expect([...steps]).toEqual([]);
    steps.clear();
  });

  test.skip("concurrent renderings", async () => {
    /**
     * Note: this test is interesting, but sadly just an incomplete attempt at
     * protecting users against themselves.  With the context API, it is not
     * possible for the framework to protect completely against crashes.  Maybe
     * like in this case, when a component is in a simple hierarchy where all
     * renderings come from the context changes, but in a real case, where some
     * code can trigger a rendering independently, it is insufficient.
     *
     * The main problem is that the sub component depends on some external state,
     * which may be modified, and then incompatible with the component actual
     * state (for example, if the sub component has an id key related to some
     * object that has been removed from the context).
     *
     * For now, sadly, the only solution is that components that depends on external
     * state should guarantee their own integrity themselves. Then maybe this
     * could be solved at the level of a state management solution that has a
     * more advanced API, to let components determine if they should be updated
     * or not (so, something slightly more advanced that the useStore hook).
     */
    const testContext = createReactive({ x: { n: 1 }, key: "x" });
    const def = makeDeferred();
    let stateC: any;
    class ComponentC extends Component {
      static template = xml`<span><t t-esc="context[props.key].n"/><t t-esc="state.x"/></span>`;
      context = useState(testContext);
      state = useState({ x: "a" });
      setup() {
        stateC = this.state;
      }
    }
    class ComponentB extends Component {
      static components = { ComponentC };
      static template = xml`<p><ComponentC key="props.key"/></p>`;
      setup() {
        onWillUpdateProps(() => def);
      }
    }
    class ComponentA extends Component {
      static components = { ComponentB };
      static template = xml`<div><ComponentB key="context.key"/></div>`;
      context = useState(testContext);
    }

    await mount(ComponentA, fixture);

    expect(fixture.innerHTML).toBe("<div><p><span>1a</span></p></div>");
    testContext.key = "y";
    testContext.y = { n: 2 };
    delete testContext.x;
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><p><span>1a</span></p></div>");
    stateC.x = "b";
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><p><span>1a</span></p></div>");
    def.resolve();
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><p><span>2b</span></p></div>");
  });
});
describe("reactive list operation", () => {
  test("Map over an array and only track the necessary items", async () => {
    const r = reactive(["a", "b", "c", "d", "e", "f"]);
    const mapSpy = jest.fn((item) => item.toUpperCase());
    const newMap = reactiveMap(r, mapSpy);
    const e1 = spyEffect(() => newMap());
    e1();
    // expectSpy(e1.spy, 1, [["A", "B", "C", "D", "E", "F"]]);
    expect(e1.spy).toHaveBeenCalledTimes(1);
    expect(e1.spy).toHaveReturnedWith(["A", "B", "C", "D", "E", "F"]);
    expect(mapSpy).toBeCalledTimes(6);
    mapSpy.mockClear();
    r.push("g");
    await waitScheduler();
    expect(e1.spy).toHaveBeenCalledTimes(2);
    expect(e1.spy).toHaveReturnedWith(["A", "B", "C", "D", "E", "F", "G"]);
    expect(mapSpy).toBeCalledTimes(1);
    expect(mapSpy).toBeCalledWith("g", 6);
    mapSpy.mockClear();

    // const m = changesMap;

    // r.splice(2, 2, "C", "D");
    // r.shift();
    // r.pop();
  });
});
