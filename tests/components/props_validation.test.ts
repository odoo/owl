import { Component, mount, onError, OwlError, props, xml } from "../../src";
import { App } from "../../src/runtime/app";
import { makeTestFixture, nextAppError, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();
const info = console.info;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;

beforeAll(() => {
  console.info = (message: any) => {
    if (message === `Owl is running in 'dev' mode.`) {
      return;
    }
    info(message);
  };
});

afterAll(() => {
  console.info = info;
});

beforeEach(() => {
  fixture = makeTestFixture();
  mockConsoleWarn = jest.fn(() => {});
  console.warn = mockConsoleWarn;
});

afterEach(() => {
  console.warn = originalconsoleWarn;
});

//------------------------------------------------------------------------------
// Props validation
//------------------------------------------------------------------------------

describe("props validation", () => {
  test.skip("validation is only done in dev mode", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props(["message"]);
    }
    class Parent extends Component {
      static components = { SubComp };
      static template = xml`<div><SubComp /></div>`;
    }

    const app = new App({ test: true });
    let error: OwlError | undefined;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        message: {
          type: "missing prop",
          expected: { optional: false },
          received: undefined,
        },
      },
      received: {},
    });
    error = undefined;

    try {
      await mount(Parent, fixture, { dev: false });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
  });

  test.skip("props: list of strings", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props(["message"]);
    }
    class Parent extends Component {
      static components = { SubComp };
      static template = xml`<div><SubComp /></div>`;
    }

    const app = new App({ test: true });
    let error: OwlError | undefined;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        message: {
          type: "missing prop",
          expected: { optional: false },
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("validate props for root component", async () => {
    class Root extends Component {
      static template = xml`<div t-out="this.props.message"/>`;
      props = props(["message"]);
    }

    let error: Error;
    try {
      await mount(Root, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid component props (Root)");
    expect((error! as any).cause).toEqual({
      type: "props",
      expected: {
        message: {
          type: "missing prop",
          expected: { optional: false },
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("validate simple types", async () => {
    const Tests = [
      { type: Number, ok: 1, ko: "1" },
      { type: Boolean, ok: true, ko: "1" },
      { type: String, ok: "1", ko: 1 },
      { type: Object, ok: {}, ko: "1" },
      { type: Date, ok: new Date(), ko: "1" },
      { type: Function, ok: () => {}, ko: "1" },
    ];
    let state: { p?: any };
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      get p() {
        return state.p;
      }
    }
    for (const test of Tests) {
      const SubComp = class extends Component {
        static template = xml`<div>hey</div>`;
        props = props({ p: test.type });
      };
      (Parent as any).components = { SubComp };

      state = {};
      let app = new App({ test: true });
      let error: OwlError | undefined;
      let mountProm = app
        .createRoot(Parent)
        .mount(fixture)
        .catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow(
        "[Owl] Unhandled error. Destroying the root component"
      );
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.cause.message).toBe(`Invalid component props (_a)`);
      expect(error!.cause.cause).toEqual({
        type: "props",
        expected: {
          p: {
            type: "missing prop",
            expected: test.type,
            received: undefined,
          },
        },
        received: { p: undefined },
      });
      error = undefined;
      state = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeUndefined();
      state = { p: test.ko };
      app = new App({ test: true });
      mountProm = app
        .createRoot(Parent)
        .mount(fixture)
        .catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow(
        "[Owl] Unhandled error. Destroying the root component"
      );
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.cause.message).toBe(`Invalid component props (_a)`);
      expect(error!.cause.cause).toEqual({
        type: "props",
        expected: {
          p: {
            type: "type",
            expected: test.type,
            received: test.ko,
          },
        },
        received: { p: test.ko },
      });
    }
  });

  test.skip("validate simple types, alternate form", async () => {
    const Tests = [
      { type: Number, ok: 1, ko: "1" },
      { type: Boolean, ok: true, ko: "1" },
      { type: String, ok: "1", ko: 1 },
      { type: Object, ok: {}, ko: "1" },
      { type: Date, ok: new Date(), ko: "1" },
      { type: Function, ok: () => {}, ko: "1" },
    ];
    let state: { p?: any };
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      get p() {
        return state.p;
      }
    }
    for (const test of Tests) {
      const SubComp = class extends Component {
        static template = xml`<div>hey</div>`;
        props = props({ p: { type: test.type } });
      };
      (Parent as any).components = { SubComp };
      state = {};
      let app = new App({ test: true });
      let error: OwlError | undefined;
      let mountProm = app
        .createRoot(Parent)
        .mount(fixture)
        .catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow(
        "[Owl] Unhandled error. Destroying the root component"
      );
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.cause.message).toBe(`Invalid component props (_a)`);
      expect(error!.cause.cause).toEqual({
        type: "props",
        expected: {
          p: {
            type: "missing prop",
            expected: { type: test.type },
            received: undefined,
          },
        },
        received: { p: undefined },
      });
      error = undefined;
      state = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeUndefined();
      state = { p: test.ko };
      app = new App({ test: true });
      mountProm = app
        .createRoot(Parent)
        .mount(fixture)
        .catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow(
        "[Owl] Unhandled error. Destroying the root component"
      );
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.cause.message).toBe(`Invalid component props (_a)`);
      expect(error!.cause.cause).toEqual({
        type: "props",
        expected: {
          p: {
            type: "type",
            expected: test.type,
            received: test.ko,
          },
        },
        received: { p: test.ko },
      });
    }
  });

  test.skip("can validate a prop with multiple types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: [String, Boolean] });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: any;
    let state: { p?: any };
    state = { p: "string" };
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: true };
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: 1 };
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "type (union)",
          expected: [String, Boolean],
          received: 1,
        },
      },
      received: { p: 1 },
    });
  });

  test.skip("can validate an optional props", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: { type: String, optional: true } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: any;
    let state: { p?: any };
    state = { p: "key" };
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = {};
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: 1 };
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "type",
          expected: String,
          received: 1,
        },
      },
      received: { p: 1 },
    });
  });

  test.skip("can validate an array with given primitive type", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: { type: Array, element: String } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: any;
    let state: { p?: any };
    try {
      state = { p: [] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      state = { p: ["string"] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      state = { p: [1] };
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error.cause.message).toBe("Invalid component props (SubComp)");
    expect(error.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "array element",
          expected: {
            [0]: {
              type: "type",
              expected: String,
              received: 1,
            },
          },
          received: [1],
        },
      },
      received: { p: [1] },
    });
    try {
      state = { p: [1] };
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
  });

  test.skip("can validate an array with multiple sub element types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: { type: Array, element: [String, Boolean] } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let state: { p?: any };
    let error: any;
    try {
      state = { p: [] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e;
    }
    expect(error!).toBeUndefined();
    try {
      state = { p: ["string"] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      state = { p: [false, true, "string"] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: [true, 1] };
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "array element",
          expected: {
            1: {
              type: "type (union)",
              expected: [String, Boolean],
              received: 1,
            },
          },
          received: [true, 1],
        },
      },
      received: { p: [true, 1] },
    });
  });

  test.skip("can validate an object with simple shape", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: { type: Object, shape: { id: Number, url: String } },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: any;
    let state: { p?: any };
    try {
      state = { p: { id: 1, url: "url" } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: { id: 1, url: "url", extra: true } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "shape",
          expected: {
            extra: {
              type: "unknown key",
              expected: undefined,
              received: true,
            },
          },
          received: { id: 1, url: "url", extra: true },
        },
      },
      received: { p: { id: 1, url: "url", extra: true } },
    });
    state = { p: { id: "1", url: "url" } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "shape",
          expected: {
            id: {
              type: "type",
              expected: Number,
              received: "1",
            },
          },
          received: { id: "1", url: "url" },
        },
      },
      received: { p: { id: "1", url: "url" } },
    });
    error = undefined;
    state = { p: { id: 1 } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "shape",
          expected: {
            url: {
              type: "missing key",
              expected: String,
              received: undefined,
            },
          },
          received: { id: 1 },
        },
      },
      received: { p: { id: 1 } },
    });
  });

  test.skip("can validate recursively complicated prop def", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: {
          type: Object,
          shape: {
            id: Number,
            url: [Boolean, { type: Array, element: Number }],
          },
        },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: any;
    let state: { p?: any };
    try {
      state = { p: { id: 1, url: true } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      state = { p: { id: 1, url: [12] } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: { id: 1, url: [12, true] } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e: any) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "shape",
          expected: {
            url: {
              type: "array element",
              expected: {
                1: {
                  type: "type",
                  expected: Number,
                  received: true,
                },
              },
              received: [12, true],
            },
          },
          received: { id: 1, url: [12, true] },
        },
      },
      received: { p: { id: 1, url: [12, true] } },
    });
  });

  test.skip("can validate optional attributes in nested sub props", async () => {
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        myprop: {
          type: Array,
          element: {
            type: Object,
            shape: {
              num: { type: Number, optional: true },
            },
          },
        },
      });
    }
    let error: Error;
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { myprop: [{}] } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { myprop: [{ a: 1 }] } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid component props (TestComponent)");
    expect((error! as any).cause).toEqual({
      type: "props",
      expected: {
        myprop: {
          type: "array element",
          expected: {
            0: {
              type: "shape",
              expected: {
                a: {
                  type: "unknown key",
                  expected: undefined,
                  received: 1,
                },
              },
              received: { a: 1 },
            },
          },
          received: [{ a: 1 }],
        },
      },
      received: { myprop: [{ a: 1 }] },
    });
  });

  test.skip("can validate with a custom validator", async () => {
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        size: {
          validate: (e: string) => ["small", "medium", "large"].includes(e),
        },
      });
    }
    let error: Error;
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { size: "small" } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { size: "abcdef" } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid component props (TestComponent)");
    expect((error! as any).cause).toEqual({
      type: "props",
      expected: {
        size: {
          type: "validate",
          expected: expect.anything(),
          received: "abcdef",
        },
      },
      received: { size: "abcdef" },
    });
  });

  test.skip("can validate with a custom validator, and a type", async () => {
    const validator = jest.fn((n) => 0 <= n && n <= 10);
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        n: {
          type: Number,
          validate: validator,
        },
      });
    }
    let error: Error | undefined;
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { n: 3 } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    expect(validator).toBeCalledTimes(1);
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { n: "str" } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid component props (TestComponent)");
    expect((error! as any).cause).toEqual({
      type: "props",
      expected: {
        n: {
          type: "type",
          expected: Number,
          received: "str",
        },
      },
      received: { n: "str" },
    });
    expect(validator).toBeCalledTimes(1);
    error = undefined;
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { n: 100 } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid component props (TestComponent)");
    expect((error! as any).cause).toEqual({
      type: "props",
      expected: {
        n: {
          type: "validate",
          expected: validator,
          received: 100,
        },
      },
      received: { n: 100 },
    });
    expect(validator).toBeCalledTimes(2);
  });

  test.skip("props are validated in dev mode (code snapshot)", async () => {
    class Child extends Component {
      static template = xml`<div><t t-out="this.props.message"/></div>`;
      props = props(["message"]);
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><Child message="1"/></div>`;
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
  });

  test.skip("props: list of strings with optional props", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props(["message", "someProp?"]);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { someProp: 1 } as any,
      })
    ).rejects.toThrow(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1 } as any,
      })
    ).resolves.toEqual(expect.anything());
  });

  test.skip("props: can be defined with a boolean", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: true } as const).message;
    }
    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: {},
      })
    ).rejects.toThrow(expect.anything());
  });

  test.skip("props with type array, and no element", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ myprop: { type: Array } });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: [1] } as any,
      })
    ).resolves.toEqual(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: 1 } as any,
      })
    ).rejects.toThrow("Invalid component props (SubComp)");
  });

  test.skip("props with type object, and no shape", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ myprop: { type: Object } });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: { a: 3 } } as any,
      })
    ).resolves.toEqual(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: false } as any,
      })
    ).rejects.toThrow("Invalid component props (SubComp)");
  });

  test.skip("props: extra props cause an error", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props(["message"]);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1, flag: true } as any,
      })
    ).rejects.toThrow(expect.anything());
  });

  test.skip("props: extra props cause an error, part 2", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: true } as const);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1, flag: true } as any,
      })
    ).rejects.toThrow(expect.anything());
  });

  test.skip("props: optional prop do not cause an error", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props(["message?"]);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1 } as any,
      })
    ).resolves.toEqual(expect.anything());
  });

  test.skip("optional prop do not cause an error if value is undefined", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: { type: String, optional: true } });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: undefined } as any,
      })
    ).resolves.toEqual(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: null } as any,
      })
    ).rejects.toThrow(expect.anything());
  });

  test.skip("missing required boolean prop causes an error", async () => {
    class SubComp extends Component {
      static template = xml`<span><t t-if="this.props.p">hey</t></span>`;
      props = props(["p"]);
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/></div>`;
      static components = { SubComp };
    }
    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (SubComp)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "missing prop",
          expected: { optional: false },
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("props are validated whenever component is updated", async () => {
    // fixme
    let error: Error;
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: { type: Number } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.state.p"/></div>`;
      static components = { SubComp };
      state: any = { p: 1 };
      setup() {
        onError((e) => (error = e));
      }
    }
    const parent = await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    parent.state.p = undefined;
    parent.render();
    await nextTick();
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid component props (SubComp)");
    expect((error! as any).cause).toEqual({
      type: "props",
      expected: {
        p: {
          type: "mandatory value",
          expected: { type: Number },
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("default values are applied before validating props at update", async () => {
    // need to do something about errors catched in render
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({
        p: {
          type: Number,
          optional: true,
          defaultValue: 4,
        },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.state.p"/></div>`;
      static components = { SubComp };
      state: any = { p: 1 };
    }

    const parent = await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    parent.state.p = undefined;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test.skip("mix of optional and mandatory", async () => {
    class Child extends Component {
      static template = xml` <div><t t-out="this.props.mandatory"/></div>`;
      props = props({
        optional: { type: String, optional: true },
        mandatory: Number,
      });
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><Child/></div>`;
    }
    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (Child)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        mandatory: {
          type: "missing prop",
          expected: Number,
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("additional props are allowed (array)", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props(["message"]);
    }
    class Parent extends Component {
      static template = xml`<Child message="'m'" otherProp="'o'"/>`;
      static components = { Child };
    }

    await expect(mount(Parent, fixture, { dev: true })).resolves.toEqual(expect.anything());
  });

  test.skip("additional props are allowed (object)", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        message: { type: String },
      });
    }
    class Parent extends Component {
      static template = xml`<Child message="'m'" otherProp="'o'"/>`;
      static components = { Child };
    }

    // we just check that it doesn't throw
    await expect(mount(Parent, fixture, { dev: true })).resolves.toEqual(expect.anything());
  });

  test.skip("can validate through slots", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props(["message"]);
    }

    class Wrapper extends Component {
      static template = xml`<t t-call-slot="default"/>`;
      props = props(["slots"]);
    }

    class Parent extends Component {
      static components = { Child, Wrapper };
      static template = xml`<Wrapper><Child /></Wrapper>`;
    }

    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (Child)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        message: {
          type: "missing prop",
          expected: { optional: false },
          received: undefined,
        },
      },
      received: {},
    });
  });

  test.skip("can use custom class as type", async () => {
    class CustomClass {
      val = "hey";
    }
    class Child extends Component {
      static template = xml`<t t-out="this.props.customObj.val"/>`;
      props = props({ customObj: CustomClass });
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child customObj="this.customObj" />`;
      customObj = new CustomClass();
    }

    await mount(Parent, fixture, { test: true });
    expect(fixture.innerHTML).toBe("hey");
  });

  test.skip("can use custom class as type: validation failure", async () => {
    class CustomClass {}
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ customObj: CustomClass });
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child customObj="this.customObj" />`;
      customObj = {};
    }

    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toBe("Invalid component props (Child)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        customObj: {
          type: "type",
          expected: CustomClass,
          received: {},
        },
      },
      received: { customObj: {} },
    });
  });
});

//------------------------------------------------------------------------------
// Default props
//------------------------------------------------------------------------------

describe("default props", () => {
  test.skip("can set default values", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({
        p: {
          optional: true,
          defaultValue: 4,
        },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp /></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test.skip("default values are also set whenever component is updated", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({
        p: {
          optional: true,
          defaultValue: 4,
        },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.state.p"/></div>`;
      static components = { SubComp };
      state: any = { p: 1 };
    }
    const parent = await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    parent.state.p = undefined;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test.skip("can set default boolean values", async () => {
    class SubComp extends Component {
      static template = xml`<span><t t-if="this.props.p">hey</t><t t-if="!this.props.q">hey</t></span>`;
      props = props({
        p: {
          optional: true,
          defaultValue: true,
        },
        q: {
          optional: true,
          defaultValue: false,
        },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><span>heyhey</span></div>");
  });

  test.skip("a default prop cannot be defined on a mandatory prop", async () => {
    class Child extends Component {
      static template = xml` <div><t t-out="this.props.mandatory"/></div>`;
      props = props({
        mandatory: {
          type: Number,
          defaultValue: 3,
        },
      });
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child/>`;
    }
    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!).toBeDefined();
    expect(error!.cause.message).toBe("Invalid component props (Child)");
    expect(error!.cause.cause).toEqual({
      type: "props",
      expected: {
        mandatory: {
          type: "mandatory value with default",
          expected: undefined,
          received: 3,
        },
      },
      received: {},
    });
  });
});
