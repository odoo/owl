import { assertType, computed, signal, types as t, validateType } from "../src";

class A {}

test("simple assertion", () => {
  expect(() => assertType("hey", t.string)).not.toThrow();
  expect(() => assertType({}, t.object())).not.toThrow();
  expect(() => assertType([], t.array())).not.toThrow();
  expect(() => assertType(1, t.boolean)).toThrow("Value does not match the type");
});

test("validateType", () => {
  expect(validateType("abc", t.string)).toMatchObject([]);
  expect(validateType("abc", t.number)).toMatchObject([{ message: "value is not a number" }]);
  expect(validateType(undefined, t.number)).toMatchObject([{ message: "value is not a number" }]);
  expect(validateType(1, t.number)).toEqual([]);
});

test("any", () => {
  expect(validateType("", t.any)).toEqual([]);
  expect(validateType("abc", t.any)).toEqual([]);
  expect(validateType(true, t.any)).toEqual([]);
  expect(validateType(false, t.any)).toEqual([]);
  expect(validateType(123, t.any)).toEqual([]);
  expect(validateType(987, t.any)).toEqual([]);
  expect(validateType(undefined, t.any)).toEqual([]);
  expect(validateType(null, t.any)).toEqual([]);
  expect(validateType({}, t.any)).toEqual([]);
  expect(validateType({ a: 1, b: "", c: { a: true } }, t.any)).toEqual([]);
  expect(validateType([{ a: 1 }, { b: 2 }], t.any)).toEqual([]);
  expect(validateType(() => {}, t.any)).toEqual([]);
  expect(validateType(A, t.any)).toEqual([]);
  expect(validateType(new A(), t.any)).toEqual([]);
});

test("array", () => {
  expect(validateType({}, t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType("", t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType("abc", t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType(123, t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType(987, t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType(true, t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType({}, t.array())).toMatchObject([{ message: "value is not an array" }]);
  expect(validateType([], t.array())).toEqual([]);
  expect(validateType([123], t.array())).toEqual([]);
  expect(validateType(["abc"], t.array())).toEqual([]);
  expect(validateType(["abc", 123], t.array())).toEqual([]);
  expect(validateType(["abc", 123, false], t.array())).toEqual([]);
  expect(validateType(["abc"], t.array(t.string))).toEqual([]);
  expect(validateType([123, "abc"], t.array(t.string))).toMatchObject([
    { message: "value is not a string", path: [0] },
  ]);
  expect(validateType(["abc", "def"], t.array(t.string))).toEqual([]);
  expect(validateType(["abc", 321], t.array(t.string))).toMatchObject([
    { message: "value is not a string", path: [1] },
  ]);
});

test("boolean", () => {
  const issue = { message: "value is not a boolean" };
  expect(validateType(true, t.boolean)).toEqual([]);
  expect(validateType(false, t.boolean)).toEqual([]);
  expect(validateType("", t.boolean)).toMatchObject([issue]);
  expect(validateType("abc", t.boolean)).toMatchObject([issue]);
  expect(validateType(123, t.boolean)).toMatchObject([issue]);
  expect(validateType(987, t.boolean)).toMatchObject([issue]);
  expect(validateType(undefined, t.boolean)).toMatchObject([issue]);
  expect(validateType(null, t.boolean)).toMatchObject([issue]);
  expect(validateType({}, t.boolean)).toMatchObject([issue]);
  expect(validateType([], t.boolean)).toMatchObject([issue]);
  expect(validateType(A, t.boolean)).toMatchObject([issue]);
  expect(validateType(new A(), t.boolean)).toMatchObject([issue]);
});

test("constructor", () => {
  class B extends A {}
  class C {}
  const issue = { message: "value is not 'A' or an extension" };
  expect(validateType(true, t.constructor(A))).toMatchObject([issue]);
  expect(validateType("abc", t.constructor(A))).toMatchObject([issue]);
  expect(validateType(123, t.constructor(A))).toMatchObject([issue]);
  expect(validateType(A, t.constructor(A))).toEqual([]);
  expect(validateType(B, t.constructor(A))).toEqual([]);
  expect(validateType(C, t.constructor(A))).toMatchObject([issue]);
  expect(validateType(A, t.constructor(B))).toMatchObject([
    { message: "value is not 'B' or an extension" },
  ]);
  expect(validateType(B, t.constructor(B))).toEqual([]);
  expect(validateType(C, t.constructor(B))).toMatchObject([
    { message: "value is not 'B' or an extension" },
  ]);
  expect(validateType(A, t.constructor(C))).toMatchObject([
    { message: "value is not 'C' or an extension" },
  ]);
  expect(validateType(B, t.constructor(C))).toMatchObject([
    { message: "value is not 'C' or an extension" },
  ]);
  expect(validateType(C, t.constructor(C))).toEqual([]);
  expect(validateType({}, t.constructor(A))).toMatchObject([issue]);
  expect(validateType(new A(), t.constructor(A))).toMatchObject([issue]);
  expect(validateType(new B(), t.constructor(A))).toMatchObject([issue]);
  expect(validateType(new C(), t.constructor(A))).toMatchObject([issue]);
  expect(validateType([], t.constructor(A))).toMatchObject([issue]);
  expect(validateType(() => {}, t.constructor(A))).toMatchObject([issue]);
});

test("customValidator", () => {
  const validator = t.customValidator(t.string, (size) => ["sm", "md", "lg"].includes(size));
  expect(validateType(123, validator)).toMatchObject([{ message: "value is not a string" }]);
  expect(validateType("sm", validator)).toEqual([]);
  expect(validateType("md", validator)).toEqual([]);
  expect(validateType("lg", validator)).toEqual([]);
  expect(validateType("small", validator)).toMatchObject([
    { message: "value does not match custom validation" },
  ]);
  expect(
    validateType(
      "small",
      t.customValidator(t.string, (size) => ["sm", "md", "lg"].includes(size), "Invalid")
    )
  ).toMatchObject([{ message: "Invalid" }]);
});

describe("function", () => {
  test("function", () => {
    expect(validateType(123, t.function())).toMatchObject([{ message: "value is not a function" }]);
    expect(validateType("abc", t.function())).toMatchObject([
      { message: "value is not a function" },
    ]);
    expect(validateType(true, t.function())).toMatchObject([
      { message: "value is not a function" },
    ]);
    expect(validateType(() => {}, t.function())).toEqual([]);
    expect(validateType(function () {}, t.function())).toEqual([]);
    expect(validateType(A, t.function())).toEqual([]); // Should return an issue
  });

  test("parameters and return types are not checked", () => {
    expect(validateType(() => {}, t.function([t.string], t.boolean))).toEqual([]);
    expect(validateType(function () {}, t.function([t.string], t.boolean))).toEqual([]);
  });
});

test("instanceOf", () => {
  class B extends A {}
  class C {}
  const issue = { message: "value is not an instance of 'A'" };
  expect(validateType(123, t.instanceOf(A))).toMatchObject([issue]);
  expect(validateType("abc", t.instanceOf(A))).toMatchObject([issue]);
  expect(validateType(true, t.instanceOf(A))).toMatchObject([issue]);
  expect(validateType({}, t.instanceOf(A))).toMatchObject([issue]);
  expect(validateType([], t.instanceOf(A))).toMatchObject([issue]);
  expect(validateType(new A(), t.instanceOf(A))).toEqual([]);
  expect(validateType(new B(), t.instanceOf(A))).toEqual([]);
  expect(validateType(new C(), t.instanceOf(A))).toMatchObject([issue]);
});

test("literal", () => {
  expect(validateType(123, t.literal(123))).toEqual([]);
  expect(validateType(321, t.literal(123))).toMatchObject([
    { message: "value is not equal to 123" },
  ]);
  expect(validateType("abc", t.literal("abc"))).toEqual([]);
  expect(validateType("", t.literal("abc"))).toMatchObject([
    { message: "value is not equal to 'abc'" },
  ]);
  expect(validateType("abc", t.literal(""))).toMatchObject([
    { message: "value is not equal to ''" },
  ]);
  expect(validateType(123, t.literal(""))).toMatchObject([{ message: "value is not equal to ''" }]);
  expect(validateType("", t.literal(123))).toMatchObject([
    { message: "value is not equal to 123" },
  ]);
  expect(validateType(true, t.literal(true))).toEqual([]);
  expect(validateType(false, t.literal(true))).toMatchObject([
    { message: "value is not equal to true" },
  ]);
  expect(validateType(null, t.literal(null))).toEqual([]);
  expect(validateType(true, t.literal(null))).toMatchObject([
    { message: "value is not equal to null" },
  ]);
  expect(validateType(null, t.literal(false))).toMatchObject([
    { message: "value is not equal to false" },
  ]);
  expect(validateType(undefined, t.literal(undefined))).toEqual([]);
  expect(validateType(123, t.literal(undefined))).toMatchObject([
    { message: "value is not equal to undefined" },
  ]);
  expect(validateType("abc", t.literal(undefined))).toMatchObject([
    { message: "value is not equal to undefined" },
  ]);
  expect(validateType(null, t.literal(undefined))).toMatchObject([
    { message: "value is not equal to undefined" },
  ]);
});

test("number", () => {
  const issue = { message: "value is not a number" };
  expect(validateType(123, t.number)).toEqual([]);
  expect(validateType(987, t.number)).toEqual([]);
  expect(validateType(true, t.number)).toMatchObject([issue]);
  expect(validateType(false, t.number)).toMatchObject([issue]);
  expect(validateType("", t.number)).toMatchObject([issue]);
  expect(validateType("abc", t.number)).toMatchObject([issue]);
  expect(validateType(undefined, t.number)).toMatchObject([issue]);
  expect(validateType(null, t.number)).toMatchObject([issue]);
  expect(validateType({}, t.number)).toMatchObject([issue]);
  expect(validateType([], t.number)).toMatchObject([issue]);
  expect(validateType(A, t.number)).toMatchObject([issue]);
  expect(validateType(new A(), t.number)).toMatchObject([issue]);
});

describe("object", () => {
  test("shaped object", () => {
    expect(validateType(123, t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType("abc", t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType(true, t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType(null, t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType(undefined, t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType([], t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType(() => {}, t.object({}))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType({}, t.object({}))).toEqual([]);
    expect(validateType({ a: 1 }, t.object({}))).toEqual([]);
    expect(validateType({ a: 1 }, t.object({ a: t.number }))).toEqual([]);
    expect(validateType({ a: 1 }, t.object({ a: t.string }))).toMatchObject([
      { message: "value is not a string", path: ["a"] },
    ]);
    expect(validateType({ b: 1 }, t.object({ a: t.string }))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["a"] },
    ]);
    expect(validateType({ a: 1, b: "b" }, t.object({ b: t.string }))).toEqual([]);
  });

  test("shaped object with optional key", () => {
    expect(validateType({}, t.object({ a: t.number }))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["a"] },
    ]);
    expect(validateType({}, t.object({ "a?": t.number }))).toEqual([]);
    expect(validateType({}, t.object({ a: t.number, "b?": t.number }))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["a"] },
    ]);
    expect(validateType({ a: 1 }, t.object({ a: t.number, "b?": t.number }))).toEqual([]);
    expect(validateType({ a: 1, b: 1 }, t.object({ a: t.number, "b?": t.number }))).toMatchObject(
      []
    );
    expect(
      validateType({ a: 1, b: "abc" }, t.object({ a: t.number, "b?": t.number }))
    ).toMatchObject([{ message: "value is not a number", path: ["b"] }]);
  });

  test("shaped object with nested object", () => {
    const type = t.object({
      a: t.number,
      b: t.object({
        c: t.string,
      }),
    });

    expect(validateType({}, type)).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["a", "b"] },
    ]);
    expect(validateType({ a: 1 }, type)).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["b"] },
    ]);
    expect(validateType({ a: 1, b: 1 }, type)).toMatchObject([
      { message: "value is not an object", path: ["b"] },
    ]);
    expect(validateType({ a: 1, b: {} }, type)).toMatchObject([
      { message: "object value have missing keys", path: ["b"], missingKeys: ["c"] },
    ]);
    expect(validateType({ a: 1, b: { c: "" } }, type)).toEqual([]);
    expect(validateType({ a: "", b: { c: "" } }, type)).toMatchObject([
      { message: "value is not a number", path: ["a"] },
    ]);
    expect(validateType({ a: 1, b: { c: 123 } }, type)).toMatchObject([
      { message: "value is not a string", path: ["b", "c"] },
    ]);
  });

  test("keyed object", () => {
    expect(validateType("abc", t.object(["a", "b"]))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType(123, t.object(["a", "b"]))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType(true, t.object(["a", "b"]))).toMatchObject([
      { message: "value is not an object", path: [] },
    ]);
    expect(validateType({}, t.object(["a", "b"]))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["a", "b"] },
    ]);
    expect(validateType({ a: "abc" }, t.object(["a", "b"]))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["b"] },
    ]);
    expect(validateType({ a: "abc", b: "def" }, t.object(["a", "b"]))).toEqual([]);
    expect(validateType({ a: 123 }, t.object(["a", "b"]))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["b"] },
    ]);
    expect(validateType({ a: 123, b: "def" }, t.object(["a", "b"]))).toEqual([]);
    expect(validateType({ a: 123, b: 123 }, t.object(["a", "b"]))).toEqual([]);
  });

  test("keyed object with optional keys", () => {
    expect(validateType({}, t.object(["a", "b?"]))).toMatchObject([
      { message: "object value have missing keys", path: [], missingKeys: ["a"] },
    ]);
    expect(validateType({ a: "abc" }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: "abc", b: "def" }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: 123 }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: 123, b: "def" }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: 123, b: 123 }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: 123, b: 123 }, t.object(["a", "b?"]))).toEqual([]);
  });

  test("keyed object with additional keys", () => {
    expect(validateType({ a: "abc", b: "def", c: "ghi" }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: "abc", c: "ghi" }, t.object(["a", "b?"]))).toEqual([]);
    expect(validateType({ a: "abc", d: "jkl" }, t.object(["a", "b?"]))).toEqual([]);
  });
});

describe("promise", () => {
  test("promise", () => {
    const issue = { message: "value is not a promise" };
    expect(validateType(123, t.promise())).toMatchObject([issue]);
    expect(validateType("abc", t.promise())).toMatchObject([issue]);
    expect(validateType(true, t.promise())).toMatchObject([issue]);
    expect(validateType(Promise.resolve(), t.promise())).toEqual([]);
  });

  test("return type is not checked", () => {
    expect(validateType(Promise.resolve(""), t.promise(t.string))).toEqual([]);
    expect(validateType(Promise.resolve(123), t.promise(t.string))).toEqual([]);
    expect(validateType(Promise.resolve(true), t.promise(t.string))).toEqual([]);
  });
});

test("reactiveValue", () => {
  const issue = { message: "value is not a reactive value" };
  expect(validateType(123, t.reactiveValue(t.string))).toMatchObject([issue]);
  expect(validateType("abc", t.reactiveValue(t.string))).toMatchObject([issue]);
  expect(validateType(true, t.reactiveValue(t.string))).toMatchObject([issue]);
  expect(validateType(() => {}, t.reactiveValue(t.string))).toMatchObject([issue]);
  expect(validateType(function () {}, t.reactiveValue(t.string))).toMatchObject([issue]);
  expect(validateType(A, t.reactiveValue(t.string))).toMatchObject([issue]);
  class B {
    set() {}
  }
  expect(validateType(B, t.reactiveValue(t.string))).toMatchObject([issue]);
  expect(validateType(signal(1), t.reactiveValue(t.number))).toEqual([]);
  expect(
    validateType(
      computed(() => 1),
      t.reactiveValue(t.number)
    )
  ).toEqual([]);
});

test("record", () => {
  expect(validateType("abc", t.record(t.string))).toMatchObject([
    { message: "value is not an object", path: [] },
  ]);
  expect(validateType(123, t.record(t.string))).toMatchObject([
    { message: "value is not an object", path: [] },
  ]);
  expect(validateType(true, t.record(t.string))).toMatchObject([
    { message: "value is not an object", path: [] },
  ]);
  expect(validateType({}, t.record(t.string))).toEqual([]);
  expect(validateType({ a: "abc" }, t.record(t.string))).toEqual([]);
  expect(validateType({ a: "abc", b: "def" }, t.record(t.string))).toEqual([]);
  expect(validateType({ a: 123 }, t.record(t.string))).toMatchObject([
    { message: "value is not a string", path: ["a"] },
  ]);
  expect(validateType({ a: 123, b: "def" }, t.record(t.string))).toMatchObject([
    { message: "value is not a string", path: ["a"] },
  ]);
  expect(validateType({ a: 123, b: 123 }, t.record(t.string))).toMatchObject([
    { message: "value is not a string", path: ["a"] },
    { message: "value is not a string", path: ["b"] },
  ]);
  expect(validateType({ a: 123, b: 123 }, t.record(t.number))).toEqual([]);
});

test("string", () => {
  const issue = { message: "value is not a string" };
  expect(validateType("", t.string)).toEqual([]);
  expect(validateType("abc", t.string)).toEqual([]);
  expect(validateType(123, t.string)).toMatchObject([issue]);
  expect(validateType(987, t.string)).toMatchObject([issue]);
  expect(validateType(true, t.string)).toMatchObject([issue]);
  expect(validateType(false, t.string)).toMatchObject([issue]);
  expect(validateType(undefined, t.string)).toMatchObject([issue]);
  expect(validateType(null, t.string)).toMatchObject([issue]);
  expect(validateType({}, t.string)).toMatchObject([issue]);
  expect(validateType([], t.string)).toMatchObject([issue]);
  expect(validateType(A, t.string)).toMatchObject([issue]);
  expect(validateType(new A(), t.string)).toMatchObject([issue]);
});

test("tuple", () => {
  expect(validateType(["abc"], t.tuple([t.string]))).toEqual([]);
  expect(validateType([], t.tuple([t.string]))).toMatchObject([
    { message: "tuple value does not have the correct length" },
  ]);
  expect(validateType([123], t.tuple([t.string]))).toMatchObject([
    { message: "value is not a string", path: [0] },
  ]);
  expect(validateType(["abc", 123], t.tuple([t.string]))).toMatchObject([
    { message: "tuple value does not have the correct length" },
  ]);
  expect(validateType("", t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not an array" },
  ]);
  expect(validateType("abc", t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not an array" },
  ]);
  expect(validateType(123, t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not an array" },
  ]);
  expect(validateType(987, t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not an array" },
  ]);
  expect(validateType(true, t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not an array" },
  ]);
  expect(validateType({}, t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not an array" },
  ]);
  expect(validateType(["abc", 123], t.tuple([t.string, t.number]))).toEqual([]);
  expect(validateType([123, "abc"], t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not a string", path: [0] },
    { message: "value is not a number", path: [1] },
  ]);
  expect(validateType(["abc"], t.tuple([t.string, t.number]))).toMatchObject([
    { message: "tuple value does not have the correct length" },
  ]);
  expect(validateType([123], t.tuple([t.string, t.number]))).toMatchObject([
    { message: "tuple value does not have the correct length" },
  ]);
  expect(validateType(["abc", true], t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not a number", path: [1] },
  ]);
  expect(validateType([true, 123], t.tuple([t.string, t.number]))).toMatchObject([
    { message: "value is not a string", path: [0] },
  ]);
  expect(validateType(["abc", 123, true], t.tuple([t.string, t.number]))).toMatchObject([
    { message: "tuple value does not have the correct length" },
  ]);
  expect(validateType(["abc", 123, true], t.tuple([t.string, t.number, t.boolean]))).toEqual([]);
  expect(validateType(["abc", 123, 123], t.tuple([t.string, t.number, t.boolean]))).toMatchObject([
    { message: "value is not a boolean", path: [2] },
  ]);
});

test("union", () => {
  expect(validateType("", t.union([t.string, t.number]))).toEqual([]);
  expect(validateType("abc", t.union([t.string, t.number]))).toEqual([]);
  expect(validateType(123, t.union([t.string, t.number]))).toEqual([]);
  expect(validateType(987, t.union([t.string, t.number]))).toEqual([]);
  expect(validateType(true, t.union([t.string, t.number]))).toMatchObject([
    {
      message: "value does not match union type",
      subIssues: [{ message: "value is not a string" }, { message: "value is not a number" }],
    },
  ]);
  expect(validateType({}, t.union([t.string, t.number]))).toMatchObject([
    {
      message: "value does not match union type",
      subIssues: [{ message: "value is not a string" }, { message: "value is not a number" }],
    },
  ]);
  expect(validateType([], t.union([t.string, t.number]))).toMatchObject([
    {
      message: "value does not match union type",
      subIssues: [{ message: "value is not a string" }, { message: "value is not a number" }],
    },
  ]);
  expect(validateType([], t.union([t.string, t.array(t.number)]))).toEqual([]);
  expect(validateType([""], t.union([t.string, t.array(t.number)]))).toMatchObject([
    { message: "value is not a number", path: [0] },
  ]);
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

  expect(validateType(1, complexType)).toMatchObject([{ message: "value is not an object" }]);
  expect(validateType("", complexType)).toMatchObject([{ message: "value is not an object" }]);
  expect(validateType([], complexType)).toMatchObject([{ message: "value is not an object" }]);
  expect(validateType(null, complexType)).toMatchObject([{ message: "value is not an object" }]);
  expect(validateType({}, complexType)).toMatchObject([
    { message: "object value have missing keys", missingKeys: ["b"] },
  ]);
  expect(validateType({ a: "" }, complexType)).toMatchObject([
    { message: "value is not a number", path: ["a"] },
    { message: "object value have missing keys", missingKeys: ["b"], path: [] },
  ]);
  expect(validateType({ a: 1 }, complexType)).toMatchObject([
    { message: "object value have missing keys", missingKeys: ["b"] },
  ]);
  expect(validateType({ b: {} }, complexType)).toMatchObject([
    { message: "value is not an array", path: ["b"] },
  ]);
  expect(
    validateType(
      {
        b: [{ a: 1, c: ["a", "b", "c"] }],
      },
      complexType
    )
  ).toMatchObject([
    { message: "value is not an instance of 'A'", path: ["b", 0, "a"] },
    { message: "tuple value does not have the correct length", path: ["b", 0, "c"] },
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
