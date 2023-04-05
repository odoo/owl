import { Schema, validateSchema } from "../src/runtime/validation";

describe("validateSchema", () => {
  test("simple use", () => {
    expect(validateSchema({ a: "hey" }, { a: String })).toEqual([]);
    expect(validateSchema({ a: 1 }, { a: Boolean })).toEqual(["'a' is not a boolean"]);
  });

  test("simple use, alternate form", () => {
    expect(validateSchema({ a: "hey" }, { a: { type: String } })).toEqual([]);
    expect(validateSchema({ a: 1 }, { a: { type: Boolean } })).toEqual(["'a' is not a boolean"]);
  });

  test("some particular edgecases as key name", () => {
    expect(validateSchema({ shape: "hey" }, { shape: String })).toEqual([]);
    expect(validateSchema({ shape: 1 }, { shape: Boolean })).toEqual(["'shape' is not a boolean"]);
    expect(validateSchema({ element: "hey" }, { element: String })).toEqual([]);
    expect(validateSchema({ element: 1 }, { element: Boolean })).toEqual([
      "'element' is not a boolean",
    ]);
  });

  test("multiple errors", () => {
    expect(validateSchema({ a: 1, b: 2 }, { a: Boolean, b: Boolean })).toEqual([
      "'a' is not a boolean",
      "'b' is not a boolean",
    ]);
  });

  test("missing key", () => {
    expect(validateSchema({}, { a: Boolean })).toEqual(["'a' is missing (should be a boolean)"]);
  });

  test("additional key", () => {
    expect(validateSchema({ b: 1 }, {})).toEqual(["unknown key 'b'"]);
  });

  test("undefined key", () => {
    expect(validateSchema({ a: undefined }, { a: Boolean })).toEqual([
      "'a' is undefined (should be a boolean)",
    ]);
    expect(validateSchema({}, { a: Boolean })).toEqual(["'a' is missing (should be a boolean)"]);
  });

  test("can use '*' to denote any type", () => {
    expect(validateSchema({ a: "hey" }, { a: "*" })).toEqual([]);
    expect(validateSchema({}, { a: "*" })).toEqual(["'a' is missing"]);
  });

  test("an union of type", () => {
    expect(validateSchema({ a: "hey" }, { a: [String, Boolean] })).toEqual([]);
    expect(validateSchema({ a: 1 }, { a: [String, Boolean] })).toEqual([
      "'a' is not a string or boolean",
    ]);
    expect(validateSchema({ a: "hey" }, { a: { type: [String, Boolean] } })).toEqual([]);
  });

  test("another union of types", () => {
    const schema: Schema = {
      id: Number,
      url: [Boolean, { type: Array, element: Number }],
    };
    expect(validateSchema({ a: "hey" }, schema)).toEqual([
      "unknown key 'a'",
      "'id' is missing (should be a number)",
      "'url' is missing (should be a boolean or list of numbers)",
    ]);
    expect(validateSchema({ id: 1 }, schema)).toEqual([
      "'url' is missing (should be a boolean or list of numbers)",
    ]);
    expect(validateSchema({ id: 1, url: true }, schema)).toEqual([]);
    expect(validateSchema({ id: true, url: true }, schema)).toEqual(["'id' is not a number"]);
    expect(validateSchema({ id: 3, url: 3 }, schema)).toEqual([
      "'url' is not a boolean or list of numbers",
    ]);
  });

  test("simplified schema description", () => {
    expect(validateSchema({ a: "hey" }, ["a"])).toEqual([]);
    expect(validateSchema({ b: 1 }, ["a"])).toEqual(["unknown key 'b'", "'a' is missing"]);
  });

  test("simplified schema description with optional props and *", () => {
    expect(validateSchema({ a: "hey" }, ["a", "b?", "*"])).toEqual([]);
    expect(validateSchema({ a: "hey" }, ["a", "*"])).toEqual([]);
    expect(validateSchema({ a: "hey", b: 1, c: 3 }, ["a", "*"])).toEqual([]);
  });

  test("simplified schema description with optional props", () => {
    expect(validateSchema({ a: "hey" }, ["a", "b?"])).toEqual([]);
    expect(validateSchema({ a: "hey", b: 1 }, ["a", "b?"])).toEqual([]);
  });

  test("object type description, with no type/optional key", () => {
    expect(validateSchema({ a: "hey" }, { a: {} })).toEqual([]);
    expect(validateSchema({ a: 1 }, { a: {} })).toEqual([]);
    expect(validateSchema({}, { a: {} })).toEqual(["'a' is missing"]);
  });

  test("optional key", () => {
    expect(validateSchema({}, { a: { optional: true } })).toEqual([]);
    expect(validateSchema({}, { a: { type: Number, optional: true } })).toEqual([]);
    expect(validateSchema({ a: undefined }, { a: { type: Number, optional: true } })).toEqual([]);
    expect(validateSchema({ a: 2 }, { a: { optional: true } })).toEqual([]);
    expect(validateSchema({ a: undefined }, { a: { optional: true } })).toEqual([]);
    expect(validateSchema({ a: 2 }, { a: { type: Number, optional: true } })).toEqual([]);
    expect(validateSchema({ a: 2 }, { a: { type: String, optional: true } })).toEqual([
      "'a' is not a string",
    ]);
  });

  test("can validate dates", () => {
    expect(validateSchema({ a: new Date() }, { a: Date })).toEqual([]);
    expect(validateSchema({ a: 4 }, { a: Date })).toEqual(["'a' is not a date"]);
  });

  test("arrays with simple element description", () => {
    const schema: Schema = { p: { type: Array, element: String } };
    expect(validateSchema({ p: [] }, schema)).toEqual([]);
    expect(validateSchema({ p: 1 }, schema)).toEqual(["'p' is not a list of strings"]);
    expect(validateSchema({}, schema)).toEqual(["'p' is missing (should be a list of strings)"]);
    expect(validateSchema({ p: undefined }, schema)).toEqual([
      "'p' is undefined (should be a list of strings)",
    ]);
    expect(validateSchema({ p: ["a"] }, schema)).toEqual([]);
    expect(validateSchema({ p: [1] }, schema)).toEqual(["'p[0]' is not a string"]);
  });

  test("arrays with union type as element description", () => {
    const schema: Schema = { p: { type: Array, element: [String, Boolean] } };
    expect(validateSchema({ p: [] }, schema)).toEqual([]);
    expect(validateSchema({ p: 1 }, schema)).toEqual(["'p' is not a list of string or booleans"]);
    expect(validateSchema({}, schema)).toEqual([
      "'p' is missing (should be a list of string or booleans)",
    ]);
    expect(validateSchema({ p: undefined }, schema)).toEqual([
      "'p' is undefined (should be a list of string or booleans)",
    ]);
    expect(validateSchema({ p: ["a"] }, schema)).toEqual([]);
    expect(validateSchema({ p: [1] }, schema)).toEqual(["'p[0]' is not a string or boolean"]);
    expect(validateSchema({ p: [true, 1] }, schema)).toEqual(["'p[1]' is not a string or boolean"]);
  });

  test("objects with specified shape", () => {
    const schema: Schema = { p: { type: Object, shape: { id: Number, url: String } } };
    expect(validateSchema({ p: [] }, schema)).toEqual(["'p' is not an object"]);
    expect(validateSchema({ p: {} }, schema)).toEqual([
      "'p' doesn't have the correct shape ('id' is missing (should be a number), 'url' is missing (should be a string))",
    ]);
    expect(validateSchema({ p: { id: 1, url: "asf" } }, schema)).toEqual([]);
    expect(validateSchema({ p: { id: 1, url: 1 } }, schema)).toEqual([
      "'p' doesn't have the correct shape ('url' is not a string)",
    ]);
    expect(validateSchema({ p: undefined }, schema)).toEqual([
      "'p' is undefined (should be a object)",
    ]);
  });

  test("objects with a values schema", () => {
    const schema: Schema = {
      p: { type: Object, values: { type: Object, shape: { id: Number, url: String } } },
    };
    expect(validateSchema({ p: [] }, schema)).toEqual(["'p' is not an object"]);
    expect(validateSchema({ p: {} }, schema)).toEqual([]);
    expect(validateSchema({ p: { id: 1, url: "asf" } }, schema)).toEqual([
      "some of the values in 'p' are invalid ('id' is not an object, 'url' is not an object)",
    ]);
    expect(
      validateSchema(
        {
          p: {
            a: { id: 1, url: "asf" },
          },
        },
        schema
      )
    ).toEqual([]);
    expect(
      validateSchema(
        {
          p: {
            a: { id: 1, url: "asf" },
            b: { id: 1, url: 1 },
          },
        },
        schema
      )
    ).toEqual([
      "some of the values in 'p' are invalid ('b' doesn't have the correct shape ('url' is not a string))",
    ]);
  });

  test("objects with more complex shape", () => {
    const schema: Schema = {
      p: {
        type: Object,
        shape: {
          id: Number,
          url: [Boolean, { type: Array, element: Number }],
        },
      },
    };
    expect(validateSchema({ p: [] }, schema)).toEqual(["'p' is not an object"]);
    expect(validateSchema({ p: {} }, schema)).toEqual([
      "'p' doesn't have the correct shape ('id' is missing (should be a number), 'url' is missing (should be a boolean or list of numbers))",
    ]);
    expect(validateSchema({ p: { id: 1, url: "asf" } }, schema)).toEqual([
      "'p' doesn't have the correct shape ('url' is not a boolean or list of numbers)",
    ]);
    expect(validateSchema({ p: { id: 1, url: true } }, schema)).toEqual([]);
    expect(validateSchema({ p: undefined }, schema)).toEqual([
      "'p' is undefined (should be a object)",
    ]);
  });

  test("objects with shape and *", () => {
    const schema: Schema = { p: { type: Object, shape: { id: Number, "*": true } } };
    expect(validateSchema({ p: [] }, schema)).toEqual(["'p' is not an object"]);
    expect(validateSchema({ p: {} }, schema)).toEqual([
      "'p' doesn't have the correct shape ('id' is missing (should be a number))",
    ]);
    expect(validateSchema({ p: { id: 1 } }, schema)).toEqual([]);
    expect(validateSchema({ p: { id: "asdf" } }, schema)).toEqual([
      "'p' doesn't have the correct shape ('id' is not a number)",
    ]);
    expect(validateSchema({ p: { id: 1, url: 1 } }, schema)).toEqual([]);
    expect(validateSchema({ p: undefined }, schema)).toEqual([
      "'p' is undefined (should be a object)",
    ]);
  });

  test("can specify that additional keys are allowed", () => {
    const schema: Schema = {
      message: String,
      "*": true,
    };
    expect(validateSchema({ message: "hey" }, schema)).toEqual([]);
    expect(validateSchema({ message: "hey", otherKey: true }, schema)).toEqual([]);
  });

  test("array with element with shape", () => {
    const schema: Schema = {
      p: {
        type: Array,
        element: {
          type: Object,
          shape: {
            num: { type: Number, optional: true },
          },
        },
      },
    };
    expect(validateSchema({ p: 1 }, schema)).toEqual(["'p' is not a list of objects"]);
    expect(validateSchema({ p: {} }, schema)).toEqual(["'p' is not a list of objects"]);
    expect(validateSchema({ p: [] }, schema)).toEqual([]);
    expect(validateSchema({ p: [{}] }, schema)).toEqual([]);
    expect(validateSchema({ p: [{ num: 1 }] }, schema)).toEqual([]);
    expect(validateSchema({ p: [{ num: true }] }, schema)).toEqual([
      "'p[0]' doesn't have the correct shape ('num' is not a number)",
    ]);
  });

  test("schema with custom validate function", () => {
    const schema: Schema = {
      size: {
        validate: (e: string) => ["small", "medium", "large"].includes(e),
      },
    };
    expect(validateSchema({ size: "small" }, schema)).toEqual([]);
    expect(validateSchema({ size: "sall" }, schema)).toEqual(["'size' is not valid"]);
    expect(validateSchema({ size: 1 }, schema)).toEqual(["'size' is not valid"]);
  });

  test("schema with custom validate function and type", () => {
    const schema: Schema = {
      size: {
        type: String,
        validate: (e: string) => ["small", "medium", "large"].includes(e),
      },
    };
    expect(validateSchema({ size: "small" }, schema)).toEqual([]);
    expect(validateSchema({ size: "sall" }, schema)).toEqual(["'size' is not valid"]);
    expect(validateSchema({ size: 1 }, schema)).toEqual(["'size' is not a string"]);
  });

  test("value as type", () => {
    expect(validateSchema({ a: false }, { a: { value: false } })).toEqual([]);
    expect(validateSchema({ a: true }, { a: { value: false } })).toEqual([
      "'a' is not equal to 'false'",
    ]);
  });

  test("value as type (some other values)", () => {
    expect(validateSchema({ a: null }, { a: { value: null } })).toEqual([]);
    expect(validateSchema({ a: false }, { a: { value: null } })).toEqual([
      "'a' is not equal to 'null'",
    ]);
    expect(validateSchema({ a: "hey" }, { a: { value: "hey" } })).toEqual([]);
    expect(validateSchema({ a: true }, { a: { value: "hey" } })).toEqual([
      "'a' is not equal to 'hey'",
    ]);
  });

  test("value as type work in union type", () => {
    expect(validateSchema({ a: false }, { a: [String, { value: false }] })).toEqual([]);
    expect(validateSchema({ a: true }, { a: [String, { value: false }] })).toEqual([
      "'a' is not a string or false",
    ]);
    expect(validateSchema({ a: "string" }, { a: [String, { value: false }] })).toEqual([]);
  });
});
