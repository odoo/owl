import {
  Component,
  mount,
  onWillRender,
  onWillStart,
  onWillUpdateProps,
  useState,
  xml,
} from "../src";
import { reactive } from "../src/reactivity";
import { batched } from "../src/utils";
import {
  makeDeferred,
  makeTestFixture,
  nextMicroTick,
  nextTick,
  snapshotEverything,
  useLogLifecycle,
} from "./helpers";

function createReactive(value: any, observer: any = () => {}) {
  return reactive(value, observer);
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

  test("work if there are no callback given", () => {
    const state = reactive({ a: 1 });
    expect(state.a).toBe(1);
    state.a = 2;
    expect(state.a).toBe(2);
  });

  test("Throw error if value is not proxifiable", () => {
    expect(() => createReactive(1)).toThrow("Cannot make the given value reactive");
  });

  test("callback is called when changing an observed property 1", async () => {
    let n = 0;
    const state = createReactive({ a: 1 }, () => n++);
    state.a = 2;
    expect(n).toBe(0); // key has not be read yet
    state.a = state.a + 5; // key is read and then modified
    expect(n).toBe(1);
  });

  test("callback is called when changing an observed property 2", async () => {
    let n = 0;
    const state = createReactive({ a: { k: 1 } }, () => n++);
    state.a.k = state.a.k + 1;
    expect(n).toBe(1);
    state.k = 2; // observer has been interested specifically to key k of a!
    expect(n).toBe(1);
  });

  test("reactive from object with a getter 1", async () => {
    let n = 0;
    let value = 1;
    const state = createReactive(
      {
        get a() {
          return value;
        },
        set a(val) {
          value = val;
        },
      },
      () => n++
    );
    state.a = state.a + 4;
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("reactive from object with a getter 2", async () => {
    let n = 0;
    let value = { b: 1 };
    const state = createReactive(
      {
        get a() {
          return value;
        },
      },
      () => n++
    );
    expect(state.a.b).toBe(1);
    state.a.b = 2;
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("reactive from object with a getter 3", async () => {
    let n = 0;
    const values: { b: number }[] = createReactive([]);
    function createValue() {
      const o = { b: values.length };
      values.push(o);
      return o;
    }
    const reactive = createReactive(
      {
        get a() {
          return createValue();
        },
      },
      () => n++
    );
    for (let i = 0; i < 10; i++) {
      expect(reactive.a.b).toEqual(i);
    }
    expect(n).toBe(0);
    values[0].b = 3;
    expect(n).toBe(1); // !!! reactives for each object in values are still there !!!
    values[0].b = 4;
    expect(n).toBe(1); // reactives for each object in values were cleaned up by the previous write
  });

  test("Operator 'in' causes key's presence to be observed", async () => {
    let n = 0;
    const state = createReactive({}, () => n++);

    "a" in state;
    state.a = 2;
    expect(n).toBe(1);

    "a" in state;
    state.a = 3; // Write on existing property shouldn't notify
    expect(n).toBe(1);

    "a" in state;
    delete state.a;
    expect(n).toBe(2);
  });

  test.skip("hasOwnProperty causes the key's presence to be observed", async () => {
    let n = 0;
    const state = createReactive({}, () => n++);

    Object.hasOwnProperty.call(state, "a");
    state.a = 2;
    expect(n).toBe(1);

    Object.hasOwnProperty.call(state, "a");
    state.a = 3;
    expect(n).toBe(1);

    Object.hasOwnProperty.call(state, "a");
    delete state.a;
    expect(n).toBe(2);
  });

  test("batched: callback is called after batch of operation", async () => {
    let n = 0;
    const state = createReactive(
      { a: 1, b: 2 },
      batched(() => n++)
    );
    state.a = 2;
    expect(n).toBe(0);
    await nextMicroTick();
    expect(n).toBe(0); // key has not be read yet
    state.a = state.a + 5; // key is read and then modified
    expect(n).toBe(0);
    state.b = state.b + 5; // key is read and then modified
    expect(n).toBe(0);
    await nextMicroTick();
    expect(n).toBe(1); // two operations but only one notification
  });

  test("setting property to same value does not trigger callback", async () => {
    let n = 0;
    const state = createReactive({ a: 1 }, () => n++);
    state.a = state.a + 5; // read and modifies property a to have value 6
    expect(n).toBe(1);
    state.a = 6; // same value
    expect(n).toBe(1);
  });

  test("observe cycles", async () => {
    const a = { a: {} };
    a.a = a;

    let n = 0;
    const state = createReactive(a, () => n++);

    state.k;
    state.k = 2;
    expect(n).toBe(1);

    delete state.l;
    expect(n).toBe(1);

    state.k;
    delete state.k;
    expect(n).toBe(2);

    state.a = 1;
    expect(n).toBe(2);

    state.a = state.a + 5;
    expect(n).toBe(3);
  });

  test("equality", async () => {
    const a = { a: {}, b: 1 };
    a.a = a;
    let n = 0;
    const state = createReactive(a, () => n++);
    expect(state).toBe(state.a);
    expect(n).toBe(0);
    (state.b = state.b + 1), expect(n).toBe(1);
    expect(state).toBe(state.a);
  });

  test("two observers for same source", async () => {
    let m = 0;
    let n = 0;
    const obj = { a: 1 } as any;
    const state = createReactive(obj, () => m++);
    const state2 = createReactive(obj, () => n++);

    obj.new = 2;
    expect(m).toBe(0);
    expect(n).toBe(0);

    state.new = 2; // already exists!
    expect(m).toBe(0);
    expect(n).toBe(0);

    state.veryNew;
    state2.veryNew;
    state.veryNew = 2;
    expect(m).toBe(1);
    expect(n).toBe(1);

    state.a = state.a + 5;
    expect(m).toBe(2);
    expect(n).toBe(1);

    state.a;
    state2.a = state2.a + 5;
    expect(m).toBe(3);
    expect(n).toBe(2);

    state.veryNew;
    state2.veryNew;
    delete state2.veryNew;
    expect(m).toBe(4);
    expect(n).toBe(3);
  });

  test("create reactive from another", async () => {
    let n = 0;
    const state = createReactive({ a: 1 });
    const state2 = createReactive(state, () => n++);
    state2.a = state2.a + 5;
    expect(n).toBe(1);
    state2.a;
    state.a = 2;
    expect(n).toBe(2);
  });

  test("create reactive from another 2", async () => {
    let n = 0;
    const state = createReactive({ a: 1 });
    const state2 = createReactive(state, () => n++);
    state.a = state2.a + 5;
    expect(n).toBe(1);

    state2.a = state2.a + 5;
    expect(n).toBe(2);
  });

  test("create reactive from another 3", async () => {
    let n = 0;
    const state = createReactive({ a: 1 });
    const state2 = createReactive(state, () => n++);
    state.a = state.a + 5;
    expect(n).toBe(0); // state2.a was not yet read
    state2.a = state2.a + 5;
    state2.a;
    expect(n).toBe(1); // state2.a has been read and is now observed
    state.a = state.a + 5;
    expect(n).toBe(2);
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
    let n = 0;
    const state = createReactive({ a: { b: null } } as any, () => n++);
    expect(n).toBe(0);
    state.a.b = Boolean(state.a.b);
    expect(n).toBe(1);
  });

  test("can reobserve object with some key set to null", async () => {
    let n = 0;
    const fn = () => n++;
    const state = createReactive({ a: { b: null } } as any, fn);
    const state2 = createReactive(state, fn);
    expect(state2).toBe(state);
    expect(state2).toEqual(state);
    expect(n).toBe(0);
    state.a.b = Boolean(state.a.b);
    expect(n).toBe(1);
  });

  test("contains initial values", () => {
    const state = createReactive({ a: 1, b: 2 });
    expect(state.a).toBe(1);
    expect(state.b).toBe(2);
    expect((state as any).c).toBeUndefined();
  });

  test("detect object value changes", async () => {
    let n = 0;
    const state = createReactive({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    state.a = state.a + 5;
    expect(n).toBe(1);

    state.b = state.b + 5;
    expect(n).toBe(2);

    state.a;
    state.b;
    state.a = null;
    state.b = undefined;
    expect(n).toBe(3);
    expect(state).toEqual({ a: null, b: undefined });
  });

  test("properly handle dates", async () => {
    const date = new Date();
    let n = 0;
    const state = createReactive({ date }, () => n++);

    expect(typeof state.date.getFullYear()).toBe("number");
    expect(state.date).toBe(date);

    state.date = new Date();
    expect(n).toBe(1);
    expect(state.date).not.toBe(date);
  });

  test("properly handle promise", async () => {
    let resolved = false;
    let n = 0;
    const state = createReactive({ prom: Promise.resolve() }, () => n++);

    expect(state.prom).toBeInstanceOf(Promise);
    state.prom.then(() => (resolved = true));
    expect(n).toBe(0);
    expect(resolved).toBe(false);
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(n).toBe(0);
  });

  test("can observe value change in array in an object", async () => {
    let n = 0;
    const state = createReactive({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(state.arr)).toBe(true);
    expect(n).toBe(0);

    state.arr[0] = state.arr[0] + "nope";

    expect(n).toBe(1);
    expect(state.arr[0]).toBe("1nope");
    expect(state.arr).toEqual(["1nope", 2]);
  });

  test("can observe: changing array in object to another array", async () => {
    let n = 0;
    const state = createReactive({ arr: [1, 2] }, () => n++) as any;

    expect(Array.isArray(state.arr)).toBe(true);
    expect(n).toBe(0);

    state.arr = [2, 1];

    expect(n).toBe(1);
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
    let n = 0;
    const state = createReactive({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    state.a = state.a + 2;
    expect(n).toBe(1);

    state.a;
    // same value again: no notification
    state.a = 3;
    expect(n).toBe(1);

    state.a = 4;
    expect(n).toBe(2);
  });

  test("properly observe arrays", async () => {
    let n = 0;
    const state = createReactive([], () => n++) as any;

    expect(Array.isArray(state)).toBe(true);
    expect(state.length).toBe(0);
    expect(n).toBe(0);

    state.push(1);
    expect(n).toBe(1);
    expect(state.length).toBe(1);
    expect(state).toEqual([1]);

    state.splice(1, 0, "hey");
    expect(n).toBe(2);
    expect(state).toEqual([1, "hey"]);
    expect(state.length).toBe(2);

    // clear all observations caused by previous expects
    state[0] = 2;
    expect(n).toBe(3);

    state.unshift("lindemans");
    // unshift generates the following sequence of operations: (observed keys in brackets)
    // - read 'unshift' => { unshift }
    // - read 'length' =>  { unshift , length }
    // - hasProperty '1' =>  { unshift , length, [KEYCHANGES] }
    // - read '1' =>  { unshift , length, 1 }
    // - write "hey" on '2' => notification for key creation, {}
    // - hasProperty '0' =>  { [KEYCHANGES] }
    // - read '0' => { 0, [KEYCHANGES] }
    // - write "2" on '1' => not observing '1', no notification
    // - write "lindemans" on '0' => notification, stop observing {}
    // - write 3 on 'length' => not observing 'length', no notification
    expect(n).toBe(5);
    expect(state).toEqual(["lindemans", 2, "hey"]);
    expect(state.length).toBe(3);

    // clear all observations caused by previous expects
    state[1] = 3;
    expect(n).toBe(6);

    state.reverse();
    // Reverse will generate floor(length/2) notifications because it swaps elements pair-wise
    expect(n).toBe(7);
    expect(state).toEqual(["hey", 3, "lindemans"]);
    expect(state.length).toBe(3);

    state.pop(); // reads '2', deletes '2', sets length. Only delete triggers a notification
    expect(n).toBe(8);
    expect(state).toEqual(["hey", 3]);
    expect(state.length).toBe(2);

    state.shift(); // reads '0', reads '1', sets '0', sets length. Only set '0' triggers a notification
    expect(n).toBe(9);
    expect(state).toEqual([3]);
    expect(state.length).toBe(1);
  });

  test("object pushed into arrays are observed", async () => {
    let n = 0;
    const arr: any = createReactive([], () => n++);

    arr.push({ kriek: 5 });
    expect(n).toBe(1);

    arr[0].kriek = 6;
    expect(n).toBe(1);

    arr[0].kriek = arr[0].kriek + 6;
    expect(n).toBe(2);
  });

  test("set new property on observed object", async () => {
    let n = 0;
    let keys: string[] = [];
    const notify = () => {
      n++;
      keys.splice(0);
      keys.push(...Object.keys(state));
    };
    const state = createReactive({}, notify) as any;
    Object.keys(state);
    expect(n).toBe(0);

    state.b = 8;
    expect(n).toBe(1);
    expect(state.b).toBe(8);
    expect(keys).toEqual(["b"]);
  });

  test("set new property object when key changes are not observed", async () => {
    let n = 0;
    const notify = () => n++;
    const state = createReactive({ a: 1 }, notify) as any;
    state.a;
    expect(n).toBe(0);

    state.b = 8;
    expect(n).toBe(0); // Not observing key changes: shouldn't get notified
    expect(state.b).toBe(8);
    expect(state).toEqual({ a: 1, b: 8 });
  });

  test("delete property from observed object", async () => {
    let n = 0;
    const state = createReactive({ a: 1, b: 8 }, () => n++) as any;
    Object.keys(state);
    expect(n).toBe(0);

    delete state.b;
    expect(n).toBe(1);
    expect(state).toEqual({ a: 1 });
  });

  test("delete property from observed object 2", async () => {
    let n = 0;
    const observer = () => n++;
    const obj = { a: { b: 1 } };
    const state = createReactive(obj.a, observer) as any;
    const state2 = createReactive(obj, observer) as any;
    expect(state2.a).toBe(state);
    expect(n).toBe(0);

    Object.keys(state2);
    delete state2.a;
    expect(n).toBe(1);

    Object.keys(state);
    state.new = 2;
    expect(n).toBe(2);
  });

  test("set element in observed array", async () => {
    let n = 0;
    const arr = createReactive(["a"], () => n++);
    arr[1];
    arr[1] = "b";
    expect(n).toBe(1);
    expect(arr).toEqual(["a", "b"]);
  });

  test("properly observe arrays in object", async () => {
    let n = 0;
    const state = createReactive({ arr: [] }, () => n++) as any;

    expect(state.arr.length).toBe(0);
    expect(n).toBe(0);

    state.arr.push(1);
    expect(n).toBe(1);
    expect(state.arr.length).toBe(1);
  });

  test("properly observe objects in array", async () => {
    let n = 0;
    const state = createReactive({ arr: [{ something: 1 }] }, () => n++) as any;
    expect(n).toBe(0);

    state.arr[0].something = state.arr[0].something + 1;
    expect(n).toBe(1);
    expect(state.arr[0].something).toBe(2);
  });

  test("properly observe objects in object", async () => {
    let n = 0;
    const state = createReactive({ a: { b: 1 } }, () => n++) as any;
    expect(n).toBe(0);

    state.a.b = state.a.b + 2;
    expect(n).toBe(1);
  });

  test("Observing the same object through the same reactive preserves referential equality", async () => {
    const o = {} as any;
    o.o = o;
    const state = createReactive(o);
    expect(state.o).toBe(state);
    expect(state.o.o).toBe(state);
  });

  test("reobserve new object values", async () => {
    let n = 0;
    const state = createReactive({ a: 1 }, () => n++) as any;
    expect(n).toBe(0);

    state.a++;
    state.a;
    expect(n).toBe(1);

    state.a = { b: 2 };
    expect(n).toBe(2);

    state.a.b = state.a.b + 3;
    expect(n).toBe(3);
  });

  test("deep observe misc changes", async () => {
    let n = 0;
    const state = createReactive({ o: { a: 1 }, arr: [1], n: 13 }, () => n++) as any;
    expect(n).toBe(0);

    state.o.a = state.o.a + 2;
    expect(n).toBe(1);

    state.arr.push(2);
    expect(n).toBe(2);

    state.n = 155;
    expect(n).toBe(2);

    state.n = state.n + 1;
    expect(n).toBe(3);
  });

  test("properly handle already observed object", async () => {
    let n1 = 0;
    let n2 = 0;

    const obj1 = createReactive({ a: 1 }, () => n1++) as any;
    const obj2 = createReactive({ b: 1 }, () => n2++) as any;

    obj1.a = obj1.a + 2;
    obj2.b = obj2.b + 3;
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj2.b;
    obj2.b = obj1;
    expect(n1).toBe(1);
    expect(n2).toBe(2);

    obj1.a;
    obj1.a = 33;
    expect(n1).toBe(2);
    expect(n2).toBe(2);

    obj1.a;
    obj2.b.a = obj2.b.a + 2;
    expect(n1).toBe(3);
    expect(n2).toBe(3);
  });

  test("properly handle already observed object in observed object", async () => {
    let n1 = 0;
    let n2 = 0;
    const obj1 = createReactive({ a: { c: 2 } }, () => n1++) as any;
    const obj2 = createReactive({ b: 1 }, () => n2++) as any;

    obj2.c;
    obj2.c = obj1;
    expect(n1).toBe(0);
    expect(n2).toBe(1);

    obj1.a.c = obj1.a.c + 33;
    obj1.a.c;
    expect(n1).toBe(1);
    expect(n2).toBe(1);

    obj2.c.a.c = obj2.c.a.c + 3;
    expect(n1).toBe(2);
    expect(n2).toBe(2);
  });

  test("can reobserve object", async () => {
    let n1 = 0;
    let n2 = 0;
    const state = createReactive({ a: 0 }, () => n1++) as any;

    state.a = state.a + 1;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    const state2 = createReactive(state, () => n2++) as any;
    expect(state).toEqual(state2);

    state2.a = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("can reobserve nested properties in object", async () => {
    let n1 = 0;
    let n2 = 0;
    const state = createReactive({ a: [{ b: 1 }] }, () => n1++) as any;

    const state2 = createReactive(state, () => n2++) as any;

    state.a[0].b = state.a[0].b + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    state.c;
    state2.c;
    state2.c = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(1);
  });

  test("rereading some property again give exactly same result", () => {
    const state = createReactive({ a: { b: 1 } });
    const obj1 = state.a;
    const obj2 = state.a;
    expect(obj1).toBe(obj2);
  });

  test("can reobserve new properties in object", async () => {
    let n1 = 0;
    let n2 = 0;
    const state = createReactive({ a: [{ b: 1 }] }, () => n1++) as any;

    createReactive(state, () => n2++) as any;

    state.a[0].b = { c: 1 };
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    state.a[0].b.c = state.a[0].b.c + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);
  });

  test("can observe sub property of observed object", async () => {
    let n1 = 0;
    let n2 = 0;
    const state = createReactive({ a: { b: 1 }, c: 1 }, () => n1++) as any;

    const state2 = createReactive(state.a, () => n2++) as any;

    state.a.b = state.a.b + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    state.l;
    state.l = 2;
    expect(n1).toBe(2);
    expect(n2).toBe(0);

    state.a.k;
    state2.k;
    state.a.k = 3;
    expect(n1).toBe(3);
    expect(n2).toBe(1);

    state.c = 14;
    expect(n1).toBe(3);
    expect(n2).toBe(1);

    state.a.b;
    state2.b = state2.b + 3;
    expect(n1).toBe(4);
    expect(n2).toBe(2);
  });

  test("can set a property more than once", async () => {
    let n = 0;
    const state = createReactive({}, () => n++) as any;

    state.aky = state.aku;
    expect(n).toBe(0);
    state.aku = "always finds annoying problems";
    expect(n).toBe(1);

    state.aku;
    state.aku = "always finds good problems";
    expect(n).toBe(2);
  });

  test("properly handle swapping elements", async () => {
    let n = 0;
    const state = createReactive({ a: { arr: [] }, b: 1 }, () => n++) as any;

    // swap a and b
    const b = state.b;
    state.b = state.a;
    state.a = b;
    expect(n).toBe(1);

    // push something into array to make sure it works
    state.b.arr.push("blanche");
    // push reads the length property and as such subscribes to the change it is about to cause
    expect(n).toBe(2);
  });

  test("properly handle assigning object containing array to reactive", async () => {
    let n = 0;
    const state = createReactive({ a: { arr: [], val: "test" } }, () => n++) as any;
    expect(n).toBe(0);

    state.a = { ...state.a, val: "test2" };
    expect(n).toBe(1);

    // push something into array to make sure it works
    state.a.arr.push("blanche");
    expect(n).toBe(2);
  });

  test.skip("accept cycles in observed object", async () => {
    // ???
    let n = 0;
    let obj1: any = {};
    let obj2: any = { b: obj1, key: 1 };
    obj1.a = obj2;
    obj1 = createReactive(obj1, () => n++) as any;
    obj2 = obj1.a;
    expect(n).toBe(0);

    obj1.key = 3;
    expect(n).toBe(1);
  });

  test("call callback when reactive is changed", async () => {
    let n = 0;
    const state: any = createReactive({ a: 1, b: { c: 2 }, d: [{ e: 3 }], f: 4 }, () => n++);
    expect(n).toBe(0);

    state.a = state.a + 2;
    state.a;
    expect(n).toBe(1);

    state.b.c = state.b.c + 3;
    expect(n).toBe(2);

    state.d[0].e = state.d[0].e + 5;
    expect(n).toBe(3);

    state.a;
    state.f;
    state.a = 111;
    state.f = 222;
    expect(n).toBe(4);
  });

  // test("can unobserve a value", async () => {
  //   let n = 0;
  //   const cb = () => n++;
  //   const unregisterObserver = registerObserver(cb);

  //   const state = createReactive({ a: 1 }, cb);

  //   state.a = state.a + 3;
  //   await nextMicroTick();
  //   expect(n).toBe(1);

  //   unregisterObserver();

  //   state.a = 4;
  //   await nextMicroTick();
  //   expect(n).toBe(1);
  // });

  test("reactive inside other reactive", async () => {
    let n1 = 0;
    let n2 = 0;
    const inner = createReactive({ a: 1 }, () => n1++);
    const outer = createReactive({ b: inner }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    outer.b.a = outer.b.a + 2;
    expect(n1).toBe(0);
    expect(n2).toBe(1);
  });

  test("reactive inside other reactive, variant", async () => {
    let n1 = 0;
    let n2 = 0;
    const inner = createReactive({ a: 1 }, () => n1++);
    const outer = createReactive({ b: inner, c: 0 }, () => n2++);
    expect(n1).toBe(0);
    expect(n2).toBe(0);

    inner.a = inner.a + 2;
    expect(n1).toBe(1);
    expect(n2).toBe(0);

    outer.c = outer.c + 3;
    expect(n1).toBe(1);
    expect(n2).toBe(1);
  });

  test("reactive inside other reactive, variant 2", async () => {
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;
    const obj1 = createReactive({ a: 1 }, () => n1++);
    const obj2 = createReactive({ b: {} }, () => n2++);
    const obj3 = createReactive({ c: {} }, () => n3++);

    obj2.b = obj2.b;
    obj2.b;
    obj3.c = obj3.c;
    obj3.c;
    expect(n1).toBe(0);
    expect(n2).toBe(1);
    expect(n3).toBe(1);

    obj2.b = obj1;
    obj2.b;
    obj3.c = obj1;
    obj3.c;
    expect(n1).toBe(0);
    expect(n2).toBe(2);
    expect(n3).toBe(2);

    obj1.a = obj1.a + 2;
    obj1.a;
    expect(n1).toBe(1);
    expect(n2).toBe(2);
    expect(n3).toBe(2);

    obj2.b.a = obj2.b.a + 1;
    expect(n1).toBe(2);
    expect(n2).toBe(3);
    expect(n3).toBe(2);
  });

  // test("notification is not done after unregistration", async () => {
  //   let n = 0;
  //   const observer = () => n++;
  //   const unregisterObserver = registerObserver(observer);
  //   const state = atom({ a: 1 } as any, observer);

  //   state.a = state.a;
  //   await nextMicroTick();
  //   expect(n).toBe(0);

  //   unregisterObserver();

  //   state.a = { b: 2 };
  //   await nextMicroTick();
  //   expect(n).toBe(0);

  //   state.a.b = state.a.b + 3;
  //   await nextMicroTick();
  //   expect(n).toBe(0);
  // });

  test("don't react to changes in subobject that has been deleted", async () => {
    let n = 0;
    const a = { k: {} } as any;
    const state = createReactive(a, () => n++);

    state.k.l;
    state.k.l = 1;
    expect(n).toBe(1);

    const kVal = state.k;

    delete state.k;
    expect(n).toBe(2);

    kVal.l = 2;
    expect(n).toBe(2); // kVal must no longer be observed
  });

  test("don't react to changes in subobject that has been deleted", async () => {
    let n = 0;
    const b = {} as any;
    const a = { k: b } as any;
    const observer = () => n++;
    const state2 = createReactive(b, observer);
    const state = createReactive(a, observer);

    state.c = 1;
    state.k.d;
    state.k.d = 2;
    state.k;
    expect(n).toBe(1);

    delete state.k;
    expect(n).toBe(2);

    state2.e = 3;
    expect(n).toBe(2);
  });

  test("don't react to changes in subobject that has been deleted 3", async () => {
    let n = 0;
    const b = {} as any;
    const a = { k: b } as any;
    const observer = () => n++;
    const state = createReactive(a, observer);
    const state2 = createReactive(b, observer);

    state.c = 1;
    state.k.d;
    state.k.d = 2;
    state.k.d;
    expect(n).toBe(1);

    delete state.k;
    expect(n).toBe(2);

    state2.e = 3;
    expect(n).toBe(2);
  });

  test("don't react to changes in subobject that has been deleted 4", async () => {
    let n = 0;
    const a = { k: {} } as any;
    a.k = a;
    const state = createReactive(a, () => n++);
    Object.keys(state);

    state.b = 1;
    expect(n).toBe(1);

    Object.keys(state);
    delete state.k;
    expect(n).toBe(2);

    state.c = 2;
    expect(n).toBe(2);
  });

  test("don't react to changes in subobject that has been replaced", async () => {
    let n = 0;
    const a = { k: { n: 1 } } as any;
    const state = createReactive(a, () => n++);
    const kVal = state.k; // read k

    state.k = { n: state.k.n + 1 };
    await nextMicroTick();
    expect(n).toBe(1);
    expect(state.k).toEqual({ n: 2 });

    kVal.n = 3;
    await nextMicroTick();
    expect(n).toBe(1);
    expect(state.k).toEqual({ n: 2 });
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
    expect([
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
    ]).toBeLogged();

    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.value = 321;
    await nextTick();
    expect([
      "Child:willRender",
      "Child:rendered",
      "Child:willRender",
      "Child:rendered",
      "Child:willPatch",
      "Child:patched",
      "Child:willPatch",
      "Child:patched",
    ]).toBeLogged();
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
    expect([
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
    ]).toBeLogged();

    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");
    testContext.value = 321;
    await nextMicroTick();
    await nextMicroTick();
    expect([
      "Child:willRender",
      "Child:rendered",
      "Child:willRender",
      "Child:rendered",
    ]).toBeLogged();
    expect(fixture.innerHTML).toBe("<div><span>123</span><span>123</span></div>");

    await nextTick();
    expect(["Child:willPatch", "Child:patched", "Child:willPatch", "Child:patched"]).toBeLogged();
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
    expect([
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
    ]).toBeLogged();

    testContext.value = 321;
    await nextMicroTick();
    await nextMicroTick();
    expect(fixture.innerHTML).toBe("<div><span>123</span><div><span>123</span></div></div>");
    expect([
      "Child:willRender",
      "Child:rendered",
      "Child:willRender",
      "Child:rendered",
    ]).toBeLogged();

    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>321</span><div><span>321</span></div></div>");
    expect(["Child:willPatch", "Child:patched", "Child:willPatch", "Child:patched"]).toBeLogged();
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
    expect([
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
    ]).toBeLogged();

    testContext.a = 321;
    await nextTick();
    expect(["Child:willRender", "Child:rendered", "Child:willPatch", "Child:patched"]).toBeLogged();

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect([
      "Parent:willRender",
      "Parent:rendered",
      "Parent:willPatch",
      "Child:willUnmount",
      "Child:willDestroy",
      "Parent:patched",
    ]).toBeLogged();

    testContext.a = 456;
    await nextTick();
    expect([]).toBeLogged();
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
