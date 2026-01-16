import { types as t } from "../src";
import { assertType, validateType } from "../src/runtime/validation";

test("simple assertion", () => {
  expect(() => assertType("hey", t.string)).not.toThrow();
  expect(() => assertType({}, t.object())).not.toThrow();
  expect(() => assertType([], t.array())).not.toThrow();
  expect(() => assertType(1, t.boolean)).toThrow("Value does not match the type");
});

test("validateType", () => {
  expect(validateType("abc", t.string)).toHaveLength(0);
  expect(validateType("abc", t.number)).toHaveLength(1);
  expect(validateType(undefined, t.number)).toHaveLength(1);
  expect(validateType(1, t.number)).toHaveLength(0);
});

test("validate by no description", () => {
  expect(validateType("hey", t.any)).toHaveLength(0);
  expect(validateType({}, t.any)).toHaveLength(0);
  expect(validateType([], t.any)).toHaveLength(0);
  expect(validateType(1, t.any)).toHaveLength(0);
  expect(validateType(undefined, t.any)).toHaveLength(0);
});

test.skip("validate by type", () => {
  expect(validateType("hey", { type: String })).toBe(null);
  expect(validateType({}, { type: Object })).toBe(null);
  expect(validateType([], { type: Array })).toBe(null);
  expect(validateType(1, { type: Boolean })).toEqual({
    type: "type",
    expected: Boolean,
    received: 1,
  });
});

test.skip("can assert dates", () => {
  expect(validateType(new Date(), Date)).toBe(null);
  expect(validateType(4, Date)).toEqual({
    type: "type",
    expected: Date,
    received: 4,
  });
});

test.skip("validate optional", () => {
  expect(validateType(undefined, { optional: true })).toBe(null);
  expect(validateType(null, { optional: true })).toBe(null);
  expect(validateType("hey", { optional: true })).toBe(null);
  expect(validateType(2, { optional: true })).toBe(null);
  expect(validateType({}, { optional: true })).toBe(null);
});

test.skip("validate optional type", () => {
  expect(validateType(undefined, { type: String, optional: true })).toBe(null);
  expect(validateType("hey", { type: String, optional: true })).toBe(null);
  expect(validateType(null, { type: String, optional: true })).toEqual({
    type: "type",
    expected: String,
    received: null,
  });
  expect(validateType(2, { type: String, optional: true })).toEqual({
    type: "type",
    expected: String,
    received: 2,
  });
  expect(validateType({}, { type: String, optional: true })).toEqual({
    type: "type",
    expected: String,
    received: {},
  });
});

test.skip("validate with custom validation", () => {
  const validation = {
    validate: (size: string) => ["small", "medium", "large"].includes(size),
  };
  expect(validateType("small", validation)).toBe(null);
  expect(validateType("sall", validation)).toEqual({
    type: "validate",
    received: "sall",
    expected: validation.validate,
  });
  expect(validateType(1, validation)).toEqual({
    type: "validate",
    received: 1,
    expected: validation.validate,
  });
  expect(validateType(undefined, validation)).toEqual({
    type: "mandatory value",
    received: undefined,
    expected: validation,
  });
});

test.skip("validate by type and with custom validation", () => {
  const validation = {
    type: String,
    validate: (size: string) => ["small", "medium", "large"].includes(size),
  };
  expect(validateType("small", validation)).toBe(null);
  expect(validateType("sall", validation)).toEqual({
    type: "validate",
    received: "sall",
    expected: validation.validate,
  });
  expect(validateType(1, validation)).toEqual({
    type: "type",
    received: 1,
    expected: String,
  });
  expect(validateType(undefined, validation)).toEqual({
    type: "mandatory value",
    received: undefined,
    expected: validation,
  });
});

test.skip("validate optional custom validation", () => {
  const validation = {
    optional: true,
    validate: (size: string) => ["small", "medium", "large"].includes(size),
  };
  expect(validateType("small", validation)).toBe(null);
  expect(validateType("sall", validation)).toEqual({
    type: "validate",
    received: "sall",
    expected: validation.validate,
  });
  expect(validateType(1, validation)).toEqual({
    type: "validate",
    received: 1,
    expected: validation.validate,
  });
  expect(validateType(undefined, validation)).toBe(null);
});

test.skip("validate by optional type and with custom validation", () => {
  const validation = {
    type: String,
    optional: true,
    validate: (size: string) => ["small", "medium", "large"].includes(size),
  };
  expect(validateType("small", validation)).toBe(null);
  expect(validateType("sall", validation)).toEqual({
    type: "validate",
    received: "sall",
    expected: validation.validate,
  });
  expect(validateType(1, validation)).toEqual({
    type: "type",
    received: 1,
    expected: String,
  });
  expect(validateType(undefined, validation)).toBe(null);
});

test.skip("validate by union", () => {
  expect(validateType("", [String, Number])).toBe(null);
  expect(validateType(1, [String, Number])).toBe(null);
  expect(validateType(true, [String, Number])).toEqual({
    type: "type (union)",
    received: true,
    expected: [String, Number],
  });
  expect(validateType(undefined, [String, Number])).toEqual({
    type: "mandatory value",
    received: undefined,
    expected: [String, Number],
  });
});

test.skip("validate by type union", () => {
  expect(validateType("", { type: [String, Number] })).toBe(null);
  expect(validateType(1, { type: [String, Number] })).toBe(null);
  expect(validateType(true, { type: [String, Number] })).toEqual({
    type: "type (union)",
    received: true,
    expected: [String, Number],
  });
  expect(validateType(undefined, { type: [String, Number] })).toEqual({
    type: "mandatory value",
    received: undefined,
    expected: { type: [String, Number] },
  });
});

test.skip("validate by complex union", () => {
  const description = [Boolean, { type: Array, element: Number }];
  expect(validateType(true, description)).toBe(null);
  expect(validateType([], description)).toBe(null);
  expect(validateType([1], description)).toBe(null);
  expect(validateType(1, description)).toEqual({
    type: "type (union)",
    expected: description,
    received: 1,
  });
  expect(validateType([true], description)).toEqual({
    type: "array element",
    expected: {
      0: {
        type: "type",
        expected: Number,
        received: true,
      },
    },
    received: [true],
  });
});

test.skip("validate by optional type union", () => {
  expect(validateType("", { optional: true, type: [String, Number] })).toBe(null);
  expect(validateType(1, { optional: true, type: [String, Number] })).toBe(null);
  expect(validateType(true, { optional: true, type: [String, Number] })).toEqual({
    type: "type (union)",
    expected: [String, Number],
    received: true,
  });
  expect(validateType(undefined, { optional: true, type: [String, Number] })).toBe(null);
});

test.skip("validate by value", () => {
  expect(validateType("abc", { value: "abc" })).toBe(null);
  expect(validateType("", { value: "abc" })).toEqual({
    type: "exact value",
    expected: "abc",
    received: "",
  });
  expect(validateType("hello", { value: "abc" })).toEqual({
    type: "exact value",
    expected: "abc",
    received: "hello",
  });
  expect(validateType(123, { value: "abc" })).toEqual({
    type: "exact value",
    expected: "abc",
    received: 123,
  });
  expect(validateType(undefined, { value: "abc" })).toEqual({
    type: "mandatory value",
    expected: { value: "abc" },
    received: undefined,
  });
  expect(validateType("abc", { value: null })).toEqual({
    type: "exact value",
    expected: null,
    received: "abc",
  });
  expect(validateType(123, { value: null })).toEqual({
    type: "exact value",
    expected: null,
    received: 123,
  });
});

test.skip("validate by optional value", () => {
  expect(validateType("abc", { optional: true, value: "abc" })).toBe(null);
  expect(validateType("", { optional: true, value: "abc" })).toEqual({
    type: "exact value",
    expected: "abc",
    received: "",
  });
  expect(validateType("hello", { optional: true, value: "abc" })).toEqual({
    type: "exact value",
    expected: "abc",
    received: "hello",
  });
  expect(validateType(123, { optional: true, value: "abc" })).toEqual({
    type: "exact value",
    expected: "abc",
    received: 123,
  });
  expect(validateType(undefined, { optional: true, value: "abc" })).toBe(null);
});

test.skip("validate by union of type and value", () => {
  expect(validateType(false, [String, { value: false }])).toBe(null);
  expect(validateType(true, [String, { value: false }])).toEqual({
    type: "type (union)",
    expected: [String, { value: false }],
    received: true,
  });
  expect(validateType("string", [String, { value: false }])).toBe(null);
  expect(validateType(1, [String, { value: false }])).toEqual({
    type: "type (union)",
    expected: [String, { value: false }],
    received: 1,
  });
});

test.skip("validate by extends", () => {
  class A {}
  class B extends A {}
  class C extends B {}
  class D extends A {}
  expect(validateType(A, { extends: A })).toBe(null);
  expect(validateType(B, { extends: A })).toBe(null);
  expect(validateType(C, { extends: A })).toBe(null);
  expect(validateType(A, { extends: B })).toEqual({
    type: "class",
    expected: B,
    received: A,
  });
  expect(validateType(B, { extends: B })).toBe(null);
  expect(validateType(C, { extends: B })).toBe(null);
  expect(validateType(A, { extends: C })).toEqual({
    type: "class",
    expected: C,
    received: A,
  });
  expect(validateType(B, { extends: C })).toEqual({
    type: "class",
    expected: C,
    received: B,
  });
  expect(validateType(C, { extends: C })).toBe(null);
  expect(validateType(D, { extends: A })).toBe(null);
  expect(validateType(D, { extends: B })).toEqual({
    type: "class",
    expected: B,
    received: D,
  });
  expect(validateType(C, { extends: D })).toEqual({
    type: "class",
    expected: D,
    received: C,
  });

  const a = new A();
  expect(validateType(a, { extends: A })).toEqual({
    type: "class",
    expected: A,
    received: a,
  });
  const b = new B();
  expect(validateType(b, { extends: A })).toEqual({
    type: "class",
    expected: A,
    received: b,
  });

  expect(validateType(true, { extends: A })).toEqual({
    type: "class",
    expected: A,
    received: true,
  });
  expect(validateType("A", { extends: A })).toEqual({
    type: "class",
    expected: A,
    received: "A",
  });
  expect(validateType({}, { extends: A })).toEqual({
    type: "class",
    expected: A,
    received: {},
  });
  const fn = () => {};
  expect(validateType(fn, { extends: A })).toEqual({
    type: "class",
    expected: A,
    received: fn,
  });
});

test.skip("validate by element", () => {
  const description = { element: String };
  expect(validateType([], description)).toBe(null);
  expect(validateType(1, description)).toEqual({
    type: "type",
    expected: { type: Array, element: String },
    received: 1,
  });
  expect(validateType(undefined, description)).toEqual({
    type: "mandatory value",
    expected: { element: String },
    received: undefined,
  });
  expect(validateType(["a"], description)).toBe(null);
  expect(validateType([1], description)).toEqual({
    type: "array element",
    expected: {
      0: {
        type: "type",
        expected: String,
        received: 1,
      },
    },
    received: [1],
  });
});

test.skip("validate by element union", () => {
  const description = { element: [String, Boolean] };
  expect(validateType([], description)).toBe(null);
  expect(validateType(1, description)).toEqual({
    type: "type",
    expected: { type: Array, element: [String, Boolean] },
    received: 1,
  });
  expect(validateType(undefined, description)).toEqual({
    type: "mandatory value",
    expected: description,
    received: undefined,
  });
  expect(validateType(["a"], description)).toBe(null);
  expect(validateType([1], description)).toEqual({
    type: "array element",
    expected: {
      0: {
        type: "type (union)",
        expected: [String, Boolean],
        received: 1,
      },
    },
    received: [1],
  });
  expect(validateType([true, 1], description)).toEqual({
    type: "array element",
    expected: {
      1: {
        type: "type (union)",
        expected: [String, Boolean],
        received: 1,
      },
    },
    received: [true, 1],
  });
});

test.skip("validate by values", () => {
  const description = { values: String };
  expect(validateType({}, description)).toBe(null);
  expect(validateType(1, description)).toEqual({
    type: "type",
    expected: { type: Object, values: String },
    received: 1,
  });
  expect(validateType(undefined, description)).toEqual({
    type: "mandatory value",
    expected: description,
    received: undefined,
  });
  expect(validateType({ a: "abc" }, description)).toBe(null);
  expect(validateType({ a: "abc", b: "cba" }, description)).toBe(null);
  expect(validateType({ a: 1 }, description)).toEqual({
    type: "values",
    expected: {
      a: {
        type: "type",
        expected: String,
        received: 1,
      },
    },
    received: { a: 1 },
  });
});

describe("validate by shape", () => {
  test.skip("key validation", () => {
    expect(validateType({ a: "hey" }, { shape: ["a"] })).toBe(null);
    expect(validateType({ b: 1 }, { shape: ["a"] })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "missing key",
          expected: { optional: false },
          received: undefined,
        },
        b: {
          type: "unknown key",
          expected: undefined,
          received: 1,
        },
      },
      received: { b: 1 },
    });
  });

  test.skip("key validation with optional props", () => {
    expect(validateType({ a: "hey" }, { shape: ["a", "b?"] })).toBe(null);
    expect(validateType({ a: "hey", b: 1 }, { shape: ["a", "b?"] })).toBe(null);
  });

  test.skip("key validation with optional props and *", () => {
    expect(validateType({ a: "hey" }, { shape: ["a", "b?", "*"] })).toBe(null);
    expect(validateType({ a: "hey" }, { shape: ["a", "*"] })).toBe(null);
    expect(validateType({ a: "hey", b: 1, c: 3 }, { shape: ["a", "*"] })).toBe(null);
  });

  test.skip("schema", () => {
    expect(validateType({ a: "hey" }, { shape: { a: String } })).toBe(null);
    expect(validateType({ a: 1 }, { shape: { a: Boolean } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "type",
          expected: Boolean,
          received: 1,
        },
      },
      received: { a: 1 },
    });
  });

  test.skip("schema with type", () => {
    expect(validateType({ a: "hey" }, { shape: { a: { type: String } } })).toBe(null);
    expect(validateType({ a: 1 }, { shape: { a: { type: Boolean } } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "type",
          expected: Boolean,
          received: 1,
        },
      },
      received: { a: 1 },
    });
  });

  test.skip("some particular edgecases as key name", () => {
    expect(validateType({ shape: "hey" }, { shape: { shape: String } })).toBe(null);
    expect(validateType({ shape: 1 }, { shape: { shape: Boolean } })).toEqual({
      type: "shape",
      expected: {
        shape: {
          type: "type",
          expected: Boolean,
          received: 1,
        },
      },
      received: { shape: 1 },
    });
    expect(validateType({ element: "hey" }, { shape: { element: String } })).toBe(null);
    expect(validateType({ element: 1 }, { shape: { element: Boolean } })).toEqual({
      type: "shape",
      expected: {
        element: {
          type: "type",
          expected: Boolean,
          received: 1,
        },
      },
      received: { element: 1 },
    });
  });

  test.skip("multiple errors", () => {
    expect(validateType({ a: 1, b: 2 }, { shape: { a: Boolean, b: Boolean } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "type",
          expected: Boolean,
          received: 1,
        },
        b: {
          type: "type",
          expected: Boolean,
          received: 2,
        },
      },
      received: { a: 1, b: 2 },
    });
  });

  test.skip("missing key", () => {
    expect(validateType({}, { shape: { a: Boolean } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "missing key",
          expected: Boolean,
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("additional key", () => {
    expect(validateType({ b: 1 }, { shape: {} })).toEqual({
      type: "shape",
      expected: {
        b: {
          type: "unknown key",
          expected: undefined,
          received: 1,
        },
      },
      received: { b: 1 },
    });
  });

  test.skip("undefined key", () => {
    expect(validateType({ a: undefined }, { shape: { a: Boolean } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "mandatory value",
          expected: Boolean,
          received: undefined,
        },
      },
      received: { a: undefined },
    });
    expect(validateType({}, { shape: { a: Boolean } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "missing key",
          expected: Boolean,
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("can use '*' to denote any type", () => {
    expect(validateType({ a: "hey" }, { shape: { a: "*" } })).toBe(null);
    expect(validateType({}, { shape: { a: "*" } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "missing key",
          expected: "*",
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("object type description, with no type/optional key", () => {
    expect(validateType({ a: "hey" }, { shape: { a: {} } })).toBe(null);
    expect(validateType({ a: 1 }, { shape: { a: {} } })).toBe(null);
    expect(validateType({}, { shape: { a: {} } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "missing key",
          expected: {},
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("optional key", () => {
    expect(validateType({}, { shape: { a: { optional: true } } })).toBe(null);
    expect(validateType({}, { shape: { a: { type: Number, optional: true } } })).toBe(null);
    expect(validateType({ a: undefined }, { shape: { a: { type: Number, optional: true } } })).toBe(
      null
    );
    expect(validateType({ a: 2 }, { shape: { a: { optional: true } } })).toBe(null);
    expect(validateType({ a: undefined }, { shape: { a: { optional: true } } })).toBe(null);
    expect(validateType({ a: 2 }, { shape: { a: { type: Number, optional: true } } })).toBe(null);
    expect(validateType({ a: 2 }, { shape: { a: { type: String, optional: true } } })).toEqual({
      type: "shape",
      expected: {
        a: {
          type: "type",
          expected: String,
          received: 2,
        },
      },
      received: { a: 2 },
    });
  });

  test.skip("objects with specified shape", () => {
    const description = {
      shape: {
        p: {
          type: Object,
          shape: {
            id: Number,
            url: String,
          },
        },
      },
    };
    expect(validateType({ p: [] }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "type",
          expected: { type: Object, shape: { id: Number, url: String } },
          received: [],
        },
      },
      received: { p: [] },
    });

    expect(validateType({ p: {} }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "shape",
          expected: {
            id: {
              type: "missing key",
              expected: Number,
              received: undefined,
            },
            url: {
              type: "missing key",
              expected: String,
              received: undefined,
            },
          },
          received: {},
        },
      },
      received: { p: {} },
    });
    expect(validateType({ p: { id: 1, url: "asf" } }, description)).toBe(null);
    expect(validateType({ p: { id: 1, url: 1 } }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "shape",
          expected: {
            url: {
              type: "type",
              expected: String,
              received: 1,
            },
          },
          received: { id: 1, url: 1 },
        },
      },
      received: { p: { id: 1, url: 1 } },
    });
    expect(validateType({ p: undefined }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "mandatory value",
          expected: description.shape.p,
          received: undefined,
        },
      },
      received: { p: undefined },
    });
  });

  test.skip("objects with a values schema", () => {
    const description = {
      shape: {
        p: { type: Object, values: { type: Object, shape: { id: Number, url: String } } },
      },
    };
    expect(validateType({ p: [] }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "type",
          expected: description.shape.p,
          received: [],
        },
      },
      received: { p: [] },
    });
    expect(validateType({ p: {} }, description)).toBe(null);
    expect(validateType({ p: { id: 1, url: "asf" } }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "values",
          expected: {
            id: {
              type: "type",
              expected: description.shape.p.values,
              received: 1,
            },
            url: {
              type: "type",
              expected: description.shape.p.values,
              received: "asf",
            },
          },
          received: { id: 1, url: "asf" },
        },
      },
      received: { p: { id: 1, url: "asf" } },
    });
    expect(
      validateType(
        {
          p: {
            a: { id: 1, url: "asf" },
          },
        },
        description
      )
    ).toBe(null);
    expect(
      validateType(
        {
          p: {
            a: { id: 1, url: "asf" },
            b: { id: 1, url: 1 },
          },
        },
        description
      )
    ).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "values",
          expected: {
            b: {
              type: "shape",
              expected: {
                url: {
                  type: "type",
                  expected: String,
                  received: 1,
                },
              },
              received: { id: 1, url: 1 },
            },
          },
          received: {
            a: { id: 1, url: "asf" },
            b: { id: 1, url: 1 },
          },
        },
      },
      received: {
        p: {
          a: { id: 1, url: "asf" },
          b: { id: 1, url: 1 },
        },
      },
    });
  });

  test.skip("objects with more complex shape", () => {
    const description = {
      shape: {
        p: {
          type: Object,
          shape: {
            id: Number,
            url: [Boolean, { type: Array, element: Number }],
          },
        },
      },
    };
    expect(validateType({ p: [] }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "type",
          expected: description.shape.p,
          received: [],
        },
      },
      received: { p: [] },
    });
    expect(validateType({ p: {} }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "shape",
          expected: {
            id: {
              type: "missing key",
              expected: description.shape.p.shape.id,
              received: undefined,
            },
            url: {
              type: "missing key",
              expected: description.shape.p.shape.url,
              received: undefined,
            },
          },
          received: {},
        },
      },
      received: { p: {} },
    });
    expect(validateType({ p: { id: 1, url: "asf" } }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "shape",
          expected: {
            url: {
              type: "type (union)",
              expected: description.shape.p.shape.url,
              received: "asf",
            },
          },
          received: { id: 1, url: "asf" },
        },
      },
      received: { p: { id: 1, url: "asf" } },
    });
    expect(validateType({ p: { id: 1, url: true } }, description)).toBe(null);
    expect(validateType({ p: undefined }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "mandatory value",
          expected: description.shape.p,
          received: undefined,
        },
      },
      received: { p: undefined },
    });
  });

  test.skip("objects with shape and *", () => {
    const description: any = {
      shape: {
        p: { type: Object, shape: { id: Number, "*": true } },
      },
    };
    expect(validateType({ p: [] }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "type",
          expected: (description as any).shape.p,
          received: [],
        },
      },
      received: { p: [] },
    });
    expect(validateType({ p: {} }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "shape",
          expected: {
            id: {
              type: "missing key",
              expected: (description as any).shape.p.shape.id,
              received: undefined,
            },
          },
          received: {},
        },
      },
      received: { p: {} },
    });
    expect(validateType({ p: { id: 1 } }, description)).toBe(null);
    expect(validateType({ p: { id: "asdf" } }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "shape",
          expected: {
            id: {
              type: "type",
              expected: Number,
              received: "asdf",
            },
          },
          received: { id: "asdf" },
        },
      },
      received: { p: { id: "asdf" } },
    });
    expect(validateType({ p: { id: 1, url: 1 } }, description)).toBe(null);
    expect(validateType({ p: undefined }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "mandatory value",
          expected: (description as any).shape.p,
          received: undefined,
        },
      },
      received: { p: undefined },
    });
  });

  test.skip("can specify that additional keys are allowed", () => {
    const description: any = {
      shape: {
        message: String,
        "*": true,
      },
    };
    expect(validateType({ message: "hey" }, description)).toBe(null);
    expect(validateType({ message: "hey", otherKey: true }, description)).toBe(null);
  });

  test.skip("array with element with shape", () => {
    const description = {
      shape: {
        p: {
          type: Array,
          element: {
            type: Object,
            shape: {
              num: { type: Number, optional: true },
            },
          },
        },
      },
    };
    expect(validateType({ p: 1 }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "type",
          expected: description.shape.p,
          received: 1,
        },
      },
      received: { p: 1 },
    });
    expect(validateType({ p: {} }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "type",
          expected: description.shape.p,
          received: {},
        },
      },
      received: { p: {} },
    });
    expect(validateType({ p: [] }, description)).toBe(null);
    expect(validateType({ p: [{}] }, description)).toBe(null);
    expect(validateType({ p: [{ num: 1 }] }, description)).toBe(null);
    expect(validateType({ p: [{ num: true }] }, description)).toEqual({
      type: "shape",
      expected: {
        p: {
          type: "array element",
          expected: {
            0: {
              type: "shape",
              expected: {
                num: {
                  type: "type",
                  expected: Number,
                  received: true,
                },
              },
              received: { num: true },
            },
          },
          received: [{ num: true }],
        },
      },
      received: { p: [{ num: true }] },
    });
  });
});
