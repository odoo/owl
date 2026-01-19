import { signal } from "../src/runtime/reactivity/signal";
import { ValidationIssue, types as t } from "../src/runtime/types";
import { assertType, validateType } from "../src/runtime/validation";

// REMOVE ME WHEN API IS DECIDED
const ISSUE: ValidationIssue = { message: "Validation issue" };
const NO_ISSUE: ValidationIssue[] = [];

class A {}

test("simple assertion", () => {
  expect(() => assertType("hey", t.string)).not.toThrow();
  expect(() => assertType({}, t.object())).not.toThrow();
  expect(() => assertType([], t.array())).not.toThrow();
  expect(() => assertType(1, t.boolean)).toThrow("Value does not match the type");
});

test("validateType", () => {
  expect(validateType("abc", t.string)).toEqual(NO_ISSUE);
  expect(validateType("abc", t.number)).toEqual([ISSUE]);
  expect(validateType(undefined, t.number)).toEqual([ISSUE]);
  expect(validateType(1, t.number)).toEqual(NO_ISSUE);
});

test("any", () => {
  expect(validateType("", t.any)).toEqual(NO_ISSUE);
  expect(validateType("abc", t.any)).toEqual(NO_ISSUE);
  expect(validateType(true, t.any)).toEqual(NO_ISSUE);
  expect(validateType(false, t.any)).toEqual(NO_ISSUE);
  expect(validateType(123, t.any)).toEqual(NO_ISSUE);
  expect(validateType(987, t.any)).toEqual(NO_ISSUE);
  expect(validateType(undefined, t.any)).toEqual(NO_ISSUE);
  expect(validateType(null, t.any)).toEqual(NO_ISSUE);
  expect(validateType({}, t.any)).toEqual(NO_ISSUE);
  expect(validateType({ a: 1, b: "", c: { a: true } }, t.any)).toEqual(NO_ISSUE);
  expect(validateType([{ a: 1 }, { b: 2 }], t.any)).toEqual(NO_ISSUE);
  expect(validateType(() => {}, t.any)).toEqual(NO_ISSUE);
  expect(validateType(A, t.any)).toEqual(NO_ISSUE);
  expect(validateType(new A(), t.any)).toEqual(NO_ISSUE);
});

test("array", () => {
  expect(validateType({}, t.array())).toEqual([ISSUE]);
  expect(validateType("", t.array())).toEqual([ISSUE]);
  expect(validateType("abc", t.array())).toEqual([ISSUE]);
  expect(validateType(123, t.array())).toEqual([ISSUE]);
  expect(validateType(987, t.array())).toEqual([ISSUE]);
  expect(validateType(true, t.array())).toEqual([ISSUE]);
  expect(validateType({}, t.array())).toEqual([ISSUE]);
  expect(validateType([], t.array())).toEqual(NO_ISSUE);
  expect(validateType([123], t.array())).toEqual(NO_ISSUE);
  expect(validateType(["abc"], t.array())).toEqual(NO_ISSUE);
  expect(validateType(["abc", 123], t.array())).toEqual(NO_ISSUE);
  expect(validateType(["abc", 123, false], t.array())).toEqual(NO_ISSUE);
  expect(validateType(["abc"], t.array(t.string))).toEqual(NO_ISSUE);
  expect(validateType([123, "abc"], t.array(t.string))).toEqual([ISSUE]);
  expect(validateType(["abc", "def"], t.array(t.string))).toEqual(NO_ISSUE);
  expect(validateType(["abc", 321], t.array(t.string))).toEqual([ISSUE]);
});

test("boolean", () => {
  expect(validateType(true, t.boolean)).toEqual(NO_ISSUE);
  expect(validateType(false, t.boolean)).toEqual(NO_ISSUE);
  expect(validateType("", t.boolean)).toEqual([ISSUE]);
  expect(validateType("abc", t.boolean)).toEqual([ISSUE]);
  expect(validateType(123, t.boolean)).toEqual([ISSUE]);
  expect(validateType(987, t.boolean)).toEqual([ISSUE]);
  expect(validateType(undefined, t.boolean)).toEqual([ISSUE]);
  expect(validateType(null, t.boolean)).toEqual([ISSUE]);
  expect(validateType({}, t.boolean)).toEqual([ISSUE]);
  expect(validateType([], t.boolean)).toEqual([ISSUE]);
  expect(validateType(A, t.boolean)).toEqual([ISSUE]);
  expect(validateType(new A(), t.boolean)).toEqual([ISSUE]);
});

test("constructor", () => {
  class B extends A {}
  class C {}
  expect(validateType(true, t.constructor(A))).toEqual([ISSUE]);
  expect(validateType("abc", t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(123, t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(A, t.constructor(A))).toEqual(NO_ISSUE);
  expect(validateType(B, t.constructor(A))).toEqual(NO_ISSUE);
  expect(validateType(C, t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(A, t.constructor(B))).toEqual([ISSUE]);
  expect(validateType(B, t.constructor(B))).toEqual(NO_ISSUE);
  expect(validateType(C, t.constructor(B))).toEqual([ISSUE]);
  expect(validateType(A, t.constructor(C))).toEqual([ISSUE]);
  expect(validateType(B, t.constructor(C))).toEqual([ISSUE]);
  expect(validateType(C, t.constructor(C))).toEqual(NO_ISSUE);
  expect(validateType({}, t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(new A(), t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(new B(), t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(new C(), t.constructor(A))).toEqual([ISSUE]);
  expect(validateType([], t.constructor(A))).toEqual([ISSUE]);
  expect(validateType(() => {}, t.constructor(A))).toEqual([ISSUE]);
});

describe("function", () => {
  test("function", () => {
    expect(validateType(123, t.function())).toEqual([ISSUE]);
    expect(validateType("abc", t.function())).toEqual([ISSUE]);
    expect(validateType(true, t.function())).toEqual([ISSUE]);
    expect(validateType(() => {}, t.function())).toEqual(NO_ISSUE);
    expect(validateType(function () {}, t.function())).toEqual(NO_ISSUE);
    expect(validateType(A, t.function())).toEqual(NO_ISSUE); // Should return an issue
  });

  test("parameters and return types are not checked", () => {
    expect(validateType(() => {}, t.function([t.string], t.boolean))).toEqual(NO_ISSUE);
    expect(validateType(function () {}, t.function([t.string], t.boolean))).toEqual(NO_ISSUE);
  });
});

test("instanceOf", () => {
  class B extends A {}
  class C {}
  expect(validateType(123, t.instanceOf(A))).toEqual([ISSUE]);
  expect(validateType("abc", t.instanceOf(A))).toEqual([ISSUE]);
  expect(validateType(true, t.instanceOf(A))).toEqual([ISSUE]);
  expect(validateType({}, t.instanceOf(A))).toEqual([ISSUE]);
  expect(validateType([], t.instanceOf(A))).toEqual([ISSUE]);
  expect(validateType(new A(), t.instanceOf(A))).toEqual(NO_ISSUE);
  expect(validateType(new B(), t.instanceOf(A))).toEqual(NO_ISSUE);
  expect(validateType(new C(), t.instanceOf(A))).toEqual([ISSUE]);
});

describe("keys", () => {
  test("keys", () => {
    expect(validateType("abc", t.keys(["a", "b"]))).toEqual([ISSUE]);
    expect(validateType(123, t.keys(["a", "b"]))).toEqual([ISSUE]);
    expect(validateType(true, t.keys(["a", "b"]))).toEqual([ISSUE]);
    expect(validateType({}, t.keys(["a", "b"]))).toEqual([ISSUE]);
    expect(validateType({ a: "abc" }, t.keys(["a", "b"]))).toEqual([ISSUE]);
    expect(validateType({ a: "abc", b: "def" }, t.keys(["a", "b"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: 123 }, t.keys(["a", "b"]))).toEqual([ISSUE]);
    expect(validateType({ a: 123, b: "def" }, t.keys(["a", "b"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: 123, b: 123 }, t.keys(["a", "b"]))).toEqual(NO_ISSUE);
  });

  test("optional keys", () => {
    expect(validateType({}, t.keys(["a", "b?"]))).toEqual([ISSUE]);
    expect(validateType({ a: "abc" }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: "abc", b: "def" }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: 123 }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: 123, b: "def" }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: 123, b: 123 }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: 123, b: 123 }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
  });

  test("additional keys", () => {
    expect(validateType({ a: "abc", b: "def", c: "ghi" }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: "abc", c: "ghi" }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
    expect(validateType({ a: "abc", d: "jkl" }, t.keys(["a", "b?"]))).toEqual(NO_ISSUE);
  });
});

test("literal", () => {
  expect(validateType(123, t.literal(123))).toEqual(NO_ISSUE);
  expect(validateType(321, t.literal(123))).toEqual([ISSUE]);
  expect(validateType("abc", t.literal("abc"))).toEqual(NO_ISSUE);
  expect(validateType("", t.literal("abc"))).toEqual([ISSUE]);
  expect(validateType("abc", t.literal(""))).toEqual([ISSUE]);
  expect(validateType(123, t.literal(""))).toEqual([ISSUE]);
  expect(validateType("", t.literal(123))).toEqual([ISSUE]);
  expect(validateType(true, t.literal(true))).toEqual(NO_ISSUE);
  expect(validateType(false, t.literal(true))).toEqual([ISSUE]);
  expect(validateType(null, t.literal(null))).toEqual(NO_ISSUE);
  expect(validateType(true, t.literal(null))).toEqual([ISSUE]);
  expect(validateType(null, t.literal(false))).toEqual([ISSUE]);
  expect(validateType(undefined, t.literal(undefined))).toEqual(NO_ISSUE);
  expect(validateType(123, t.literal(undefined))).toEqual([ISSUE]);
  expect(validateType("abc", t.literal(undefined))).toEqual([ISSUE]);
  expect(validateType(null, t.literal(undefined))).toEqual([ISSUE]);
});

test("number", () => {
  expect(validateType(123, t.number)).toEqual(NO_ISSUE);
  expect(validateType(987, t.number)).toEqual(NO_ISSUE);
  expect(validateType(true, t.number)).toEqual([ISSUE]);
  expect(validateType(false, t.number)).toEqual([ISSUE]);
  expect(validateType("", t.number)).toEqual([ISSUE]);
  expect(validateType("abc", t.number)).toEqual([ISSUE]);
  expect(validateType(undefined, t.number)).toEqual([ISSUE]);
  expect(validateType(null, t.number)).toEqual([ISSUE]);
  expect(validateType({}, t.number)).toEqual([ISSUE]);
  expect(validateType([], t.number)).toEqual([ISSUE]);
  expect(validateType(A, t.number)).toEqual([ISSUE]);
  expect(validateType(new A(), t.number)).toEqual([ISSUE]);
});

describe("object", () => {
  test("object", () => {
    expect(validateType(123, t.object({}))).toEqual([ISSUE]);
    expect(validateType("abc", t.object({}))).toEqual([ISSUE]);
    expect(validateType(true, t.object({}))).toEqual([ISSUE]);
    expect(validateType(null, t.object({}))).toEqual([ISSUE]);
    expect(validateType(undefined, t.object({}))).toEqual([ISSUE]);
    expect(validateType([], t.object({}))).toEqual([ISSUE]);
    expect(validateType(() => {}, t.object({}))).toEqual([ISSUE]);
    expect(validateType({}, t.object({}))).toEqual(NO_ISSUE);
    expect(validateType({ a: 1 }, t.object({}))).toEqual(NO_ISSUE);
    expect(validateType({ a: 1 }, t.object({ a: t.number }))).toEqual(NO_ISSUE);
    expect(validateType({ a: 1 }, t.object({ a: t.string }))).toEqual([ISSUE]);
    expect(validateType({ b: 1 }, t.object({ a: t.string }))).toEqual([ISSUE]);
    expect(validateType({ a: 1, b: "b" }, t.object({ b: t.string }))).toEqual(NO_ISSUE);
  });

  test("optional key", () => {
    expect(validateType({}, t.object({ a: t.number }))).toEqual([ISSUE]);
    expect(validateType({}, t.object({ "a?": t.number }))).toEqual(NO_ISSUE);
    expect(validateType({}, t.object({ a: t.number, "b?": t.number }))).toEqual([ISSUE]);
    expect(validateType({ a: 1 }, t.object({ a: t.number, "b?": t.number }))).toEqual(NO_ISSUE);
    expect(validateType({ a: 1, b: 1 }, t.object({ a: t.number, "b?": t.number }))).toEqual(
      NO_ISSUE
    );
  });

  test("nested object", () => {
    const type = t.object({
      a: t.number,
      b: t.object({
        c: t.string,
      }),
    });

    expect(validateType({}, type)).toEqual([ISSUE]);
    expect(validateType({ a: 1 }, type)).toEqual([ISSUE]);
    expect(validateType({ a: 1, b: 1 }, type)).toEqual([ISSUE]);
    expect(validateType({ a: 1, b: {} }, type)).toEqual([ISSUE]);
    expect(validateType({ a: 1, b: { c: "" } }, type)).toEqual(NO_ISSUE);
    expect(validateType({ a: "", b: { c: "" } }, type)).toEqual([ISSUE]);
  });
});

describe("promise", () => {
  test("promise", () => {
    expect(validateType(123, t.promise())).toEqual([ISSUE]);
    expect(validateType("abc", t.promise())).toEqual([ISSUE]);
    expect(validateType(true, t.promise())).toEqual([ISSUE]);
    expect(validateType(Promise.resolve(), t.promise())).toEqual(NO_ISSUE);
  });

  test("return type is not checked", () => {
    expect(validateType(Promise.resolve(""), t.promise(t.string))).toEqual(NO_ISSUE);
    expect(validateType(Promise.resolve(123), t.promise(t.string))).toEqual(NO_ISSUE);
    expect(validateType(Promise.resolve(true), t.promise(t.string))).toEqual(NO_ISSUE);
  });
});

describe("reactiveValue", () => {
  expect(validateType(123, t.reactiveValue(t.string))).toEqual([ISSUE]);
  expect(validateType("abc", t.reactiveValue(t.string))).toEqual([ISSUE]);
  expect(validateType(true, t.reactiveValue(t.string))).toEqual([ISSUE]);
  expect(validateType(() => {}, t.reactiveValue(t.string))).toEqual(NO_ISSUE);
  expect(validateType(function () {}, t.reactiveValue(t.string))).toEqual(NO_ISSUE);
  expect(validateType(A, t.reactiveValue(t.string))).toEqual(NO_ISSUE); // Should return an issue
});

test("record", () => {
  expect(validateType("abc", t.record(t.string))).toEqual([ISSUE]);
  expect(validateType(123, t.record(t.string))).toEqual([ISSUE]);
  expect(validateType(true, t.record(t.string))).toEqual([ISSUE]);
  expect(validateType({}, t.record(t.string))).toEqual(NO_ISSUE);
  expect(validateType({ a: "abc" }, t.record(t.string))).toEqual(NO_ISSUE);
  expect(validateType({ a: "abc", b: "def" }, t.record(t.string))).toEqual(NO_ISSUE);
  expect(validateType({ a: 123 }, t.record(t.string))).toEqual([ISSUE]);
  expect(validateType({ a: 123, b: "def" }, t.record(t.string))).toEqual([ISSUE]);
  expect(validateType({ a: 123, b: 123 }, t.record(t.string))).toEqual([ISSUE, ISSUE]);
  expect(validateType({ a: 123, b: 123 }, t.record(t.number))).toEqual(NO_ISSUE);
});

describe("signal", () => {
  expect(validateType(123, t.signal(t.string))).toEqual([ISSUE]);
  expect(validateType("abc", t.signal(t.string))).toEqual([ISSUE]);
  expect(validateType(true, t.signal(t.string))).toEqual([ISSUE]);
  expect(validateType(() => {}, t.signal(t.string))).toEqual([ISSUE]);
  expect(validateType(function () {}, t.signal(t.string))).toEqual([ISSUE]);
  expect(validateType(A, t.signal(t.string))).toEqual([ISSUE]);
  expect(validateType(signal("abc"), t.signal(t.string))).toEqual(NO_ISSUE);
  expect(validateType(signal(123), t.signal(t.string))).toEqual(NO_ISSUE); // do not check value type
});

test("string", () => {
  expect(validateType("", t.string)).toEqual(NO_ISSUE);
  expect(validateType("abc", t.string)).toEqual(NO_ISSUE);
  expect(validateType(123, t.string)).toEqual([ISSUE]);
  expect(validateType(987, t.string)).toEqual([ISSUE]);
  expect(validateType(true, t.string)).toEqual([ISSUE]);
  expect(validateType(false, t.string)).toEqual([ISSUE]);
  expect(validateType(undefined, t.string)).toEqual([ISSUE]);
  expect(validateType(null, t.string)).toEqual([ISSUE]);
  expect(validateType({}, t.string)).toEqual([ISSUE]);
  expect(validateType([], t.string)).toEqual([ISSUE]);
  expect(validateType(A, t.string)).toEqual([ISSUE]);
  expect(validateType(new A(), t.string)).toEqual([ISSUE]);
});

test("tuple", () => {
  expect(validateType(["abc"], t.tuple([t.string]))).toEqual(NO_ISSUE);
  expect(validateType([], t.tuple([t.string]))).toEqual([ISSUE]);
  expect(validateType([123], t.tuple([t.string]))).toEqual([ISSUE]);
  expect(validateType(["abc", 123], t.tuple([t.string]))).toEqual([ISSUE]);
  expect(validateType({}, t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType("", t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType("abc", t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(123, t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(987, t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(true, t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType({}, t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType([], t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(["abc", 123], t.tuple([t.string, t.number]))).toEqual(NO_ISSUE);
  expect(validateType([123, "abc"], t.tuple([t.string, t.number]))).toEqual([ISSUE, ISSUE]);
  expect(validateType(["abc"], t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType([123], t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(["abc", true], t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType([true, 123], t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(["abc", 123, true], t.tuple([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType(["abc", 123, true], t.tuple([t.string, t.number, t.boolean]))).toEqual(
    NO_ISSUE
  );
  expect(validateType(["abc", 123, 123], t.tuple([t.string, t.number, t.boolean]))).toEqual([
    ISSUE,
  ]);
});

test("union", () => {
  expect(validateType("", t.union([t.string, t.number]))).toEqual(NO_ISSUE);
  expect(validateType("abc", t.union([t.string, t.number]))).toEqual(NO_ISSUE);
  expect(validateType(123, t.union([t.string, t.number]))).toEqual(NO_ISSUE);
  expect(validateType(987, t.union([t.string, t.number]))).toEqual(NO_ISSUE);
  expect(validateType(true, t.union([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType({}, t.union([t.string, t.number]))).toEqual([ISSUE]);
  expect(validateType([], t.union([t.string, t.number]))).toEqual([ISSUE]);
});

test("complex type", () => {
  const complexType = t.object({
    "a?": t.number,
    b: t.array(
      t.object({
        a: t.instanceOf(A),
        "b?": t.union([t.number, t.literal(false)]),
        c: t.tuple([t.string, t.string]),
      })
    ),
  });

  expect(validateType(1, complexType)).toEqual([ISSUE]);
  expect(validateType("", complexType)).toEqual([ISSUE]);
  expect(validateType([], complexType)).toEqual([ISSUE]);
  expect(validateType(null, complexType)).toEqual([ISSUE]);
  expect(validateType({}, complexType)).toEqual([ISSUE]);
  expect(validateType({ a: "" }, complexType)).toEqual([ISSUE]);
  expect(validateType({ a: 1 }, complexType)).toEqual([ISSUE]);
  expect(validateType({ b: {} }, complexType)).toEqual([ISSUE]);
  expect(
    validateType(
      {
        b: { a: 1, c: ["a", "b", "c"] },
      },
      complexType
    )
  ).toEqual([ISSUE]);
  expect(
    validateType(
      {
        b: [{ a: new A(), c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual(NO_ISSUE);
  expect(
    validateType(
      {
        a: 123,
        b: [{ a: new A(), c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual(NO_ISSUE);
  expect(
    validateType(
      {
        a: 123,
        b: [{ a: new A(), b: false, c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual(NO_ISSUE);
  expect(
    validateType(
      {
        a: 123,
        b: [{ a: new A(), b: 123, c: ["a", "b"] }],
      },
      complexType
    )
  ).toEqual(NO_ISSUE);
});
