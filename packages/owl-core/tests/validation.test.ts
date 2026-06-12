import { describe, expect, test } from "vitest";
import {
  applyDefaults,
  assertType,
  computed,
  getDefault,
  signal,
  t,
  types,
  validateType,
} from "../src";

class A {}

test("t is an alias of types", () => {
  expect(t).toBe(types);
});

test("simple assertion", () => {
  expect(() => assertType("hey", t.string())).not.toThrow();
  expect(() => assertType({}, t.object())).not.toThrow();
  expect(() => assertType([], t.array())).not.toThrow();
  expect(() => assertType(1, t.boolean())).toThrow("Value does not match the type");
});

test("validateType", () => {
  expect(validateType("abc", t.string())).toEqual([]);
  expect(validateType("abc", t.number())).toEqual([
    { message: "value is not a number", path: "", received: "abc" },
  ]);
  expect(validateType(undefined, t.number())).toEqual([
    { message: "value is not a number", path: "", received: undefined },
  ]);
  expect(validateType(1, t.number())).toEqual([]);
});

test("and", () => {
  const a = t.object({ a: t.string() });
  const b = t.object({ b: t.number() });
  expect(validateType({}, t.and([a, b]))).toEqual([
    { message: "object value has missing keys", path: "", missingKeys: ["a"], received: {} },
    { message: "object value has missing keys", path: "", missingKeys: ["b"], received: {} },
  ]);
  expect(validateType({ a: "abc" }, t.and([a, b]))).toEqual([
    { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: "abc" } },
  ]);
  expect(validateType({ a: 123 }, t.and([a, b]))).toEqual([
    { message: "value is not a string", path: "a", received: 123 },
    { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: 123 } },
  ]);
  expect(validateType({ a: "abc", b: 123 }, t.and([a, b]))).toEqual([]);
  expect(validateType({ b: 123 }, t.and([a, b]))).toEqual([
    { message: "object value has missing keys", path: "", missingKeys: ["a"], received: { b: 123 } },
  ]);
  expect(validateType({ a: "abc", b: "abc" }, t.and([a, b]))).toEqual([
    { message: "value is not a number", path: "b", received: "abc" },
  ]);
});

test("any", () => {
  expect(validateType("", t.any())).toEqual([]);
  expect(validateType("abc", t.any())).toEqual([]);
  expect(validateType(true, t.any())).toEqual([]);
  expect(validateType(false, t.any())).toEqual([]);
  expect(validateType(123, t.any())).toEqual([]);
  expect(validateType(987, t.any())).toEqual([]);
  expect(validateType(undefined, t.any())).toEqual([]);
  expect(validateType(null, t.any())).toEqual([]);
  expect(validateType({}, t.any())).toEqual([]);
  expect(validateType({ a: 1, b: "", c: { a: true } }, t.any())).toEqual([]);
  expect(validateType([{ a: 1 }, { b: 2 }], t.any())).toEqual([]);
  expect(validateType(() => {}, t.any())).toEqual([]);
  expect(validateType(A, t.any())).toEqual([]);
  expect(validateType(new A(), t.any())).toEqual([]);
});

test("array", () => {
  expect(validateType({}, t.array())).toEqual([{ message: "value is not an array", path: "", received: {} }]);
  expect(validateType("", t.array())).toEqual([{ message: "value is not an array", path: "", received: "" }]);
  expect(validateType("abc", t.array())).toEqual([{ message: "value is not an array", path: "", received: "abc" }]);
  expect(validateType(123, t.array())).toEqual([{ message: "value is not an array", path: "", received: 123 }]);
  expect(validateType(987, t.array())).toEqual([{ message: "value is not an array", path: "", received: 987 }]);
  expect(validateType(true, t.array())).toEqual([{ message: "value is not an array", path: "", received: true }]);
  expect(validateType({}, t.array())).toEqual([{ message: "value is not an array", path: "", received: {} }]);
  expect(validateType([], t.array())).toEqual([]);
  expect(validateType([123], t.array())).toEqual([]);
  expect(validateType(["abc"], t.array())).toEqual([]);
  expect(validateType(["abc", 123], t.array())).toEqual([]);
  expect(validateType(["abc", 123, false], t.array())).toEqual([]);
  expect(validateType(["abc"], t.array(t.string()))).toEqual([]);
  expect(validateType([123, "abc"], t.array(t.string()))).toEqual([
    { message: "value is not a string", path: "0", received: 123 },
  ]);
  expect(validateType(["abc", "def"], t.array(t.string()))).toEqual([]);
  expect(validateType(["abc", 321], t.array(t.string()))).toEqual([
    { message: "value is not a string", path: "1", received: 321 },
  ]);
});

test("boolean", () => {
  expect(validateType(true, t.boolean())).toEqual([]);
  expect(validateType(false, t.boolean())).toEqual([]);
  expect(validateType("", t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: "" },
  ]);
  expect(validateType("abc", t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: "abc" },
  ]);
  expect(validateType(123, t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: 123 },
  ]);
  expect(validateType(987, t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: 987 },
  ]);
  expect(validateType(undefined, t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: undefined },
  ]);
  expect(validateType(null, t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: null },
  ]);
  expect(validateType({}, t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: {} },
  ]);
  expect(validateType([], t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: [] },
  ]);
  expect(validateType(A, t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: A },
  ]);
  expect(validateType(new A(), t.boolean())).toEqual([
    { message: "value is not a boolean", path: "", received: new A() },
  ]);
});

test("constructor", () => {
  class B extends A {}
  class C {}
  expect(validateType(true, t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: true },
  ]);
  expect(validateType("abc", t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: "abc" },
  ]);
  expect(validateType(123, t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: 123 },
  ]);
  expect(validateType(A, t.constructor(A))).toEqual([]);
  expect(validateType(B, t.constructor(A))).toEqual([]);
  expect(validateType(C, t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: C },
  ]);
  expect(validateType(A, t.constructor(B))).toEqual([
    { message: "value is not 'B' or an extension", path: "", received: A },
  ]);
  expect(validateType(B, t.constructor(B))).toEqual([]);
  expect(validateType(C, t.constructor(B))).toEqual([
    { message: "value is not 'B' or an extension", path: "", received: C },
  ]);
  expect(validateType(A, t.constructor(C))).toEqual([
    { message: "value is not 'C' or an extension", path: "", received: A },
  ]);
  expect(validateType(B, t.constructor(C))).toEqual([
    { message: "value is not 'C' or an extension", path: "", received: B },
  ]);
  expect(validateType(C, t.constructor(C))).toEqual([]);
  expect(validateType({}, t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: {} },
  ]);
  expect(validateType(new A(), t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: new A() },
  ]);
  expect(validateType(new B(), t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: new B() },
  ]);
  expect(validateType(new C(), t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: new C() },
  ]);
  expect(validateType([], t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: [] },
  ]);
  const arrowFn = () => {};
  expect(validateType(arrowFn, t.constructor(A))).toEqual([
    { message: "value is not 'A' or an extension", path: "", received: arrowFn },
  ]);
});

test("customValidator", () => {
  const validator = t.customValidator(t.string(), (size) => ["sm", "md", "lg"].includes(size));
  expect(validateType(123, validator)).toEqual([{ message: "value is not a string", path: "", received: 123 }]);
  expect(validateType("sm", validator)).toEqual([]);
  expect(validateType("md", validator)).toEqual([]);
  expect(validateType("lg", validator)).toEqual([]);
  expect(validateType("small", validator)).toEqual([
    { message: "value does not match custom validation", path: "", received: "small" },
  ]);
  expect(
    validateType(
      "small",
      t.customValidator(t.string(), (size) => ["sm", "md", "lg"].includes(size), "Invalid")
    )
  ).toEqual([{ message: "Invalid", path: "", received: "small" }]);
});

describe("function", () => {
  test("function", () => {
    expect(validateType(123, t.function())).toEqual([{ message: "value is not a function", path: "", received: 123 }]);
    expect(validateType("abc", t.function())).toEqual([
      { message: "value is not a function", path: "", received: "abc" },
    ]);
    expect(validateType(true, t.function())).toEqual([
      { message: "value is not a function", path: "", received: true },
    ]);
    expect(validateType(() => {}, t.function())).toEqual([]);
    expect(validateType(function () {}, t.function())).toEqual([]);
    expect(validateType(A, t.function())).toEqual([]); // Should return an issue
  });

  test("parameters and return types are not checked", () => {
    expect(validateType(() => {}, t.function([t.string()], t.boolean()))).toEqual([]);
    expect(validateType(function () {}, t.function([t.string()], t.boolean()))).toEqual([]);
  });
});

test("instanceOf", () => {
  class B extends A {}
  class C {}
  expect(validateType(123, t.instanceOf(A))).toEqual([
    { message: "value is not an instance of 'A'", path: "", received: 123 },
  ]);
  expect(validateType("abc", t.instanceOf(A))).toEqual([
    { message: "value is not an instance of 'A'", path: "", received: "abc" },
  ]);
  expect(validateType(true, t.instanceOf(A))).toEqual([
    { message: "value is not an instance of 'A'", path: "", received: true },
  ]);
  expect(validateType({}, t.instanceOf(A))).toEqual([
    { message: "value is not an instance of 'A'", path: "", received: {} },
  ]);
  expect(validateType([], t.instanceOf(A))).toEqual([
    { message: "value is not an instance of 'A'", path: "", received: [] },
  ]);
  expect(validateType(new A(), t.instanceOf(A))).toEqual([]);
  expect(validateType(new B(), t.instanceOf(A))).toEqual([]);
  expect(validateType(new C(), t.instanceOf(A))).toEqual([
    { message: "value is not an instance of 'A'", path: "", received: new C() },
  ]);
});

test("literal", () => {
  expect(validateType(123, t.literal(123))).toEqual([]);
  expect(validateType(321, t.literal(123))).toEqual([
    { message: "value is not equal to 123", path: "", received: 321 },
  ]);
  expect(validateType("abc", t.literal("abc"))).toEqual([]);
  expect(validateType("", t.literal("abc"))).toEqual([
    { message: "value is not equal to 'abc'", path: "", received: "" },
  ]);
  expect(validateType("abc", t.literal(""))).toEqual([
    { message: "value is not equal to ''", path: "", received: "abc" },
  ]);
  expect(validateType(123, t.literal(""))).toEqual([
    { message: "value is not equal to ''", path: "", received: 123 },
  ]);
  expect(validateType("", t.literal(123))).toEqual([
    { message: "value is not equal to 123", path: "", received: "" },
  ]);
  expect(validateType(true, t.literal(true))).toEqual([]);
  expect(validateType(false, t.literal(true))).toEqual([
    { message: "value is not equal to true", path: "", received: false },
  ]);
  expect(validateType(null, t.literal(null))).toEqual([]);
  expect(validateType(true, t.literal(null))).toEqual([
    { message: "value is not equal to null", path: "", received: true },
  ]);
  expect(validateType(null, t.literal(false))).toEqual([
    { message: "value is not equal to false", path: "", received: null },
  ]);
  expect(validateType(undefined, t.literal(undefined))).toEqual([]);
  expect(validateType(123, t.literal(undefined))).toEqual([
    { message: "value is not equal to undefined", path: "", received: 123 },
  ]);
  expect(validateType("abc", t.literal(undefined))).toEqual([
    { message: "value is not equal to undefined", path: "", received: "abc" },
  ]);
  expect(validateType(null, t.literal(undefined))).toEqual([
    { message: "value is not equal to undefined", path: "", received: null },
  ]);
});

test("number", () => {
  expect(validateType(123, t.number())).toEqual([]);
  expect(validateType(987, t.number())).toEqual([]);
  expect(validateType(true, t.number())).toEqual([
    { message: "value is not a number", path: "", received: true },
  ]);
  expect(validateType(false, t.number())).toEqual([
    { message: "value is not a number", path: "", received: false },
  ]);
  expect(validateType("", t.number())).toEqual([
    { message: "value is not a number", path: "", received: "" },
  ]);
  expect(validateType("abc", t.number())).toEqual([
    { message: "value is not a number", path: "", received: "abc" },
  ]);
  expect(validateType(undefined, t.number())).toEqual([
    { message: "value is not a number", path: "", received: undefined },
  ]);
  expect(validateType(null, t.number())).toEqual([
    { message: "value is not a number", path: "", received: null },
  ]);
  expect(validateType({}, t.number())).toEqual([
    { message: "value is not a number", path: "", received: {} },
  ]);
  expect(validateType([], t.number())).toEqual([
    { message: "value is not a number", path: "", received: [] },
  ]);
  expect(validateType(A, t.number())).toEqual([
    { message: "value is not a number", path: "", received: A },
  ]);
  expect(validateType(new A(), t.number())).toEqual([
    { message: "value is not a number", path: "", received: new A() },
  ]);
});

describe("object", () => {
  test("shaped object", () => {
    expect(validateType(123, t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: 123 },
    ]);
    expect(validateType("abc", t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: "abc" },
    ]);
    expect(validateType(true, t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: true },
    ]);
    expect(validateType(null, t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: null },
    ]);
    expect(validateType(undefined, t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: undefined },
    ]);
    expect(validateType([], t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: [] },
    ]);
    const arrowFn = () => {};
    expect(validateType(arrowFn, t.object({}))).toEqual([
      { message: "value is not an object", path: "", received: arrowFn },
    ]);
    expect(validateType({}, t.object({}))).toEqual([]);
    expect(validateType({ a: 1 }, t.object({}))).toEqual([]);
    expect(validateType({ a: 1 }, t.object({ a: t.number() }))).toEqual([]);
    expect(validateType({ a: 1 }, t.object({ a: t.string() }))).toEqual([
      { message: "value is not a string", path: "a", received: 1 },
    ]);
    expect(validateType({ b: 1 }, t.object({ a: t.string() }))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["a"], received: { b: 1 } },
    ]);
    expect(validateType({ a: 1, b: "b" }, t.object({ b: t.string() }))).toEqual([]);
  });

  test("shaped object with optional key", () => {
    expect(validateType({}, t.object({ a: t.number() }))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["a"], received: {} },
    ]);
    expect(validateType({}, t.object({ a: t.number().optional() }))).toEqual([]);
    expect(validateType({}, t.object({ a: t.number(), b: t.number().optional() }))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["a"], received: {} },
    ]);
    expect(validateType({ a: 1 }, t.object({ a: t.number(), b: t.number().optional() }))).toEqual([]);
    expect(
      validateType({ a: 1, b: 1 }, t.object({ a: t.number(), b: t.number().optional() }))
    ).toEqual([]);
    expect(
      validateType({ a: 1, b: "abc" }, t.object({ a: t.number(), b: t.number().optional() }))
    ).toEqual([{ message: "value is not a number", path: "b", received: "abc" }]);
  });

  test("shaped object with nested object", () => {
    const type = t.object({
      a: t.number(),
      b: t.object({
        c: t.string(),
      }),
    });

    expect(validateType({}, type)).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["a", "b"], received: {} },
    ]);
    expect(validateType({ a: 1 }, type)).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: 1 } },
    ]);
    expect(validateType({ a: 1, b: 1 }, type)).toEqual([
      { message: "value is not an object", path: "b", received: 1 },
    ]);
    expect(validateType({ a: 1, b: {} }, type)).toEqual([
      { message: "object value has missing keys", path: "b", missingKeys: ["c"], received: {} },
    ]);
    expect(validateType({ a: 1, b: { c: "" } }, type)).toEqual([]);
    expect(validateType({ a: "", b: { c: "" } }, type)).toEqual([
      { message: "value is not a number", path: "a", received: "" },
    ]);
    expect(validateType({ a: 1, b: { c: 123 } }, type)).toEqual([
      { message: "value is not a string", path: "b > c", received: 123 },
    ]);
  });

  test("keyed object", () => {
    expect(validateType("abc", t.object(["a", "b"]))).toEqual([
      { message: "value is not an object", path: "", received: "abc" },
    ]);
    expect(validateType(123, t.object(["a", "b"]))).toEqual([
      { message: "value is not an object", path: "", received: 123 },
    ]);
    expect(validateType(true, t.object(["a", "b"]))).toEqual([
      { message: "value is not an object", path: "", received: true },
    ]);
    expect(validateType({}, t.object(["a", "b"]))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["a", "b"], received: {} },
    ]);
    expect(validateType({ a: "abc" }, t.object(["a", "b"]))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: "abc" } },
    ]);
    expect(validateType({ a: "abc", b: "def" }, t.object(["a", "b"]))).toEqual([]);
    expect(validateType({ a: 123 }, t.object(["a", "b"]))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: 123 } },
    ]);
    expect(validateType({ a: 123, b: "def" }, t.object(["a", "b"]))).toEqual([]);
    expect(validateType({ a: 123, b: 123 }, t.object(["a", "b"]))).toEqual([]);
  });

  test("optional keys use the shape form (the keyed form is all-required)", () => {
    const type = t.object({ a: t.any(), b: t.any().optional() });
    expect(validateType({}, type)).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["a"], received: {} },
    ]);
    expect(validateType({ a: "abc" }, type)).toEqual([]);
    expect(validateType({ a: "abc", b: "def" }, type)).toEqual([]);
    expect(validateType({ a: 123 }, type)).toEqual([]);
    expect(validateType({ a: 123, b: 123 }, type)).toEqual([]);
    expect(validateType({ a: 123 }, t.object(["a", "b"]))).toEqual([
      { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: 123 } },
    ]);
  });

  test("keyed object with additional keys", () => {
    expect(validateType({ a: "abc", b: "def", c: "ghi" }, t.object(["a", "b"]))).toEqual([]);
    expect(validateType({ a: "abc", b: "def", d: "jkl" }, t.object(["a", "b"]))).toEqual([]);
  });
});

describe("promise", () => {
  test("promise", () => {
    expect(validateType(123, t.promise())).toEqual([
      { message: "value is not a promise", path: "", received: 123 },
    ]);
    expect(validateType("abc", t.promise())).toEqual([
      { message: "value is not a promise", path: "", received: "abc" },
    ]);
    expect(validateType(true, t.promise())).toEqual([
      { message: "value is not a promise", path: "", received: true },
    ]);
    expect(validateType(Promise.resolve(), t.promise())).toEqual([]);
  });

  test("return type is not checked", () => {
    expect(validateType(Promise.resolve(""), t.promise(t.string()))).toEqual([]);
    expect(validateType(Promise.resolve(123), t.promise(t.string()))).toEqual([]);
    expect(validateType(Promise.resolve(true), t.promise(t.string()))).toEqual([]);
  });
});

test("signal", () => {
  expect(validateType(123, t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: 123 },
  ]);
  expect(validateType("abc", t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: "abc" },
  ]);
  expect(validateType(true, t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: true },
  ]);
  const arrowFn = () => {};
  expect(validateType(arrowFn, t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: arrowFn },
  ]);
  const fn = function () {};
  expect(validateType(fn, t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: fn },
  ]);
  expect(validateType(A, t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: A },
  ]);
  class B {
    set() {}
  }
  expect(validateType(B, t.signal(t.string()))).toEqual([
    { message: "value is not a reactive value", path: "", received: B },
  ]);
  expect(validateType(signal(1), t.signal(t.number()))).toEqual([]);
  expect(
    validateType(
      computed(() => 1),
      t.signal(t.number())
    )
  ).toEqual([]);
});

test("record", () => {
  expect(validateType("abc", t.record(t.string()))).toEqual([
    { message: "value is not an object", path: "", received: "abc" },
  ]);
  expect(validateType(123, t.record(t.string()))).toEqual([
    { message: "value is not an object", path: "", received: 123 },
  ]);
  expect(validateType(true, t.record(t.string()))).toEqual([
    { message: "value is not an object", path: "", received: true },
  ]);
  expect(validateType({}, t.record(t.string()))).toEqual([]);
  expect(validateType({ a: "abc" }, t.record(t.string()))).toEqual([]);
  expect(validateType({ a: "abc", b: "def" }, t.record(t.string()))).toEqual([]);
  expect(validateType({ a: 123 }, t.record(t.string()))).toEqual([
    { message: "value is not a string", path: "a", received: 123 },
  ]);
  expect(validateType({ a: 123, b: "def" }, t.record(t.string()))).toEqual([
    { message: "value is not a string", path: "a", received: 123 },
  ]);
  expect(validateType({ a: 123, b: 123 }, t.record(t.string()))).toEqual([
    { message: "value is not a string", path: "a", received: 123 },
    { message: "value is not a string", path: "b", received: 123 },
  ]);
  expect(validateType({ a: 123, b: 123 }, t.record(t.number()))).toEqual([]);
});

test("ref", () => {
  // requires a DOM: throws when HTMLElement is not defined
  expect(() => t.ref()).toThrow("Cannot use ref in a non-DOM environment");

  class FakeHTMLElement {}
  (globalThis as any).HTMLElement = FakeHTMLElement;
  try {
    class FakeHTMLDivElement extends FakeHTMLElement {}
    const el = new FakeHTMLElement();

    // no argument: accepts null or any HTMLElement (or subclass)
    expect(validateType(null, t.ref())).toEqual([]);
    expect(validateType(el, t.ref())).toEqual([]);
    expect(validateType(new FakeHTMLDivElement(), t.ref())).toEqual([]);
    expect(validateType(123, t.ref())).toEqual([
      {
        message: "value does not match union type",
        path: "",
        received: 123,
        subIssues: [
          { message: "value is not equal to null", path: "", received: 123 },
          { message: "value is not an instance of 'FakeHTMLElement'", path: "", received: 123 },
        ],
      },
    ]);

    // with a constructor: narrows to that element type
    expect(validateType(null, t.ref(FakeHTMLDivElement as any))).toEqual([]);
    expect(validateType(new FakeHTMLDivElement(), t.ref(FakeHTMLDivElement as any))).toEqual([]);
    expect(validateType(el, t.ref(FakeHTMLDivElement as any))).toEqual([
      {
        message: "value does not match union type",
        path: "",
        received: el,
        subIssues: [
          { message: "value is not equal to null", path: "", received: el },
          { message: "value is not an instance of 'FakeHTMLDivElement'", path: "", received: el },
        ],
      },
    ]);
  } finally {
    delete (globalThis as any).HTMLElement;
  }
});

test("strictObject", () => {
  expect(validateType("", t.strictObject({}))).toEqual([
    { message: "value is not an object", path: "", received: "" },
  ]);
  expect(validateType(1, t.strictObject({}))).toEqual([
    { message: "value is not an object", path: "", received: 1 },
  ]);
  expect(validateType({}, t.strictObject({}))).toEqual([]);
  expect(validateType({ a: 1 }, t.strictObject({}))).toEqual([
    { message: "object value has unknown keys", path: "", unknownKeys: ["a"], received: { a: 1 } },
  ]);
  expect(validateType({}, t.strictObject({ a: t.number() }))).toEqual([
    { message: "object value has missing keys", path: "", missingKeys: ["a"], received: {} },
  ]);
  expect(validateType({ a: 1 }, t.strictObject({ a: t.number() }))).toEqual([]);
});

test("string", () => {
  expect(validateType("", t.string())).toEqual([]);
  expect(validateType("abc", t.string())).toEqual([]);
  expect(validateType(new String("abc"), t.string())).toEqual([]);
  class M extends String {}
  expect(validateType(new M("abc"), t.string())).toEqual([]);
  expect(validateType(123, t.string())).toEqual([
    { message: "value is not a string", path: "", received: 123 },
  ]);
  expect(validateType(987, t.string())).toEqual([
    { message: "value is not a string", path: "", received: 987 },
  ]);
  expect(validateType(true, t.string())).toEqual([
    { message: "value is not a string", path: "", received: true },
  ]);
  expect(validateType(false, t.string())).toEqual([
    { message: "value is not a string", path: "", received: false },
  ]);
  expect(validateType(undefined, t.string())).toEqual([
    { message: "value is not a string", path: "", received: undefined },
  ]);
  expect(validateType(null, t.string())).toEqual([
    { message: "value is not a string", path: "", received: null },
  ]);
  expect(validateType({}, t.string())).toEqual([
    { message: "value is not a string", path: "", received: {} },
  ]);
  expect(validateType([], t.string())).toEqual([
    { message: "value is not a string", path: "", received: [] },
  ]);
  expect(validateType(A, t.string())).toEqual([
    { message: "value is not a string", path: "", received: A },
  ]);
  expect(validateType(new A(), t.string())).toEqual([
    { message: "value is not a string", path: "", received: new A() },
  ]);
});

test("tuple", () => {
  expect(validateType(["abc"], t.tuple([t.string()]))).toEqual([]);
  expect(validateType([], t.tuple([t.string()]))).toEqual([
    { message: "tuple value does not have the correct length", path: "", received: [] },
  ]);
  expect(validateType([123], t.tuple([t.string()]))).toEqual([
    { message: "value is not a string", path: "0", received: 123 },
  ]);
  expect(validateType(["abc", 123], t.tuple([t.string()]))).toEqual([
    { message: "tuple value does not have the correct length", path: "", received: ["abc", 123] },
  ]);
  expect(validateType("", t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not an array", path: "", received: "" },
  ]);
  expect(validateType("abc", t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not an array", path: "", received: "abc" },
  ]);
  expect(validateType(123, t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not an array", path: "", received: 123 },
  ]);
  expect(validateType(987, t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not an array", path: "", received: 987 },
  ]);
  expect(validateType(true, t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not an array", path: "", received: true },
  ]);
  expect(validateType({}, t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not an array", path: "", received: {} },
  ]);
  expect(validateType(["abc", 123], t.tuple([t.string(), t.number()]))).toEqual([]);
  expect(validateType([123, "abc"], t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not a string", path: "0", received: 123 },
    { message: "value is not a number", path: "1", received: "abc" },
  ]);
  expect(validateType(["abc"], t.tuple([t.string(), t.number()]))).toEqual([
    { message: "tuple value does not have the correct length", path: "", received: ["abc"] },
  ]);
  expect(validateType([123], t.tuple([t.string(), t.number()]))).toEqual([
    { message: "tuple value does not have the correct length", path: "", received: [123] },
  ]);
  expect(validateType(["abc", true], t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not a number", path: "1", received: true },
  ]);
  expect(validateType([true, 123], t.tuple([t.string(), t.number()]))).toEqual([
    { message: "value is not a string", path: "0", received: true },
  ]);
  expect(validateType(["abc", 123, true], t.tuple([t.string(), t.number()]))).toEqual([
    { message: "tuple value does not have the correct length", path: "", received: ["abc", 123, true] },
  ]);
  expect(validateType(["abc", 123, true], t.tuple([t.string(), t.number(), t.boolean()]))).toEqual(
    []
  );
  expect(
    validateType(["abc", 123, 123], t.tuple([t.string(), t.number(), t.boolean()]))
  ).toEqual([{ message: "value is not a boolean", path: "2", received: 123 }]);
});

test("or", () => {
  expect(validateType("", t.or([t.string(), t.number()]))).toEqual([]);
  expect(validateType("abc", t.or([t.string(), t.number()]))).toEqual([]);
  expect(validateType(123, t.or([t.string(), t.number()]))).toEqual([]);
  expect(validateType(987, t.or([t.string(), t.number()]))).toEqual([]);
  expect(validateType(true, t.or([t.string(), t.number()]))).toEqual([
    {
      message: "value does not match union type",
      path: "",
      received: true,
      subIssues: [
        { message: "value is not a string", path: "", received: true },
        { message: "value is not a number", path: "", received: true },
      ],
    },
  ]);
  expect(validateType({}, t.or([t.string(), t.number()]))).toEqual([
    {
      message: "value does not match union type",
      path: "",
      received: {},
      subIssues: [
        { message: "value is not a string", path: "", received: {} },
        { message: "value is not a number", path: "", received: {} },
      ],
    },
  ]);
  expect(validateType([], t.or([t.string(), t.number()]))).toEqual([
    {
      message: "value does not match union type",
      path: "",
      received: [],
      subIssues: [
        { message: "value is not a string", path: "", received: [] },
        { message: "value is not a number", path: "", received: [] },
      ],
    },
  ]);
  expect(validateType([], t.or([t.string(), t.array(t.number())]))).toEqual([]);
  expect(validateType([""], t.or([t.string(), t.array(t.number())]))).toEqual([
    { message: "value is not a number", path: "0", received: "" },
  ]);
});

test("union of a nested union and an array", () => {
  // a nested union failing must not stop the outer union from trying its
  // remaining members: its probe failures are not deep failures
  const nullable = t.or([t.literal(false), t.literal(null)]);
  const type = t.or([nullable, t.array(nullable)]);
  expect(validateType(false, type)).toEqual([]);
  expect(validateType(null, type)).toEqual([]);
  expect(validateType([false], type)).toEqual([]);
  expect(validateType([null, false], type)).toEqual([]);
  expect(validateType("x", type)).toEqual([
    {
      message: "value does not match union type",
      path: "",
      received: "x",
      subIssues: [
        {
          message: "value does not match union type",
          path: "",
          received: "x",
          subIssues: [
            { message: "value is not equal to false", path: "", received: "x" },
            { message: "value is not equal to null", path: "", received: "x" },
          ],
        },
        { message: "value is not an array", path: "", received: "x" },
      ],
    },
  ]);
  // an element failing inside the array is a deep failure: it is reported
  // directly, as the best matching member
  expect(validateType([1], type)).toEqual([
    {
      message: "value does not match union type",
      path: "0",
      received: 1,
      subIssues: [
        { message: "value is not equal to false", path: "0", received: 1 },
        { message: "value is not equal to null", path: "0", received: 1 },
      ],
    },
  ]);
});

test("complex type", () => {
  const complexType = t.object({
    a: t.number().optional(),
    b: t.array(
      t.object({
        a: t.instanceOf(A),
        b: t.or([t.number(), t.literal(false)]).optional(),
        c: t.tuple([t.string(), t.string()]),
      })
    ),
  });

  expect(validateType(1, complexType)).toEqual([{ message: "value is not an object", path: "", received: 1 }]);
  expect(validateType("", complexType)).toEqual([{ message: "value is not an object", path: "", received: "" }]);
  expect(validateType([], complexType)).toEqual([{ message: "value is not an object", path: "", received: [] }]);
  expect(validateType(null, complexType)).toEqual([{ message: "value is not an object", path: "", received: null }]);
  expect(validateType({}, complexType)).toEqual([
    { message: "object value has missing keys", path: "", missingKeys: ["b"], received: {} },
  ]);
  expect(validateType({ a: "" }, complexType)).toEqual([
    { message: "value is not a number", path: "a", received: "" },
    { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: "" } },
  ]);
  expect(validateType({ a: 1 }, complexType)).toEqual([
    { message: "object value has missing keys", path: "", missingKeys: ["b"], received: { a: 1 } },
  ]);
  expect(validateType({ b: {} }, complexType)).toEqual([
    { message: "value is not an array", path: "b", received: {} },
  ]);
  expect(
    validateType(
      {
        b: [{ a: 1, c: ["a", "b", "c"] }],
      },
      complexType
    )
  ).toEqual([
    { message: "value is not an instance of 'A'", path: "b > 0 > a", received: 1 },
    { message: "tuple value does not have the correct length", path: "b > 0 > c", received: ["a", "b", "c"] },
  ]);
  expect(
    validateType(
      {
        b: [{ a: new A(), c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual([]);
  expect(
    validateType(
      {
        a: 123,
        b: [{ a: new A(), c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual([]);
  expect(
    validateType(
      {
        a: 123,
        b: [{ a: new A(), b: false, c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual([]);
  expect(
    validateType(
      {
        a: 123,
        b: [{ a: new A(), b: 123, c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual([]);
});

test("assert wrong object and circular reference", () => {
  const type = t.object({
    str: t.string(),
    circular: t.any(),
  });

  const circular = {
    a: {} as any,
  };
  circular.a.circle = circular;
  expect(() => {
    assertType({ circular }, type);
  }).toThrow(`Value does not match the type
[
  {
    "received": {
      "circular": {
        "a": {
          "circle": "[Known object]"
        }
      }
    },
    "path": "",
    "message": "object value has missing keys",
    "missingKeys": [
      "str"
    ]
  }
]`
  );
});

test("assert class instance", () => {
  class A {}
  expect(() => {
    assertType({ a: new A() }, t.object({ a: t.number() }));
  }).toThrow(`Value does not match the type
[
  {
    "received": "[Instance of A]",
    "path": "a",
    "message": "value is not a number"
  }
]`
  );
});

test("assertType path is not hidden", () => {
  const obj = {};
  expect(() => {
    assertType({ v: obj }, t.object({ v: t.or([t.string(), t.number()]) }));
  }).toThrow(`Value does not match the type
[
  {
    "received": {},
    "path": "v",
    "message": "value does not match union type",
    "subIssues": [
      {
        "received": "[Known object]",
        "path": "v",
        "message": "value is not a string"
      },
      {
        "received": "[Known object]",
        "path": "v",
        "message": "value is not a number"
      }
    ]
  }
]`
  );
});

describe(".optional()", () => {
  test("validates the wrapped type, accepts undefined", () => {
    const type = t.number().optional(3);
    expect(validateType(undefined, type)).toEqual([]);
    expect(validateType(5, type)).toEqual([]);
    expect(validateType("abc", type)).toEqual([
      { message: "value is not a number", path: "", received: "abc" },
    ]);
  });

  test("a key with a default may be omitted", () => {
    const type = t.object({ delay: t.number().optional(500) });
    expect(validateType({}, type)).toEqual([]);
    expect(validateType({ delay: 100 }, type)).toEqual([]);
    expect(validateType({ delay: "abc" }, type)).toEqual([
      { message: "value is not a number", path: "delay", received: "abc" },
    ]);
  });

  test("validates the present value of an optional key", () => {
    const type = t.object({ delay: t.number().optional() });
    expect(validateType({}, type)).toEqual([]);
    expect(validateType({ delay: 100 }, type)).toEqual([]);
    expect(validateType({ delay: "abc" }, type)).toEqual([
      { message: "value is not a number", path: "delay", received: "abc" },
    ]);
  });

  test("optional keys are known to strict objects", () => {
    const type = t.strictObject({ delay: t.number().optional() });
    expect(validateType({}, type)).toEqual([]);
    expect(validateType({ delay: 100 }, type)).toEqual([]);
    expect(validateType({ other: 1 }, type)).toEqual([
      {
        message: "object value has unknown keys",
        path: "",
        received: { other: 1 },
        unknownKeys: ["other"],
      },
    ]);
  });

  test("a top level optional type accepts undefined", () => {
    const type = t.number().optional();
    expect(validateType(undefined, type)).toEqual([]);
    expect(validateType(5, type)).toEqual([]);
    expect(validateType("abc", type)).toEqual([
      { message: "value is not a number", path: "", received: "abc" },
    ]);
  });

  test("defaulted keys are known to strict objects", () => {
    const type = t.strictObject({ delay: t.number().optional(500) });
    expect(validateType({}, type)).toEqual([]);
    expect(validateType({ delay: 100 }, type)).toEqual([]);
    expect(validateType({ other: 1 }, type)).toEqual([
      {
        message: "object value has unknown keys",
        path: "",
        received: { other: 1 },
        unknownKeys: ["other"],
      },
    ]);
  });

  test("getDefault returns the default factory", () => {
    expect(getDefault(t.number().optional(3))!()).toBe(3);
    expect(getDefault(t.array(t.number()).optional(() => [1]))!()).toEqual([1]);
    expect(getDefault(t.number())).toBeUndefined();
    expect(getDefault(null)).toBeUndefined();
  });
});

describe("applyDefaults", () => {
  test("fills in a top level default", () => {
    expect(applyDefaults(undefined, t.number().optional(3))).toBe(3);
    expect(applyDefaults(5, t.number().optional(3))).toBe(5);
    expect(applyDefaults(undefined, t.number())).toBe(undefined);
  });

  test("fills in nested defaults without mutating the input", () => {
    const type = t.object({
      config: t.object({
        depth: t.number().optional(3),
        name: t.string(),
      }),
    });
    const value = { config: { name: "abc" } };
    const result = applyDefaults(value, type);
    expect(result).toEqual({ config: { depth: 3, name: "abc" } });
    expect(value).toEqual({ config: { name: "abc" } });
    expect(result).not.toBe(value);
  });

  test("returns the input as is when there is nothing to fill in", () => {
    const type = t.object({ depth: t.number().optional(3) });
    const value = { depth: 5 };
    expect(applyDefaults(value, type)).toBe(value);
  });

  test("a default object is itself filled in recursively, without being mutated", () => {
    const defaultValue = {};
    const type = t
      .object({ depth: t.number().optional(3), name: t.string().optional() })
      .optional(defaultValue);
    expect(applyDefaults(undefined, type)).toEqual({ depth: 3 });
    expect(defaultValue).toEqual({});
  });

  test("factories are called for each application", () => {
    const type = t.array(t.number()).optional(() => []);
    const a = applyDefaults(undefined, type);
    const b = applyDefaults(undefined, type);
    expect(a).toEqual([]);
    expect(a).not.toBe(b);
  });

  test("a plain default value is used as is", () => {
    const defaultValue: number[] = [];
    const type = t.array(t.number()).optional(defaultValue);
    expect(applyDefaults(undefined, type)).toBe(defaultValue);
  });

  test("fills in tuple positions", () => {
    const type = t.tuple([t.string(), t.number().optional(3)]);
    const value: any[] = ["abc", undefined];
    expect(applyDefaults(value, type)).toEqual(["abc", 3]);
    expect(value).toEqual(["abc", undefined]);
  });

  test("fills in array elements without mutating the input", () => {
    const type = t.object({
      a: t.array(t.object({ n: t.number().optional(1) })),
    });
    const value = { a: [{}, { n: 2 }, { b: true }] };
    const result = applyDefaults(value, type);
    expect(result).toEqual({ a: [{ n: 1 }, { n: 2 }, { b: true, n: 1 }] });
    expect(value).toEqual({ a: [{}, { n: 2 }, { b: true }] });
    expect(result.a[1]).toBe(value.a[1]);
  });

  test("returns an array as is when there is nothing to fill in", () => {
    const type = t.array(t.object({ n: t.number().optional(1) }));
    const value = [{ n: 2 }, { n: 3 }];
    expect(applyDefaults(value, type)).toBe(value);
  });

  test("fills in defaults through an optional wrapper", () => {
    const type = t.object({
      config: t.object({ depth: t.number().optional(3) }).optional(),
    });
    expect(applyDefaults({ config: {} }, type)).toEqual({ config: { depth: 3 } });
    expect(applyDefaults({}, type)).toEqual({});
  });
});
