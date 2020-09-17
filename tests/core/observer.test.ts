import { Observer } from "../../src/core/observer";
import { nextMicroTick } from "../helpers";

describe("observer", () => {
  test("properly observe objects", () => {
    const observer = new Observer();
    const obj: any = observer.observe({});

    expect(typeof obj).toBe("object");
    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.rev).toBe(1);

    const obj2: any = observer.observe({ a: 1 });
    expect(observer.revNumber(obj2)).toBe(1);
    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.rev).toBe(1);

    obj2.a = 2;

    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.revNumber(obj2)).toBe(2);
    expect(observer.rev).toBe(2);

    expect(obj2).toEqual({
      a: 2,
    });
  });

  test("properly handle null or undefined", () => {
    const observer = new Observer();
    const obj: any = observer.observe({ a: null, b: undefined });

    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.rev).toBe(1);

    obj.a = 3;
    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.rev).toBe(2);

    obj.b = 5;
    expect(observer.revNumber(obj)).toBe(3);
    expect(observer.rev).toBe(3);

    obj.a = null;
    obj.b = undefined;
    expect(observer.revNumber(obj)).toBe(5);
    expect(observer.rev).toBe(5);
    expect(obj).toEqual({
      a: null,
      b: undefined,
    });
  });

  test("properly handle dates", () => {
    const observer = new Observer();
    const date = new Date();
    const obj: any = observer.observe({ date });

    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.rev).toBe(1);
    expect(typeof obj.date.getFullYear()).toBe("number");
    expect(obj.date).toBe(date);

    obj.date = new Date();

    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.rev).toBe(2);
    expect(obj.date).not.toBe(date);
  });

  test("properly handle promises (i.e.: treat them like primitive values", async () => {
    const observer = new Observer();
    let resolved = false;
    const prom = new Promise((r) => r());
    const obj: any = observer.observe({ prom });
    expect(obj.prom).toBeInstanceOf(Promise);

    obj.prom.then(() => (resolved = true));

    expect(observer.revNumber(obj)).toBe(1);

    expect(resolved).toBe(false);
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(observer.revNumber(obj)).toBe(1);
  });

  test("can change values in array", () => {
    const observer = new Observer();
    const obj: any = observer.observe({ arr: [1, 2] });

    expect(Array.isArray(obj.arr)).toBe(true);
    expect(observer.revNumber(obj.arr)).toBe(1);
    expect(observer.rev).toBe(1);

    obj.arr[0] = "nope";
    expect(observer.revNumber(obj.arr)).toBe(2);
    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.rev).toBe(2);
  });

  test("various object property changes", () => {
    const observer = new Observer();
    const obj: any = observer.observe({ a: 1 });

    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.rev).toBe(1);

    obj.a = 2;

    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.rev).toBe(2);

    // same value again
    obj.a = 2;
    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.rev).toBe(2);

    obj.a = 3;
    expect(observer.revNumber(obj)).toBe(3);
    expect(observer.rev).toBe(3);
  });

  test("properly observe arrays", () => {
    const observer = new Observer();
    const arr: any = observer.observe([]);

    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(0);
    expect(observer.revNumber(arr)).toBe(1);
    expect(observer.rev).toBe(1);

    arr.push(1);
    expect(observer.revNumber(arr)).toBe(2);
    expect(observer.rev).toBe(2);
    expect(arr.length).toBe(1);
    expect(arr).toEqual([1]);

    arr.splice(1, 0, "hey");
    expect(observer.revNumber(arr)).toBe(3);
    expect(observer.rev).toBe(3);
    expect(arr).toEqual([1, "hey"]);
    expect(arr.length).toBe(2);

    arr.unshift("lindemans");
    //it generates 3 primitive operations
    expect(observer.revNumber(arr)).toBe(6);
    expect(observer.rev).toBe(6);
    expect(arr).toEqual(["lindemans", 1, "hey"]);
    expect(arr.length).toBe(3);

    arr.reverse();
    //it generates 2 primitive operations
    expect(observer.revNumber(arr)).toBe(8);
    expect(observer.rev).toBe(8);
    expect(arr).toEqual(["hey", 1, "lindemans"]);
    expect(arr.length).toBe(3);

    arr.pop(); // one set, one delete
    expect(observer.revNumber(arr)).toBe(10);
    expect(observer.rev).toBe(10);
    expect(arr).toEqual(["hey", 1]);
    expect(arr.length).toBe(2);

    arr.shift(); // 2 sets, 1 delete
    expect(observer.revNumber(arr)).toBe(13);
    expect(observer.rev).toBe(13);
    expect(arr).toEqual([1]);
    expect(arr.length).toBe(1);
  });

  test("object pushed into arrays are observed", () => {
    const observer = new Observer();
    const arr: any = observer.observe([]);
    expect(observer.rev).toBe(1);

    arr.push({ kriek: 5 });
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(arr)).toBe(2);
    expect(observer.revNumber(arr[0])).toBe(2);

    arr[0].kriek = 6;

    expect(observer.rev).toBe(3);
    expect(observer.revNumber(arr)).toBe(3);
    expect(observer.revNumber(arr[0])).toBe(3);
  });

  test("set new property on observed object", async () => {
    const observer = new Observer();
    observer.notifyCB = jest.fn();
    const state: any = observer.observe({ a: 1 });
    expect(observer.notifyCB).toBeCalledTimes(0);
    expect(observer.rev).toBe(1);
    expect(observer.revNumber(state)).toBe(1);

    state.b = 8;

    await nextMicroTick();

    expect(observer.notifyCB).toBeCalledTimes(1);
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state)).toBe(2);

    expect(state.b).toBe(8);
  });

  test("delete property from observed object", async () => {
    const observer = new Observer();
    observer.notifyCB = jest.fn();
    const state: any = observer.observe({ a: 1, b: 8 });
    observer.observe(state);

    expect(observer.notifyCB).toBeCalledTimes(0);
    expect(observer.rev).toBe(1);
    expect(observer.revNumber(state)).toBe(1);

    delete state.b;
    await nextMicroTick();

    expect(observer.notifyCB).toBeCalledTimes(1);
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state)).toBe(2);

    expect(state).toEqual({ a: 1 });
  });

  test("set element in observed array", async () => {
    const observer = new Observer();
    observer.notifyCB = jest.fn();
    const state: any = observer.observe(["a"]);

    expect(observer.rev).toBe(1);
    expect(observer.revNumber(state)).toBe(1);
    expect(observer.notifyCB).toBeCalledTimes(0);

    state[1] = "b";

    await nextMicroTick();

    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state)).toBe(2);
    expect(observer.notifyCB).toBeCalledTimes(1);

    expect(state).toEqual(["a", "b"]);
  });

  test("properly observe arrays in object", () => {
    const observer = new Observer();
    const state: any = observer.observe({ arr: [] });

    expect(observer.rev).toBe(1);
    expect(observer.revNumber(state.arr)).toBe(1);
    expect(state.arr.length).toBe(0);

    state.arr.push(1);
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state.arr)).toBe(2);
    expect(state.arr.length).toBe(1);
  });

  test("properly observe objects in array", () => {
    const observer = new Observer();
    const state: any = observer.observe({ arr: [{ something: 1 }] });
    observer.observe(state);

    expect(observer.rev).toBe(1);
    expect(observer.revNumber(state.arr)).toBe(1);
    expect(observer.revNumber(state.arr[0])).toBe(1);

    state.arr[0].something = 2;
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state.arr)).toBe(2);
    expect(observer.revNumber(state.arr[0])).toBe(2);
  });

  test("properly observe objects in object", () => {
    const observer = new Observer();
    const state: any = observer.observe({ a: { b: 1 } });

    expect(observer.rev).toBe(1);
    expect(observer.revNumber(state)).toBe(1);
    expect(observer.revNumber(state.a)).toBe(1);

    state.a.b = 2;
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state)).toBe(2);
    expect(observer.revNumber(state.a)).toBe(2);
  });

  test("reobserve new object values", () => {
    const observer = new Observer();
    const obj: any = observer.observe({ a: 1 });

    expect(observer.rev).toBe(1);
    expect(observer.revNumber(obj)).toBe(1);

    obj.a = { b: 2 };

    expect(observer.rev).toBe(2);
    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.revNumber(obj.a)).toBe(2);
    obj.a.b = 3;
    expect(observer.rev).toBe(3);
    expect(observer.revNumber(obj)).toBe(3);
    expect(observer.revNumber(obj.a)).toBe(3);
  });

  test("deep observe misc changes", () => {
    const observer = new Observer();
    const state: any = observer.observe({ o: { a: 1 }, arr: [1], n: 13 });
    expect(observer.revNumber(state)).toBe(1);

    state.o.a = 2;
    expect(observer.rev).toBe(2);
    expect(observer.revNumber(state)).toBe(2);

    state.arr.push(2);
    expect(observer.rev).toBe(3);
    expect(observer.revNumber(state)).toBe(3);

    state.n = 155;
    expect(observer.rev).toBe(4);
    expect(observer.revNumber(state)).toBe(4);
  });

  test("properly handle already observed state", () => {
    const observer = new Observer();
    const obj1: any = observer.observe({ a: 1 });
    const obj2: any = observer.observe({ b: 1 });

    expect(observer.revNumber(obj1)).toBe(1);
    expect(observer.revNumber(obj2)).toBe(1);

    obj1.a = 2;
    obj2.b = 3;
    expect(observer.revNumber(obj1)).toBe(2);
    expect(observer.revNumber(obj2)).toBe(2);

    obj2.b = obj1;
    expect(observer.revNumber(obj1)).toBe(2);
    expect(observer.revNumber(obj2)).toBe(3);
  });

  test("can set a property more than once", () => {
    const observer = new Observer();
    const obj: any = observer.observe({});

    expect(observer.revNumber(obj)).toBe(1);
    expect(observer.rev).toBe(1);

    obj.aku = "always finds annoying problems";
    expect(observer.revNumber(obj)).toBe(2);
    expect(observer.rev).toBe(2);

    obj.aku = "always finds good problems";

    expect(observer.revNumber(obj)).toBe(3);
    expect(observer.rev).toBe(3);
  });

  test("properly handle swapping elements", () => {
    const observer = new Observer();
    const obj: any = observer.observe({ a: { arr: [] }, b: 1 });

    // swap a and b
    const b = obj.b;
    obj.b = obj.a;
    obj.a = b;
    expect(observer.rev).toBe(3);

    // push something into array to make sure it works
    obj.b.arr.push("blanche");
    expect(observer.rev).toBe(4);
  });

  test("properly handle assigning observed obj containing array", () => {
    const observer = new Observer();
    const obj: any = observer.observe({ a: { arr: [], val: "test" } });

    expect(observer.rev).toBe(1);
    obj.a = { ...obj.a, val: "test2" };
    expect(observer.rev).toBe(2);

    // push something into array to make sure it works
    obj.a.arr.push("blanche");
    expect(observer.rev).toBe(3);
  });

  test("accept cycles in observed state", () => {
    const observer = new Observer();
    let obj1: any = {};
    let obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    obj1 = observer.observe(obj1);
    obj2 = obj1.a;

    expect(observer.revNumber(obj1)).toBe(1);
    expect(observer.revNumber(obj2)).toBe(1);

    obj2.key = 3;
    expect(observer.revNumber(obj1)).toBe(2);
    expect(observer.revNumber(obj2)).toBe(2);
  });

  test("call callback when state is changed", async () => {
    const observer = new Observer();
    observer.notifyCB = jest.fn();
    const obj: any = observer.observe({ a: 1, b: { c: 2 }, d: [{ e: 3 }], f: 4 });

    expect(observer.notifyCB).toBeCalledTimes(0);

    obj.a = 2;
    await nextMicroTick();
    expect(observer.notifyCB).toBeCalledTimes(1);

    obj.b.c = 3;
    await nextMicroTick();
    expect(observer.notifyCB).toBeCalledTimes(2);

    obj.d[0].e = 5;
    await nextMicroTick();
    expect(observer.notifyCB).toBeCalledTimes(3);

    obj.a = 111;
    obj.f = 222;
    await nextMicroTick();
    expect(observer.notifyCB).toBeCalledTimes(5);
  });

  test("throw error when state is mutated in object if allowMutation=false", async () => {
    const observer = new Observer();
    observer.allowMutations = false;
    const obj: any = observer.observe({ a: 1 });
    expect(() => {
      obj.a = 2;
    }).toThrow('Observed state cannot be changed here! (key: "a", val: "2")');
  });

  test("throw error when state is mutated in array if allowMutation=false", async () => {
    const observer = new Observer();
    observer.allowMutations = false;
    const obj: any = observer.observe({ a: [1] });

    expect(() => {
      obj.a.push(2);
    }).toThrow('Observed state cannot be changed here! (key: "1", val: "2")');
  });
});
