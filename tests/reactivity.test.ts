import { atom, registerObserver } from "../src/reactivity";

function createAtom(atom1: any, observer?: any) {
  observer = observer || (() => {});
  registerObserver(observer);
  return atom(atom1, observer);
}

describe("getAtom", () => {
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

  test("atom observer is called properly", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++);
    atom1.a = 2;
    expect(n).toBe(0); // key has not be read yet.
    atom1.a = atom1.a + 5; // key is read and then modified
    expect(n).toBe(1);
  });

  test("setting property to same value does not trigger callback", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++);
    atom1.a = atom1.a + 5; // read and modifies property a to have value 6
    expect(n).toBe(1);
    atom1.a = 6; // same value
    expect(n).toBe(1);
  });

  test("observe cycles", () => {
    const a = { b: {} };
    a.b = a;

    let n = 0;
    const atom1 = createAtom(a, () => n++);

    atom1.k = 2;
    expect(n).toBe(1);

    delete atom1.l;
    expect(n).toBe(1);

    delete atom1.k;
    expect(n).toBe(2);

    atom1.b = 1;
    expect(n).toBe(2);

    atom1.b = atom1.b + 5;
    expect(n).toBe(3);
  });

  test("two observers for same source", () => {
    let m = 0;
    let n = 0;
    const obj = { a: 1 } as any;
    const atom1 = createAtom(obj, () => m++);
    const atom2 = createAtom(obj, () => n++);

    obj.new = 2;
    expect(m).toBe(0);
    expect(n).toBe(0);

    atom1.new = 2; // already exists!
    expect(m).toBe(0);
    expect(n).toBe(0);

    atom1.veryNew = 2;
    expect(m).toBe(1);
    expect(n).toBe(1);

    atom1.a = atom1.a + 5;
    expect(m).toBe(2);
    expect(n).toBe(1);

    atom2.a = atom2.a + 5;
    expect(m).toBe(3);
    expect(n).toBe(2);

    delete atom2.veryNew;
    expect(m).toBe(4);
    expect(n).toBe(3);
  });

  test("create atom from another atom", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 });
    const atom2 = createAtom(atom1, () => n++);
    atom2.a = atom2.a + 5;
    expect(n).toBe(1);
    atom1.a = 2;
    expect(n).toBe(2);
  });

  test("create atom from another atom 2", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 });
    const atom2 = createAtom(atom1, () => n++);
    atom1.a = atom2.a + 5;
    expect(n).toBe(1);

    atom2.a = atom2.a + 5;
    expect(n).toBe(2);
  });

  test("create atom from another atom 3", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 });
    const atom2 = createAtom(atom1, () => n++);
    atom1.a = atom1.a + 5;
    expect(n).toBe(0); // atom2.a was not yet read
    atom2.a = atom2.a + 5;
    expect(n).toBe(1); // atom2.a has been read and is now observed
    atom1.a = atom1.a + 5;
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

  test("can observe object with some key set to null", () => {
    let n = 0;
    const atom1 = createAtom({ a: { b: null } } as any, () => n++);
    expect(n).toBe(0);
    atom1.a.b = Boolean(atom1.a.b);
    expect(n).toBe(1);
  });

  test("can reobserve object with some key set to null", () => {
    let n = 0;
    const fn = () => n++;
    const unregisterObserver = registerObserver(fn);
    const atom1 = createAtom({ a: { b: null } } as any, fn);
    const atom2 = createAtom(atom1, fn);
    expect(atom2).toBe(atom1);
    expect(atom2).toEqual(atom1);
    expect(n).toBe(0);
    atom1.a.b = Boolean(atom1.a.b);
    expect(n).toBe(1);
    unregisterObserver();
    atom1.a.b = !atom1.a.b;
    expect(n).toBe(1);
  });

  test("contains initial values", () => {
    const atom1 = createAtom({ a: 1, b: 2 });
    expect(atom1.a).toBe(1);
    expect(atom1.b).toBe(2);
    expect((atom1 as any).c).toBeUndefined();
  });

  test("detect object value changes", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++) as any;

    expect(n).toBe(0);
    atom1.a = atom1.a + 5;
    expect(n).toBe(1);

    atom1.b = atom1.b + 5;
    expect(n).toBe(2);

    atom1.a = null;
    atom1.b = undefined;
    expect(n).toBe(4);
    expect(atom1).toEqual({ a: null, b: undefined });
  });

  test("properly handle dates", () => {
    const date = new Date();
    let n = 0;
    const atom1 = createAtom({ date }, () => n++);

    expect(typeof atom1.date.getFullYear()).toBe("number");
    expect(atom1.date).toBe(date);
    atom1.date = new Date();
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

  test("can observe value change in array in an object", () => {
    let n = 0;
    const atom1 = createAtom({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(atom1.arr)).toBe(true);
    expect(n).toBe(0);

    atom1.arr[0] = atom1.arr[0] + "nope";

    expect(n).toBe(1);
    expect(atom1.arr[0]).toBe("1nope");
    expect(atom1.arr).toEqual(["1nope", 2]);
  });

  test("can observe: changing array in object to another array", () => {
    let n = 0;
    const atom1 = createAtom({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(atom1.arr)).toBe(true);
    expect(n).toBe(0);

    atom1.arr = [2, 1];

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

  test("various object property changes", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a = atom1.a + 2;
    expect(n).toBe(1);

    // same value again
    atom1.a = 3;
    expect(n).toBe(1);

    atom1.a = 4;
    expect(n).toBe(2);
  });

  test("properly observe arrays", () => {
    let n = 0;
    const atom1 = createAtom([], () => n++) as any;

    expect(Array.isArray(atom1)).toBe(true);
    expect(atom1.length).toBe(0);
    expect(n).toBe(0);

    atom1.push(1);
    expect(n).toBe(1);
    expect(atom1.length).toBe(1);
    expect(atom1).toEqual([1]);

    atom1.splice(1, 0, "hey");
    expect(n).toBe(2);
    expect(atom1).toEqual([1, "hey"]);
    expect(atom1.length).toBe(2);

    atom1.unshift("lindemans");
    //it generates 3 primitive operations
    expect(n).toBe(5);
    expect(atom1).toEqual(["lindemans", 1, "hey"]);
    expect(atom1.length).toBe(3);

    atom1.reverse();
    //it generates 2 primitive operations
    expect(n).toBe(7);
    expect(atom1).toEqual(["hey", 1, "lindemans"]);
    expect(atom1.length).toBe(3);

    atom1.pop(); // one set, one delete
    expect(n).toBe(9);
    expect(atom1).toEqual(["hey", 1]);
    expect(atom1.length).toBe(2);

    atom1.shift(); // 2 sets, 1 delete
    expect(n).toBe(12);
    expect(atom1).toEqual([1]);
    expect(atom1.length).toBe(1);
  });

  test("object pushed into arrays are observed", () => {
    let n = 0;
    const arr: any = createAtom([], () => n++);

    arr.push({ kriek: 5 });
    expect(n).toBe(1);

    arr[0].kriek = 6;
    expect(n).toBe(1);

    arr[0].kriek = arr[0].kriek + 6;
    expect(n).toBe(2);
  });

  test("set new property on observed object", async () => {
    let n = 0;
    const atom1 = createAtom({}, () => n++) as any;

    expect(n).toBe(0);
    atom1.b = 8;

    expect(n).toBe(1);
    expect(atom1.b).toBe(8);
  });

  test("delete property from observed object", async () => {
    let n = 0;
    const atom1 = createAtom({ a: 1, b: 8 }, () => n++) as any;
    expect(n).toBe(0);

    delete atom1.b;
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
    // key "a" is no longer observed
    expect(n).toBe(1);

    atom1.new = 2; // but { b: 1 } is still observed!
    expect(n).toBe(2);
  });

  test("set element in observed array", async () => {
    let n = 0;
    const arr = createAtom(["a"], () => n++);

    arr[1] = "b";
    expect(n).toBe(1);
    expect(arr).toEqual(["a", "b"]);
  });

  test("properly observe arrays in object", () => {
    let n = 0;
    const atom1 = createAtom({ arr: [] }, () => n++) as any;

    expect(atom1.arr.length).toBe(0);
    expect(n).toBe(0);

    atom1.arr.push(1);
    expect(n).toBe(1);
    expect(atom1.arr.length).toBe(1);
  });

  test("properly observe objects in array", () => {
    let n = 0;
    const atom1 = createAtom({ arr: [{ something: 1 }] }, () => n++) as any;
    expect(n).toBe(0);

    atom1.arr[0].something = atom1.arr[0].something + 1;
    expect(n).toBe(1);
    expect(atom1.arr[0].something).toBe(2);
  });

  test("properly observe objects in object", () => {
    let n = 0;
    const atom1 = createAtom({ a: { b: 1 } }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a.b = atom1.a.b + 2;
    expect(n).toBe(1);
  });

  test("reobserve new object values", () => {
    let n = 0;
    const atom1 = createAtom({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.a++;
    expect(n).toBe(1);
    atom1.a = { b: 2 };
    expect(n).toBe(2);

    atom1.a.b = atom1.a.b + 3;
    expect(n).toBe(3);
  });

  test("deep observe misc changes", () => {
    let n = 0;
    const atom1 = createAtom({ o: { a: 1 }, arr: [1], n: 13 }, () => n++) as any;
    expect(n).toBe(0);

    atom1.o.a = atom1.o.a + 2;
    expect(n).toBe(1);

    atom1.arr.push(2);
    expect(n).toBe(2);

    atom1.n = 155;
    expect(n).toBe(2);
    atom1.n = atom1.n + 1;
    expect(n).toBe(3);
  });

  test("properly handle already observed atom", () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = createAtom({ a: 1 }, () => n1++) as any;
    const obj2 = createAtom({ b: 1 }, () => n2++) as any;

    obj1.a = obj1.a + 2;
    obj2.b = obj2.b + 3;
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj2.b = obj1;
    expect(n1).toBe(1);
    expect(n2).toBe(2);

    obj1.a = 33;
    expect(n1).toBe(2);
    expect(n2).toBe(2);
    obj2.b.a = obj2.b.a + 2;
    expect(n1).toBe(3);
    expect(n2).toBe(3);
  });

  test("properly handle already observed atom in observed atom", () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = createAtom({ a: { c: 2 } }, () => n1++) as any;
    const obj2 = createAtom({ b: 1 }, () => n2++) as any;

    obj2.c = obj1;
    expect(n1).toBe(0);
    expect(n2).toBe(1);

    obj1.a.c = obj1.a.c + 33;
    expect(n1).toBe(1);
    expect(n2).toBe(1);
    obj2.c.a.c = obj2.c.a.c + 3;
    expect(n1).toBe(2);
    expect(n2).toBe(2);
  });

  test("can reobserve object", () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: 0 }, () => n1++) as any;
    atom1.a = atom1.a + 1;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    const atom2 = createAtom(atom1, () => n2++) as any;
    expect(atom1).toEqual(atom2);

    atom2.a = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("can reobserve nested properties in object", () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: [{ b: 1 }] }, () => n1++) as any;

    const atom2 = createAtom(atom1, () => n2++) as any;

    atom1.a[0].b = atom1.a[0].b + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);
    atom2.c = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("rereading some property again give exactly same result", () => {
    const atom1 = createAtom({ a: { b: 1 } });
    const obj1 = atom1.a;
    const obj2 = atom1.a;
    expect(obj1).toBe(obj2);
  });

  test("can reobserve new properties in object", () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: [{ b: 1 }] }, () => n1++) as any;

    createAtom(atom1, () => n2++) as any;

    atom1.a[0].b = { c: 1 };
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    atom1.a[0].b.c = atom1.a[0].b.c + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);
  });

  test("can observe sub property of observed object", () => {
    let n1 = 0;
    let n2 = 0;
    const atom1 = createAtom({ a: { b: 1 }, c: 1 }, () => n1++) as any;

    const atom2 = createAtom(atom1.a, () => n2++) as any;

    atom1.a.b = atom1.a.b + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    atom1.l = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(0);

    atom1.a.k = 3;
    expect(n1).toBe(3);
    expect(n2).toBe(1);

    atom1.c = 14;
    expect(n1).toBe(3);
    expect(n2).toBe(1);
    atom2.b = atom2.b + 3;
    expect(n1).toBe(4);
    expect(n2).toBe(2);
  });

  test("can set a property more than once", () => {
    let n = 0;
    const atom1 = createAtom({}, () => n++) as any;

    atom1.aky = atom1.aku;

    atom1.aku = "always finds annoying problems";
    expect(n).toBe(2);

    atom1.aku = "always finds good problems";
    expect(n).toBe(3);
  });

  test("properly handle swapping elements", () => {
    let n = 0;
    const atom1 = createAtom({ a: { arr: [] }, b: 1 }, () => n++) as any;

    // swap a and b
    const b = atom1.b;
    atom1.b = atom1.a;
    atom1.a = b;
    expect(n).toBe(2);

    // push something into array to make sure it works
    atom1.b.arr.push("blanche");
    expect(n).toBe(3);
  });

  test("properly handle assigning observed atom containing array", () => {
    let n = 0;
    const atom1 = createAtom({ a: { arr: [], val: "test" } }, () => n++) as any;

    expect(n).toBe(0);
    atom1.a = { ...atom1.a, val: "test2" };
    expect(n).toBe(1);

    // push something into array to make sure it works
    atom1.a.arr.push("blanche");
    expect(n).toBe(2);
  });

  test("accept cycles in observed atom", () => {
    let n = 0;
    let obj1: any = {};
    let obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    obj1 = createAtom(obj1, () => n++) as any;
    obj2 = obj1.a;
    expect(n).toBe(0);

    obj1.key = 3;
    expect(n).toBe(1);
  });

  test("call callback when atom is changed", async () => {
    let n = 0;
    const atom1: any = createAtom({ a: 1, b: { c: 2 }, d: [{ e: 3 }], f: 4 }, () => n++);
    expect(n).toBe(0);
    atom1.a = atom1.a + 2;
    expect(n).toBe(1);
    atom1.b.c = atom1.b.c + 3;
    expect(n).toBe(2);
    atom1.d[0].e = atom1.d[0].e + 5;
    expect(n).toBe(3);
    atom1.a = 111;
    atom1.f = 222;
    expect(n).toBe(4);
  });

  test("can unobserve a value", () => {
    let n = 0;
    const cb = () => n++;
    const unregisterObserver = registerObserver(cb);

    const atom1 = createAtom({ a: 1 }, cb);

    atom1.a = atom1.a + 3;
    expect(n).toBe(1);

    unregisterObserver();

    atom1.a = 4;
    expect(n).toBe(1);
  });

  test("observing some observed atom", () => {
    let n1 = 0;
    let n2 = 0;
    const inner = createAtom({ a: 1 }, () => n1++);
    const outer = createAtom({ b: inner }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);
    outer.b.a = outer.b.a + 2;
    expect(n1).toBe(0);
    expect(n2).toBe(1);
  });

  test("observing some observed atom, variant", () => {
    let n1 = 0;
    let n2 = 0;
    const inner = createAtom({ a: 1 }, () => n1++);
    const outer = createAtom({ b: inner, c: 0 }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);
    inner.a = inner.a + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    outer.c = outer.c + 3;
    expect(n1).toBe(1);
    expect(n2).toBe(1);
  });

  test("observing some observed atom, variant 2", () => {
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;
    const obj1 = createAtom({ a: 1 }, () => n1++);
    const obj2 = createAtom({ b: {} }, () => n2++);
    const obj3 = createAtom({ c: {} }, () => n3++);

    obj2.b = obj2.b;
    obj3.c = obj3.c;
    expect(n1).toBe(0);
    expect(n2).toBe(1);
    expect(n3).toBe(1);

    obj2.b = obj1;
    obj3.c = obj1;

    expect(n1).toBe(0);
    expect(n2).toBe(2);
    expect(n3).toBe(2);

    obj1.a = obj1.a + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(2);
    expect(n3).toBe(2);

    obj2.b.a = obj2.b.a + 1;
    expect(n1).toBe(2);
    expect(n2).toBe(3);
    expect(n3).toBe(2);
  });

  test("notification is not done after unregistration", () => {
    let n = 0;
    const observer = () => n++;
    const unregisterObserver = registerObserver(observer);
    const state = atom({ a: 1 }, observer);
    state.a = state.a;
    expect(n).toBe(0);
    unregisterObserver();
    state.a = { b: 2 };
    expect(n).toBe(0);
    state.a.b = state.a.b + 3;
    expect(n).toBe(0);
  });
});
