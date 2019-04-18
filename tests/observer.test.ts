import { Observer } from "../src/observer";
import { nextMicroTick } from "./helpers";

describe("observer", () => {
  test("properly observe objects", () => {
    const observer = new Observer();
    const obj: any = {};

    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    const ob2: any = { a: 1 };
    observer.observe(ob2);
    expect(ob2.__owl__.rev).toBe(1);
    ob2.a = 2;
    expect(observer.rev).toBe(2);
    expect(ob2.__owl__.rev).toBe(2);

    ob2.b = 3;
    expect(observer.rev).toBe(2);
    expect(ob2.__owl__.rev).toBe(2);

    observer.set(ob2, "b", 4);
    expect(observer.rev).toBe(3);
    expect(ob2.__owl__.rev).toBe(3);
  });

  test("properly handle null or undefined", () => {
    const observer = new Observer();
    const obj: any = { a: null, b: undefined };

    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    obj.a = 3;
    expect(obj.__owl__.rev).toBe(2);

    obj.b = 5;
    expect(obj.__owl__.rev).toBe(3);

    obj.a = null;
    obj.b = undefined;
    expect(obj.__owl__.rev).toBe(5);
  });

  test("can change values in array", () => {
    const observer = new Observer();
    const obj: any = { arr: [1, 2] };

    observer.observe(obj);
    expect(obj.arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    obj.arr[0] = "nope";
    expect(obj.arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);

    observer.set(obj.arr, 0, "yep");
    expect(obj.arr.__owl__.rev).toBe(2);
    expect(observer.rev).toBe(2);
  });

  test("various object property changes", () => {
    const observer = new Observer();
    const obj: any = { a: 1 };
    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    obj.a = 2;
    expect(observer.rev).toBe(2);
    expect(obj.__owl__.rev).toBe(2);

    // same value again
    obj.a = 2;
    expect(observer.rev).toBe(2);
    expect(obj.__owl__.rev).toBe(2);

    obj.a = 3;
    expect(observer.rev).toBe(3);
    expect(obj.__owl__.rev).toBe(3);
  });

  test("properly observe arrays", () => {
    const observer = new Observer();
    const arr: any = [];
    observer.observe(arr);
    expect(arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);
    expect(arr.length).toBe(0);

    arr.push(1);
    expect(arr.__owl__.rev).toBe(2);
    expect(observer.rev).toBe(2);
    expect(arr.length).toBe(1);

    arr.splice(1, 0, "hey");
    expect(arr.__owl__.rev).toBe(3);
    expect(observer.rev).toBe(3);
    expect(arr.length).toBe(2);

    arr.unshift("lindemans");
    expect(arr.__owl__.rev).toBe(4);

    arr.reverse();
    expect(arr.__owl__.rev).toBe(5);

    arr.pop();
    expect(arr.__owl__.rev).toBe(6);

    arr.shift();
    expect(arr.__owl__.rev).toBe(7);

    arr.sort();
    expect(arr.__owl__.rev).toBe(8);

    expect(arr).toEqual([1]);
  });

  test("object pushed into arrays are observed", () => {
    const observer = new Observer();
    const arr: any = [];
    observer.observe(arr);
    expect(observer.rev).toBe(1);

    arr.push({ kriek: 5 });
    expect(observer.rev).toBe(2);
    expect(arr.__owl__.rev).toBe(2);
    expect(arr[0].__owl__.rev).toBe(1);

    arr[0].kriek = 6;
    expect(observer.rev).toBe(3);
    expect(arr.__owl__.rev).toBe(2);
    expect(arr[0].__owl__.rev).toBe(2);
  });

  test("properly observe arrays in object", () => {
    const observer = new Observer();
    const state: any = { arr: [] };
    observer.observe(state);
    expect(state.arr.__owl__.rev).toBe(1);
    expect(observer.rev).toBe(1);
    expect(state.arr.length).toBe(0);

    state.arr.push(1);
    expect(state.arr.__owl__.rev).toBe(2);
    expect(observer.rev).toBe(2);
    expect(state.arr.length).toBe(1);
  });

  test("properly observe objects in array", () => {
    const observer = new Observer();
    const state: any = { arr: [{ something: 1 }] };
    observer.observe(state);
    expect(state.arr.__owl__.rev).toBe(1);
    expect(state.arr[0].__owl__.rev).toBe(1);

    state.arr[0].something = 2;
    expect(state.arr.__owl__.rev).toBe(1);
    expect(state.arr[0].__owl__.rev).toBe(2);
  });

  test("properly observe objects in object", () => {
    const observer = new Observer();
    const state: any = { a: { b: 1 } };
    observer.observe(state);
    expect(state.__owl__.rev).toBe(1);
    expect(state.a.__owl__.rev).toBe(1);

    state.a.b = 2;
    expect(state.__owl__.rev).toBe(1);
    expect(state.a.__owl__.rev).toBe(2);
  });

  test("reobserve new object values", () => {
    const observer = new Observer();
    const obj: any = { a: 1 };
    observer.observe(obj);
    expect(obj.__owl__.rev).toBe(1);
    obj.a = { b: 2 };
    expect(observer.rev).toBe(2);
    expect(obj.__owl__.rev).toBe(2);
    expect(obj.a.__owl__.rev).toBe(1);

    obj.a.b = 3;
    expect(observer.rev).toBe(3);
    expect(obj.__owl__.rev).toBe(2);
    expect(obj.a.__owl__.rev).toBe(2);
  });

  test("deep observe misc changes", () => {
    const observer = new Observer();
    const state: any = { o: { a: 1 }, arr: [1], n: 13 };
    observer.observe(state);
    expect(state.__owl__.rev).toBe(1);
    expect(state.__owl__.deepRev).toBe(1);

    state.o.a = 2;
    expect(observer.rev).toBe(2);
    expect(state.__owl__.rev).toBe(1);
    expect(state.__owl__.deepRev).toBe(2);

    state.arr.push(2);
    expect(state.__owl__.rev).toBe(1);
    expect(state.__owl__.deepRev).toBe(3);

    state.n = 155;
    expect(state.__owl__.rev).toBe(2);
    expect(state.__owl__.deepRev).toBe(4);
  });

  test("properly handle already observed state", () => {
    const observer = new Observer();
    const obj1: any = { a: 1 };
    const obj2: any = { b: 1 };
    observer.observe(obj1);
    observer.observe(obj2);
    expect(obj1.__owl__.rev).toBe(1);
    expect(obj2.__owl__.rev).toBe(1);

    obj1.a = 2;
    obj2.b = 3;
    expect(obj1.__owl__.rev).toBe(2);
    expect(obj2.__owl__.rev).toBe(2);

    obj2.b = obj1;
    expect(obj1.__owl__.rev).toBe(2);
    expect(obj2.__owl__.rev).toBe(3);
  });

  test("properly handle swapping elements", () => {
    const observer = new Observer();
    const obj: any = { a: { arr: [] }, b: 1 };
    observer.observe(obj);

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
    const obj: any = { a: { arr: [], val: "test" } };
    observer.observe(obj);

    obj.a = { ...obj.a, val: "test2" };
    expect(observer.rev).toBe(2);

    // push something into array to make sure it works
    obj.a.arr.push("blanche");
    expect(observer.rev).toBe(3);
  });

  test("accept cycles in observed state", () => {
    const observer = new Observer();
    const obj1: any = {};
    const obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    observer.observe(obj1);
    expect(obj1.__owl__.rev).toBe(1);
    expect(obj2.__owl__.rev).toBe(1);

    obj2.key = 3;
    expect(obj1.__owl__.rev).toBe(1);
    expect(obj2.__owl__.rev).toBe(2);
  });

  test("call callback when state is changed", async () => {
    const observer = new Observer();
    observer.notifyCB = jest.fn();
    const obj: any = { a: 1, b: { c: 2 }, d: [{ e: 3 }], f: 4 };

    observer.observe(obj);
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
    expect(observer.notifyCB).toBeCalledTimes(4);
  });

  test("throw error when state is mutated in object if allowMutation=false", async () => {
    const observer = new Observer();
    observer.allowMutations = false;
    const obj: any = { a: 1 };
    observer.observe(obj);

    expect(() => {
      obj.a = 2;
    }).toThrow('Observed state cannot be changed here! (key: "a", val: "2")');
  });

  test("throw error when state is mutated in array if allowMutation=false", async () => {
    const observer = new Observer();
    observer.allowMutations = false;
    const obj: any = { a: [1] };
    observer.observe(obj);

    expect(() => {
      obj.a.push(2);
    }).toThrow("Array cannot be changed here");
  });
});
