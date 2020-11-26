import { observe, unobserve } from "../src/reactivity";

describe("observe", () => {
  test("basic properties", () => {
    let n = 0;
    const obj = observe({} as any, () => n++);
    expect(typeof obj).toBe("object");
    expect(n).toBe(0);

    obj.a = 3;
    expect(n).toBe(1);
    expect(obj.a).toBe(3);
    expect(n).toBe(1);
  });

  test("setting property to same value does not trigger callback", () => {
    let n = 0;
    const obj = observe({} as any, () => n++);

    obj.a = 3;
    obj.a = 3;
    expect(n).toBe(1);
  });

  test("immediately returns primitive values", () => {
    expect(observe(1, () => {})).toBe(1);
    expect(observe("asf", () => {})).toBe("asf");
    expect(observe(true, () => {})).toBe(true);
    expect(observe(null, () => {})).toBe(null);
    expect(observe(undefined, () => {})).toBe(undefined);
  });

  test("immediately returns dates", () => {
    const d = new Date();
    expect(observe(d, () => {})).toBe(d);
  });

  test("can observe object with some key set to null", () => {
    let n = 0;
    const obj = observe({ a: { b: null } } as any, () => n++);

    expect(n).toBe(0);
    obj.a.b = 3;
    expect(n).toBe(1);
  });

  test("can reobserve object with some key set to null", () => {
    let n = 0;
    const fn = () => n++;
    const obj = observe({ a: { b: null } } as any, fn);
    const obj2 = observe(obj, fn);
    expect(obj2).toBe(obj);
    expect(n).toBe(0);
    obj.a.b = 3;
    expect(n).toBe(1);
    unobserve(obj, fn);
    obj.a.b = 5;
    expect(n).toBe(1);
  });

  test("contains initial values", () => {
    const obj = observe({ a: 1, b: 2 }, () => {});
    expect(obj.a).toBe(1);
    expect(obj.b).toBe(2);
    expect((obj as any).c).toBe(undefined);
  });

  test("detect object value changes", () => {
    let n = 0;
    const obj = observe({ a: 1 }, () => n++) as any;

    expect(n).toBe(0);
    obj.a = 3;
    expect(n).toBe(1);

    obj.b = 5;
    expect(n).toBe(2);

    obj.a = null;
    obj.b = undefined;
    expect(n).toBe(4);
    expect(obj).toEqual({ a: null, b: undefined });
  });

  test("properly handle dates", () => {
    const date = new Date();
    let n = 0;
    const obj = observe({ date }, () => n++);

    expect(typeof obj.date.getFullYear()).toBe("number");
    expect(obj.date).toBe(date);
    obj.date = new Date();
    expect(n).toBe(1);
    expect(obj.date).not.toBe(date);
  });

  test("properly handle promise", async () => {
    let resolved = false;
    const prom = new Promise((r) => r());
    let n = 0;
    const obj = observe({ prom }, () => n++);

    expect(obj.prom).toBeInstanceOf(Promise);
    obj.prom.then(() => (resolved = true));
    expect(n).toBe(0);
    expect(resolved).toBe(false);
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(n).toBe(0);
  });

  test("can observe value change in array in an object", () => {
    let n = 0;
    const obj = observe({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(obj.arr)).toBe(true);
    expect(n).toBe(0);

    obj.arr[0] = "nope";

    expect(n).toBe(1);
    expect(obj.arr[0]).toBe("nope");
    expect(obj.arr).toEqual(["nope", 2]);
  });

  test("can observe: changing array in object to another array", () => {
    let n = 0;
    const obj = observe({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(obj.arr)).toBe(true);
    expect(n).toBe(0);

    obj.arr = [2, 1];

    expect(n).toBe(1);
    expect(obj.arr[0]).toBe(2);
    expect(obj.arr).toEqual([2, 1]);
  });

  test("getting twice an object properties return same object", () => {
    const obj = observe({ a: { b: 1 } }, () => {});

    const a1 = obj.a;
    const a2 = obj.a;
    expect(a1).toBe(a2);
  });

  test("various object property changes", () => {
    let n = 0;
    const obj = observe({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    obj.a = 2;
    expect(n).toBe(1);

    // same value again
    obj.a = 2;
    expect(n).toBe(1);

    obj.a = 3;
    expect(n).toBe(2);
  });

  test("properly observe arrays", () => {
    let n = 0;
    const arr = observe([], () => n++) as any;

    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(0);
    expect(n).toBe(0);

    arr.push(1);
    expect(n).toBe(1);
    expect(arr.length).toBe(1);
    expect(arr).toEqual([1]);

    arr.splice(1, 0, "hey");
    expect(n).toBe(2);
    expect(arr).toEqual([1, "hey"]);
    expect(arr.length).toBe(2);

    arr.unshift("lindemans");
    //it generates 3 primitive operations
    expect(n).toBe(5);
    expect(arr).toEqual(["lindemans", 1, "hey"]);
    expect(arr.length).toBe(3);

    arr.reverse();
    //it generates 2 primitive operations
    expect(n).toBe(7);
    expect(arr).toEqual(["hey", 1, "lindemans"]);
    expect(arr.length).toBe(3);

    arr.pop(); // one set, one delete
    expect(n).toBe(9);
    expect(arr).toEqual(["hey", 1]);
    expect(arr.length).toBe(2);

    arr.shift(); // 2 sets, 1 delete
    expect(n).toBe(12);
    expect(arr).toEqual([1]);
    expect(arr.length).toBe(1);
  });

  test("object pushed into arrays are observed", () => {
    let n = 0;
    const arr: any = observe([], () => n++);

    arr.push({ kriek: 5 });
    expect(n).toBe(1);

    arr[0].kriek = 6;

    expect(n).toBe(2);
  });

  test("set new property on observed object", async () => {
    let n = 0;
    const state = observe({}, () => n++) as any;

    expect(n).toBe(0);
    state.b = 8;

    expect(n).toBe(1);
    expect(state.b).toBe(8);
  });

  test("delete property from observed object", async () => {
    let n = 0;
    const obj = observe({ a: 1, b: 8 }, () => n++) as any;
    expect(n).toBe(0);

    delete obj.b;
    expect(n).toBe(1);
    expect(obj).toEqual({ a: 1 });
  });

  test("set element in observed array", async () => {
    let n = 0;
    const arr = observe(["a"], () => n++);

    arr[1] = "b";
    expect(n).toBe(1);
    expect(arr).toEqual(["a", "b"]);
  });

  test("properly observe arrays in object", () => {
    let n = 0;
    const obj = observe({ arr: [] }, () => n++) as any;

    expect(obj.arr.length).toBe(0);

    obj.arr.push(1);
    expect(n).toBe(1);
    expect(obj.arr.length).toBe(1);
  });

  test("properly observe objects in array", () => {
    let n = 0;
    const obj = observe({ arr: [{ something: 1 }] }, () => n++) as any;
    expect(n).toBe(0);

    obj.arr[0].something = 2;
    expect(n).toBe(1);
    expect(obj.arr[0].something).toBe(2);
  });

  test("properly observe objects in object", () => {
    let n = 0;
    const obj = observe({ a: { b: 1 } }, () => n++) as any;
    expect(n).toBe(0);

    obj.a.b = 2;
    expect(n).toBe(1);
  });

  test("reobserve new object values", () => {
    let n = 0;
    const obj = observe({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    obj.a = { b: 2 };
    expect(n).toBe(1);

    obj.a.b = 3;
    expect(n).toBe(2);
  });

  test("deep observe misc changes", () => {
    let n = 0;
    const obj = observe({ o: { a: 1 }, arr: [1], n: 13 }, () => n++) as any;
    expect(n).toBe(0);

    obj.o.a = 2;
    expect(n).toBe(1);

    obj.arr.push(2);
    expect(n).toBe(2);

    obj.n = 155;
    expect(n).toBe(3);
  });

  test("properly handle already observed state", () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = observe({ a: 1 }, () => n1++) as any;
    const obj2 = observe({ b: 1 }, () => n2++) as any;

    obj1.a = 2;
    obj2.b = 3;
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj2.b = obj1;
    expect(n1).toBe(1);
    expect(n2).toBe(2);

    obj1.a = 33;
    expect(n1).toBe(2);
    expect(n2).toBe(3);
  });

  test("properly handle already observed state in observed state", () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = observe({ a: { c: 2 } }, () => n1++) as any;
    const obj2 = observe({ b: 1 }, () => n2++) as any;

    obj2.c = obj1;
    expect(n1).toBe(0);
    expect(n2).toBe(1);

    obj1.a.c = 33;
    expect(n1).toBe(1);
    expect(n2).toBe(2);
  });

  test("can reobserve object", () => {
    let n1 = 0;
    let n2 = 0;
    const obj = observe({ a: 0 }, () => n1++) as any;
    obj.a = 1;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    const obj2 = observe(obj, () => n2++) as any;
    expect(obj).toBe(obj2);

    obj.a = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("can reobserve nested properties in object", () => {
    let n1 = 0;
    let n2 = 0;
    const obj = observe({ a: [{ b: 1 }] }, () => n1++) as any;

    observe(obj, () => n2++) as any;

    obj.a[0].b = 2;
    expect(n1).toBe(1);
    expect(n2).toBe(1);
  });

  test("can reobserve new properties in object", () => {
    let n1 = 0;
    let n2 = 0;
    const obj = observe({ a: [{ b: 1 }] }, () => n1++) as any;

    observe(obj, () => n2++) as any;

    obj.a[0].b = { c: 1 };
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj.a[0].b.c = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(2);
  });

  test("can observe sub property of observed object", () => {
    let n1 = 0;
    let n2 = 0;
    const obj = observe({ a: { b: 1 }, c: 1 }, () => n1++) as any;

    observe(obj.a, () => n2++) as any;

    obj.a.b = 2;
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj.c = 14;
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("can set a property more than once", () => {
    let n = 0;
    const obj = observe({}, () => n++) as any;

    obj.aku = "always finds annoying problems";
    expect(n).toBe(1);

    obj.aku = "always finds good problems";
    expect(n).toBe(2);
  });

  test("properly handle swapping elements", () => {
    let n = 0;
    const obj = observe({ a: { arr: [] }, b: 1 }, () => n++) as any;

    // swap a and b
    const b = obj.b;
    obj.b = obj.a;
    obj.a = b;
    expect(n).toBe(2);

    // push something into array to make sure it works
    obj.b.arr.push("blanche");
    expect(n).toBe(3);
  });

  test("properly handle assigning observed obj containing array", () => {
    let n = 0;
    const obj = observe({ a: { arr: [], val: "test" } }, () => n++) as any;

    expect(n).toBe(0);
    obj.a = { ...obj.a, val: "test2" };
    expect(n).toBe(1);

    // push something into array to make sure it works
    obj.a.arr.push("blanche");
    expect(n).toBe(2);
  });

  test("accept cycles in observed state", () => {
    let n = 0;
    let obj1: any = {};
    let obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    obj1 = observe(obj1, () => n++) as any;
    obj2 = obj1.a;
    expect(n).toBe(0);

    obj2.key = 3;
    expect(n).toBe(1);
  });
});

describe("unobserve", () => {
  test("can unobserve a value", () => {
    let n = 0;
    const cb = () => n++;
    const obj = observe({ a: 1 }, cb);

    obj.a = 3;
    expect(n).toBe(1);
    unobserve(obj, cb);
    obj.a = 4;
    expect(n).toBe(1);
  });

  test("can 'unobserve' primitive values, and dates", () => {
    unobserve(null, () => {});
    unobserve(undefined, () => {});
    unobserve(false, () => {});
    unobserve("iroh", () => {});
    unobserve(32, () => {});
    unobserve(new Date(), () => {});
  });

  test("rereading some property again give exactly same result", () => {
    const obj = observe({ a: { b: 1 } }, () => {});
    const obj1 = obj.a;
    const obj2 = obj.a;
    expect(obj1).toBe(obj2);
  });

  test("observing some observed state", () => {
    let n1 = 0;
    let n2 = 0;
    const inner = observe({ a: 1 }, () => n1++);
    const outer = observe({ b: inner }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);
    outer.b.a = 2;
    expect(n1).toBe(1);
    expect(n2).toBe(1);
  });

  test.skip("observing some observed state, variant", () => {
    let n1 = 0;
    let n2 = 0;
    const inner = observe({ a: 1 }, () => n1++);
    const outer = observe({ b: inner, c: 0 }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);
    inner.a = 2;
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    outer.c = 3;
    expect(n1).toBe(1);
    expect(n2).toBe(2);
  });
});

// note: does not work!!!
// if we have
// obj1 = {a:1}
// obj2 = {b: obj1}
// obj3 = {c: obj1}
// modifying obj1 => should call cb for obj2 and obj3
