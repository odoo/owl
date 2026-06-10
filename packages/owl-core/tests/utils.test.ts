import { shallowEqual } from "../src";

describe("shallowEqual", () => {
  test("primitives and identity", () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(1, 2)).toBe(false);
    expect(shallowEqual(1, "1")).toBe(false);
    expect(shallowEqual(NaN, NaN)).toBe(true);
    expect(shallowEqual(0, -0)).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, undefined)).toBe(false);
    expect(shallowEqual(undefined, [])).toBe(false);
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  test("arrays", () => {
    expect(shallowEqual([], [])).toBe(true);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(shallowEqual([1, 2], [1, 3])).toBe(false);
    expect(shallowEqual([NaN], [NaN])).toBe(true);
    // one level deep only
    expect(shallowEqual([[1]], [[1]])).toBe(false);
    const inner = [1];
    expect(shallowEqual([inner], [inner])).toBe(true);
    expect(shallowEqual([1], { 0: 1 })).toBe(false);
    expect(shallowEqual({ 0: 1 }, [1])).toBe(false);
  });

  test("plain objects", () => {
    expect(shallowEqual({}, {})).toBe(true);
    expect(shallowEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(shallowEqual({ a: undefined }, { b: undefined })).toBe(false);
    // one level deep only
    expect(shallowEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(false);
    // null-prototype objects count as plain
    const nullProto = Object.assign(Object.create(null), { a: 1 });
    expect(shallowEqual(nullProto, { a: 1 })).toBe(true);
  });

  test("non-plain objects only compare by identity", () => {
    expect(shallowEqual(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(false);
    expect(shallowEqual(new Map(), new Map())).toBe(false);
    expect(shallowEqual(new Set([1]), new Set([1]))).toBe(false);
    expect(shallowEqual(new Map(), {})).toBe(false);
    expect(shallowEqual({}, new Map())).toBe(false);
    class Point {
      constructor(public x: number) {}
    }
    expect(shallowEqual(new Point(1), new Point(1))).toBe(false);
    const p = new Point(1);
    expect(shallowEqual(p, p)).toBe(true);
    expect(shallowEqual(new Date(0), new Date(0))).toBe(false);
  });
});
