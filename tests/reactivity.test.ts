import { Component, mount, onRender, onWillStart, onWillUpdateProps, useState } from "../src";
import { atom, registerObserver } from "../src/reactivity";
import { xml } from "../src/tags";
import {
  makeDeferred,
  makeTestFixture,
  nextMicroTick,
  nextTick,
  snapshotEverything,
} from "./helpers";

function createAtom(value: any, observer?: any) {
  observer = observer || (() => {});
  registerObserver(observer);
  return atom(value, observer);
}

describe("Reactivity: atom", () => {
  test("can read", async () => {
    const atom1 = createAtom({ a: 1 });
    expect(atom1.a).toBe(1);
  });

  test("can write", () => {
    const atom1 = createAtom({});
    atom1.a = 1;
    expect(atom1.a).toBe(1);
  });

  test("can update", () => {
    const atom1 = createAtom({ a: 1 });
    atom1.a = 2;
    expect(atom1.a).toBe(2);
  });

  test("can delete", () => {
    const atom1 = createAtom({ a: 1 });
    delete atom1.a;
    expect(atom1.a).toBeUndefined();
  });

  test("act like an object", () => {
    const atom1 = createAtom({ a: 1 });
    expect(Object.keys(atom1)).toEqual(["a"]);
    expect(Object.values(atom1)).toEqual([1]);
    expect(typeof atom1).toBe("object");
  });

  test("act like an array", () => {
    const atom1 = createAtom(["a", "b"]);
    expect(atom1.length).toBe(2);
    expect(atom1).toEqual(["a", "b"]);
    expect(typeof atom1).toBe("object");
    expect(Array.isArray(atom1)).toBe(true);
  });

  test("return value if not proxifiable", () => {
    const atom1 = createAtom(1);
    expect(atom1).toBe(1);
  });

  test("return value if observer is not registered", () => {
    const obj = { a: 1 };
    const atom1 = atom(obj, () => {});
    expect(atom1).toBe(obj);
  });

  test("atom observer is called properly", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++);
    atom1.a = 2;
    await nextMicroTick();
    expect(n).toBe(0); // key has not be read yet
    atom1.a = atom1.a + 5; // key is read and then modified
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("atom observer is called after batch of operation", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1, b: 2 }, () => n++);
    atom1.a = 2;
    expect(n).toBe(0);
    await nextMicroTick();
    expect(n).toBe(0); // key has not be read yet
    atom1.a = atom1.a + 5; // key is read and then modified
    expect(n).toBe(0);
    atom1.b = atom1.b + 5; // key is read and then modified
    expect(n).toBe(0);
    await nextMicroTick();
    expect(n).toBe(1); // two operations but only one notification
  });

  test("setting property to same value does not trigger callback", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++);
    atom1.a = atom1.a + 5; // read and modifies property a to have value 6
    await nextMicroTick();
    expect(n).toBe(1);
    atom1.a = 6; // same value
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("observe cycles", async () => {
    const a = { a: {} };
    a.a = a;

    let n = 0;
    const atom1 = createAtom(a, () => n++);

    atom1.k = 2;
    await nextMicroTick();
    expect(n).toBe(1);

    delete atom1.l;
    await nextMicroTick();
    expect(n).toBe(1);

    delete atom1.k;
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.a = 1;
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.a = atom1.a + 5;
    await nextMicroTick();
    expect(n).toBe(3);
  });

  test("two observers for same source", async () => {
    let m = 0;
    let n = 0;
    const obj = { a: 1 } as any;
    const atom1 = createAtom(obj, () => m++);
    const atom2 = createAtom(obj, () => n++);

    obj.new = 2;
    await nextMicroTick();
    expect(m).toBe(0);
    expect(n).toBe(0);

    atom1.new = 2; // already exists!
    await nextMicroTick();
    expect(m).toBe(0);
    expect(n).toBe(0);

    atom1.veryNew = 2;
    await nextMicroTick();
    expect(m).toBe(1);
    expect(n).toBe(1);

    atom1.a = atom1.a + 5;
    await nextMicroTick();
    expect(m).toBe(2);
    expect(n).toBe(1);

    atom2.a = atom2.a + 5;
    await nextMicroTick();
    expect(m).toBe(3);
    expect(n).toBe(2);

    delete atom2.veryNew;
    await nextMicroTick();
    expect(m).toBe(4);
    expect(n).toBe(3);
  });

  test("create atom from another atom", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 });
    const atom2 = createAtom(atom1, () => n++);
    atom2.a = atom2.a + 5;
    await nextMicroTick();
    expect(n).toBe(1);
    atom1.a = 2;
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("create atom from another atom 2", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 });
    const atom2 = createAtom(atom1, () => n++);
    atom1.a = atom2.a + 5;
    await nextMicroTick();
    expect(n).toBe(1);

    atom2.a = atom2.a + 5;
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("create atom from another atom 3", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 });
    const atom2 = createAtom(atom1, () => n++);
    atom1.a = atom1.a + 5;
    await nextMicroTick();
    expect(n).toBe(0); // atom2.a was not yet read
    atom2.a = atom2.a + 5;
    await nextMicroTick();
    expect(n).toBe(1); // atom2.a has been read and is now observed
    atom1.a = atom1.a + 5;
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("immediately returns primitive values", () => {
    expect(createAtom(1)).toBe(1);
    expect(createAtom("asf")).toBe("asf");
    expect(createAtom(true)).toBe(true);
    expect(createAtom(null)).toBe(null);
    expect(createAtom(undefined)).toBe(undefined);
  });

  test("immediately returns dates", () => {
    const date = new Date();
    expect(createAtom(date)).toBe(date);
  });

  test("can observe object with some key set to null", async () => {
    let n = 0;
    const atom1 = createAtom({ a: { b: null } } as any, () => n++);
    expect(n).toBe(0);
    atom1.a.b = Boolean(atom1.a.b);
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("can reobserve object with some key set to null", async () => {
    let n = 0;
    const fn = () => n++;
    const unregisterObserver = registerObserver(fn);
    const atom1 = createAtom({ a: { b: null } } as any, fn);
    const atom2 = createAtom(atom1, fn);
    expect(atom2).toBe(atom1);
    expect(atom2).toEqual(atom1);
    await nextMicroTick();
    expect(n).toBe(0);
    atom1.a.b = Boolean(atom1.a.b);
    await nextMicroTick();
    expect(n).toBe(1);
    unregisterObserver();
    atom1.a.b = !atom1.a.b;
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("contains initial values", () => {
    const atom1 = createAtom({ a: 1, b: 2 });
    expect(atom1.a).toBe(1);
    expect(atom1.b).toBe(2);
    expect((atom1 as any).c).toBeUndefined();
  });

  test("detect object value changes", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a = atom1.a + 5;
    await nextMicroTick();
    expect(n).toBe(1);

    atom1.b = atom1.b + 5;
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.a = null;
    atom1.b = undefined;
    await nextMicroTick();
    expect(n).toBe(3);
    expect(atom1).toEqual({ a: null, b: undefined });
  });

  test("properly handle dates", async () => {
    const date = new Date();
    let n = 0;
    const atom1 = createAtom({ date }, () => n++);

    await nextMicroTick();
    expect(typeof atom1.date.getFullYear()).toBe("number");
    expect(atom1.date).toBe(date);

    atom1.date = new Date();
    await nextMicroTick();
    expect(n).toBe(1);
    expect(atom1.date).not.toBe(date);
  });

  test("properly handle promise", async () => {
    let resolved = false;
    const prom = new Promise((r) => r());
    let n = 0;
    const atom1 = createAtom({ prom }, () => n++);

    expect(atom1.prom).toBeInstanceOf(Promise);
    atom1.prom.then(() => (resolved = true));
    expect(n).toBe(0);
    expect(resolved).toBe(false);
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(n).toBe(0);
  });

  test("can observe value change in array in an object", async () => {
    let n = 0;
    const atom1 = createAtom({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(atom1.arr)).toBe(true);
    expect(n).toBe(0);

    atom1.arr[0] = atom1.arr[0] + "nope";
    await nextMicroTick();

    expect(n).toBe(1);
    expect(atom1.arr[0]).toBe("1nope");
    expect(atom1.arr).toEqual(["1nope", 2]);
  });

  test("can observe: changing array in object to another array", async () => {
    let n = 0;
    const atom1 = createAtom({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(atom1.arr)).toBe(true);
    expect(n).toBe(0);

    atom1.arr = [2, 1];
    await nextMicroTick();

    expect(n).toBe(1);
    expect(atom1.arr[0]).toBe(2);
    expect(atom1.arr).toEqual([2, 1]);
  });

  test("getting twice an object properties return same object", () => {
    const atom1 = createAtom({ a: { b: 1 } });
    const a1 = atom1.a;
    const a2 = atom1.a;
    expect(a1).toBe(a2);
  });

  test("various object property changes", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a = atom1.a + 2;
    await nextMicroTick();
    expect(n).toBe(1);

    // same value again
    atom1.a = 3;
    await nextMicroTick();
    expect(n).toBe(1);

    atom1.a = 4;
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("properly observe arrays", async () => {
    let n = 0;
    const atom1 = createAtom([], () => n++) as any;

    expect(Array.isArray(atom1)).toBe(true);
    expect(atom1.length).toBe(0);
    expect(n).toBe(0);

    atom1.push(1);
    await nextMicroTick();
    expect(n).toBe(1);
    expect(atom1.length).toBe(1);
    expect(atom1).toEqual([1]);

    atom1.splice(1, 0, "hey");
    await nextMicroTick();
    expect(n).toBe(2);
    expect(atom1).toEqual([1, "hey"]);
    expect(atom1.length).toBe(2);

    atom1.unshift("lindemans");
    await nextMicroTick();
    //it generates 3 primitive operations
    expect(n).toBe(3);
    expect(atom1).toEqual(["lindemans", 1, "hey"]);
    expect(atom1.length).toBe(3);

    atom1.reverse();
    await nextMicroTick();
    //it generates 2 primitive operations
    expect(n).toBe(4);
    expect(atom1).toEqual(["hey", 1, "lindemans"]);
    expect(atom1.length).toBe(3);

    atom1.pop(); // one set, one delete
    await nextMicroTick();
    expect(n).toBe(5);
    expect(atom1).toEqual(["hey", 1]);
    expect(atom1.length).toBe(2);

    atom1.shift(); // 2 sets, 1 delete
    await nextMicroTick();
    expect(n).toBe(6);
    expect(atom1).toEqual([1]);
    expect(atom1.length).toBe(1);
  });

  test("object pushed into arrays are observed", async () => {
    let n = 0;
    const arr: any = createAtom([], () => n++);

    arr.push({ kriek: 5 });
    await nextMicroTick();
    expect(n).toBe(1);

    arr[0].kriek = 6;
    await nextMicroTick();
    expect(n).toBe(1);

    arr[0].kriek = arr[0].kriek + 6;
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("set new property on observed object", async () => {
    let n = 0;
    const atom1 = createAtom({}, () => n++) as any;
    expect(n).toBe(0);

    atom1.b = 8;
    await nextMicroTick();
    expect(n).toBe(1);
    expect(atom1.b).toBe(8);
  });

  test("delete property from observed object", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1, b: 8 }, () => n++) as any;
    expect(n).toBe(0);

    delete atom1.b;
    await nextMicroTick();
    expect(n).toBe(1);
    expect(atom1).toEqual({ a: 1 });
  });

  test("delete property from observed object 2", async () => {
    let n = 0;
    const observer = () => n++;
    const obj = { a: { b: 1 } };
    const atom1 = createAtom(obj.a, observer) as any;
    const atom2 = createAtom(obj, observer) as any;
    expect(n).toBe(0);

    delete atom2.a;
    await nextMicroTick();
    // key "a" is no longer observed
    expect(n).toBe(1);

    atom1.new = 2; // but { b: 1 } is still observed!
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("set element in observed array", async () => {
    let n = 0;
    const arr = createAtom(["a"], () => n++);

    arr[1] = "b";
    await nextMicroTick();
    expect(n).toBe(1);
    expect(arr).toEqual(["a", "b"]);
  });

  test("properly observe arrays in object", async () => {
    let n = 0;
    const atom1 = createAtom({ arr: [] }, () => n++) as any;

    expect(atom1.arr.length).toBe(0);
    expect(n).toBe(0);

    atom1.arr.push(1);
    await nextMicroTick();
    expect(n).toBe(1);
    expect(atom1.arr.length).toBe(1);
  });

  test("properly observe objects in array", async () => {
    let n = 0;
    const atom1 = createAtom({ arr: [{ something: 1 }] }, () => n++) as any;
    expect(n).toBe(0);

    atom1.arr[0].something = atom1.arr[0].something + 1;
    await nextMicroTick();
    expect(n).toBe(1);
    expect(atom1.arr[0].something).toBe(2);
  });

  test("properly observe objects in object", async () => {
    let n = 0;
    const atom1 = createAtom({ a: { b: 1 } }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a.b = atom1.a.b + 2;
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("reobserve new object values", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a++;
    await nextMicroTick();
    expect(n).toBe(1);

    atom1.a = { b: 2 };
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.a.b = atom1.a.b + 3;
    await nextMicroTick();
    expect(n).toBe(3);
  });

  test("deep observe misc changes", async () => {
    let n = 0;
    const atom1 = createAtom({ o: { a: 1 }, arr: [1], n: 13 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.o.a = atom1.o.a + 2;
    await nextMicroTick();
    expect(n).toBe(1);

    atom1.arr.push(2);
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.n = 155;
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.n = atom1.n + 1;
    await nextMicroTick();
    expect(n).toBe(3);
  });

  test("properly handle already observed atom", async () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = createAtom({ a: 1 }, () => n1++) as any;
    const obj2 = createAtom({ b: 1 }, () => n2++) as any;

    obj1.a = obj1.a + 2;
    obj2.b = obj2.b + 3;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj2.b = obj1;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(2);

    obj1.a = 33;
    await nextMicroTick();
    expect(n1).toBe(2);
    expect(n2).toBe(2);

    obj2.b.a = obj2.b.a + 2;
    await nextMicroTick();
    expect(n1).toBe(3);
    expect(n2).toBe(3);
  });

  test("properly handle already observed atom in observed atom", async () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = createAtom({ a: { c: 2 } }, () => n1++) as any;
    const obj2 = createAtom({ b: 1 }, () => n2++) as any;

    obj2.c = obj1;
    await nextMicroTick();
    expect(n1).toBe(0);
    expect(n2).toBe(1);

    obj1.a.c = obj1.a.c + 33;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj2.c.a.c = obj2.c.a.c + 3;
    await nextMicroTick();
    expect(n1).toBe(2);
    expect(n2).toBe(2);
  });

  test("can reobserve object", async () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: 0 }, () => n1++) as any;

    atom1.a = atom1.a + 1;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    const atom2 = createAtom(atom1, () => n2++) as any;
    expect(atom1).toEqual(atom2);

    atom2.a = 2;
    await nextMicroTick();
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("can reobserve nested properties in object", async () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: [{ b: 1 }] }, () => n1++) as any;

    const atom2 = createAtom(atom1, () => n2++) as any;

    atom1.a[0].b = atom1.a[0].b + 2;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    atom2.c = 2;
    await nextMicroTick();
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("rereading some property again give exactly same result", () => {
    const atom1 = createAtom({ a: { b: 1 } });
    const obj1 = atom1.a;
    const obj2 = atom1.a;
    expect(obj1).toBe(obj2);
  });

  test("can reobserve new properties in object", async () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: [{ b: 1 }] }, () => n1++) as any;

    createAtom(atom1, () => n2++) as any;

    atom1.a[0].b = { c: 1 };
    await nextMicroTick();
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    atom1.a[0].b.c = atom1.a[0].b.c + 2;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(0);
  });

  test("can observe sub property of observed object", async () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: { b: 1 }, c: 1 }, () => n1++) as any;

    const atom2 = createAtom(atom1.a, () => n2++) as any;

    atom1.a.b = atom1.a.b + 2;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    atom1.l = 2;
    await nextMicroTick();
    expect(n1).toBe(2);
    expect(n2).toBe(0);

    atom1.a.k = 3;
    await nextMicroTick();
    expect(n1).toBe(3);
    expect(n2).toBe(1);

    atom1.c = 14;
    await nextMicroTick();
    expect(n1).toBe(3);
    expect(n2).toBe(1);

    atom2.b = atom2.b + 3;
    await nextMicroTick();
    expect(n1).toBe(4);
    expect(n2).toBe(2);
  });

  test("can set a property more than once", async () => {
    let n = 0;
    const atom1 = createAtom({}, () => n++) as any;

    atom1.aky = atom1.aku;
    expect(n).toBe(0);
    atom1.aku = "always finds annoying problems";
    expect(n).toBe(0);
    await nextMicroTick();
    expect(n).toBe(1);

    atom1.aku = "always finds good problems";
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("properly handle swapping elements", async () => {
    let n = 0;
    const atom1 = createAtom({ a: { arr: [] }, b: 1 }, () => n++) as any;

    // swap a and b
    const b = atom1.b;
    atom1.b = atom1.a;
    atom1.a = b;
    await nextMicroTick();
    expect(n).toBe(1);

    // push something into array to make sure it works
    atom1.b.arr.push("blanche");
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("properly handle assigning observed atom containing array", async () => {
    let n = 0;
    const atom1 = createAtom({ a: { arr: [], val: "test" } }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a = { ...atom1.a, val: "test2" };
    await nextMicroTick();
    expect(n).toBe(1);

    // push something into array to make sure it works
    atom1.a.arr.push("blanche");
    await nextMicroTick();
    expect(n).toBe(2);
  });

  test("accept cycles in observed atom", async () => {
    let n = 0;
    let obj1: any = {};
    let obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    obj1 = createAtom(obj1, () => n++) as any;
    obj2 = obj1.a;
    await nextMicroTick();
    expect(n).toBe(0);

    obj1.key = 3;
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("call callback when atom is changed", async () => {
    let n = 0;
    const atom1: any = createAtom({ a: 1, b: { c: 2 }, d: [{ e: 3 }], f: 4 }, () => n++);
    expect(n).toBe(0);

    atom1.a = atom1.a + 2;
    await nextMicroTick();
    expect(n).toBe(1);

    atom1.b.c = atom1.b.c + 3;
    await nextMicroTick();
    expect(n).toBe(2);

    atom1.d[0].e = atom1.d[0].e + 5;
    await nextMicroTick();
    expect(n).toBe(3);

    atom1.a = 111;
    atom1.f = 222;
    await nextMicroTick();
    expect(n).toBe(4);
  });

  test("can unobserve a value", async () => {
    let n = 0;
    const cb = () => n++;
    const unregisterObserver = registerObserver(cb);

    const atom1 = createAtom({ a: 1 }, cb);

    atom1.a = atom1.a + 3;
    await nextMicroTick();
    expect(n).toBe(1);

    unregisterObserver();

    atom1.a = 4;
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("observing some observed atom", async () => {
    let n1 = 0;
    let n2 = 0;
    const inner = createAtom({ a: 1 }, () => n1++);
    const outer = createAtom({ b: inner }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    outer.b.a = outer.b.a + 2;
    await nextMicroTick();
    expect(n1).toBe(0);
    expect(n2).toBe(1);
  });

  test("observing some observed atom, variant", async () => {
    let n1 = 0;
    let n2 = 0;
    const inner = createAtom({ a: 1 }, () => n1++);
    const outer = createAtom({ b: inner, c: 0 }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    inner.a = inner.a + 2;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    outer.c = outer.c + 3;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(1);
  });

  test("observing some observed atom, variant 2", async () => {
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;
    const obj1 = createAtom({ a: 1 }, () => n1++);
    const obj2 = createAtom({ b: {} }, () => n2++);
    const obj3 = createAtom({ c: {} }, () => n3++);

    obj2.b = obj2.b;
    obj3.c = obj3.c;
    await nextMicroTick();
    expect(n1).toBe(0);
    expect(n2).toBe(1);
    expect(n3).toBe(1);

    obj2.b = obj1;
    obj3.c = obj1;
    await nextMicroTick();
    expect(n1).toBe(0);
    expect(n2).toBe(2);
    expect(n3).toBe(2);

    obj1.a = obj1.a + 2;
    await nextMicroTick();
    expect(n1).toBe(1);
    expect(n2).toBe(2);
    expect(n3).toBe(2);

    obj2.b.a = obj2.b.a + 1;
    await nextMicroTick();
    expect(n1).toBe(2);
    expect(n2).toBe(3);
    expect(n3).toBe(2);
  });

  test("notification is not done after unregistration", async () => {
    let n = 0;
    const observer = () => n++;
    const unregisterObserver = registerObserver(observer);
    const state = atom({ a: 1 }, observer);

    state.a = state.a;
    await nextMicroTick();
    expect(n).toBe(0);

    unregisterObserver();

    state.a = { b: 2 };
    await nextMicroTick();
    expect(n).toBe(0);

    state.a.b = state.a.b + 3;
    await nextMicroTick();
    expect(n).toBe(0);
  });
});

describe("Reactivity: useState", () => {
  let fixture: HTMLElement;

  snapshotEverything();

  beforeEach(() => {
    fixture = makeTestFixture();
  });

  /**
   * A context can be defined as an atom with a default observer.
   * It can be exposed and share by multiple components or other objects
   * (via useState for instance)
   */

  test("very simple use, with initial value", async () => {
    const testContext = createAtom({ value: 123 });

    class Comp extends Component {
      static template = xml`<div><t t-esc="contextObj.value"/></div>`;
      contextObj = useState(testContext);
    }
    await mount(Comp, fixture);
    expect(fixture.innerHTML).toBe("<div>123</div>");
  });

  test("useContext=useState hook is reactive, for one component", async () => {
    const testContext = createAtom({ value: 123 });

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
    const testContext = createAtom({ value: 123 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
          steps.push("child");
        });
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
      setup() {
        onRender(() => {
          steps.push("parent");
        });
      }
    }
    await mount(Parent, fixture);
    expect(steps).toEqual(["parent", "child", "child"]);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.value = 321;
    await nextTick();
    expect(steps).toEqual(["parent", "child", "child", "child", "child"]);
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("two components are updated in parallel", async () => {
    const testContext = createAtom({ value: 123 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onRender(async () => {
          steps.push("render");
        });
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /><Child /></div>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(steps).toEqual(["render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.value = 321;
    await nextMicroTick();
    await nextMicroTick();
    expect(steps).toEqual(["render", "render", "render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><span>321</span></div>");
  });

  test("two independent components on different levels are updated in parallel", async () => {
    const testContext = createAtom({ value: 123 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.value"/></span>`;
      static components = {};
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
          steps.push("render");
        });
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child /></div>`;
      static components = { Child };
    }

    class GrandFather extends Component {
      static template = xml`<div><Child /><Parent /></div>`;
      static components = { Child, Parent };
    }

    await mount(GrandFather, fixture);

    expect(fixture.innerHTML).toBe("<div><span>123</span><div><span>123</span></div></div>");
    expect(steps).toEqual(["render", "render"]);

    testContext.value = 321;

    await nextMicroTick();
    await nextMicroTick();
    expect(steps).toEqual(["render", "render", "render", "render"]);
    expect(fixture.innerHTML).toBe("<div><span>123</span><div><span>123</span></div></div>");

    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><div><span>321</span></div></div>");
  });

  test("one components can subscribe twice to same context", async () => {
    const testContext = createAtom({ a: 1, b: 2 });
    const steps: string[] = [];

    class Comp extends Component {
      static template = xml`<div><t t-esc="contextObj1.a"/><t t-esc="contextObj2.b"/></div>`;
      contextObj1 = useState(testContext);
      contextObj2 = useState(testContext);
      setup() {
        onRender(() => {
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
    const testContext = createAtom({ a: 123, b: 321 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
          steps.push("child");
        });
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child /><t t-esc="contextObj.b"/></div>`;
      static components = { Child };
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
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

  test("several nodes on different level use same context", async () => {
    const testContext = createAtom({ a: 123, b: 456 });
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
        onRender(() => {
          steps.add("L3A");
        });
      }
    }

    class L2B extends Component {
      static template = xml`<div><t t-esc="contextObj.b"/></div>`;
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
          steps.add("L2B");
        });
      }
    }

    class L2A extends Component {
      static template = xml`<div><t t-esc="contextObj.a"/><L3A /></div>`;
      static components = { L3A };
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
          steps.add("L2A");
        });
      }
    }

    class L1A extends Component {
      static template = xml`<div><L2A /><L2B /></div>`;
      static components = { L2A, L2B };
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
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
    const testContext = createAtom({ a: 123 });
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onRender(() => {
          steps.push("child");
        });
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
      setup() {
        onRender(() => {
          steps.push("parent");
        });
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>123</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    testContext.a = 321;
    await nextTick();
    expect(steps).toEqual(["parent", "child", "child"]);

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual(["parent", "child", "child", "parent"]);

    testContext.a = 456;
    await nextTick();
    expect(steps).toEqual(["parent", "child", "child", "parent"]);
  });

  test("destroyed component before being mounted is inactive", async () => {
    const testContext = createAtom({ a: 123 });
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`<span><t t-esc="contextObj.a"/></span>`;
      contextObj = useState(testContext);
      setup() {
        onWillStart(() => {
          return makeDeferred();
        });
        onRender(() => {
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
    const testContext = createAtom({
      1: { id: 1, quantity: 3, description: "First quantity" },
      2: { id: 2, quantity: 5, description: "Second quantity" },
    });

    const secondQuantity = testContext[2];

    const steps: Set<string> = new Set();

    class Quantity extends Component {
      static template = xml`<div><t t-esc="state.quantity"/></div>`;
      state = useState(testContext[this.props.id]);

      setup() {
        onRender(() => {
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
        onRender(() => {
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
    expect([...steps]).toEqual(["list", "quantity1"]);
    steps.clear();

    // secondQuantity is no longer accessible by List! But list react to changes
    // --> this prooff that a useless atom continues to exist
    secondQuantity.quantity = 2;
    await nextMicroTick();
    await nextMicroTick();

    expect(fixture.innerHTML).toBe("<div><div>3</div> Total: 3 Count: 1</div>");
    expect([...steps]).toEqual(["list"]); // should be avoided!!!
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
    const testContext = createAtom({ x: { n: 1 }, key: "x" });
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
