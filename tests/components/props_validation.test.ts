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
  test("validation is only done in dev mode", async () => {
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
      "Invalid props for component 'SubComp': 'message' is missing"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'message' is missing");
    error = undefined;

    try {
      await mount(Parent, fixture, { dev: false });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
  });

  test("props: list of strings", async () => {
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
      "Invalid props for component 'SubComp': 'message' is missing"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'message' is missing");
  });

  test("validate props for root component", async () => {
    class Root extends Component {
      static template = xml`<div t-esc="message"/>`;
      props = props(["message"]);
    }

    let error: Error;
    try {
      await mount(Root, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'Root': 'message' is missing");
  });

  test("validate simple types", async () => {
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
      static template = xml`<div><SubComp p="p"/></div>`;
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
      await expect(nextAppError(app)).resolves.toThrow("Invalid props for component '_a'");
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.message).toBe(
        `Invalid props for component '_a': 'p' is undefined (should be a ${test.type.name.toLowerCase()})`
      );
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
      await expect(nextAppError(app)).resolves.toThrow("Invalid props for component '_a'");
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.message).toBe(
        `Invalid props for component '_a': 'p' is not a ${test.type.name.toLowerCase()}`
      );
    }
  });

  test("validate simple types, alternate form", async () => {
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
      static template = xml`<div><SubComp p="p"/></div>`;
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
      await expect(nextAppError(app)).resolves.toThrow("Invalid props for component '_a'");
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.message).toBe(
        `Invalid props for component '_a': 'p' is undefined (should be a ${test.type.name.toLowerCase()})`
      );
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
      await expect(nextAppError(app)).resolves.toThrow("Invalid props for component '_a'");
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.message).toBe(
        `Invalid props for component '_a': 'p' is not a ${test.type.name.toLowerCase()}`
      );
    }
  });

  test("can validate a prop with multiple types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: [String, Boolean] });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: Error;
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
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' is not a string or boolean"
    );
  });

  test("can validate an optional props", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: { type: String, optional: true } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: Error;
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
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'p' is not a string");
  });

  test("can validate an array with given primitive type", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: { type: Array, element: String } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: Error | undefined;
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
    state = { p: [1] };
    let app = new App({ test: true });
    let mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    error = undefined;
    app = new App({ test: true });
    mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
  });

  test("can validate an array with multiple sub element types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: { type: Array, element: [String, Boolean] } });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: Error;
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
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p[1]' is not a string or boolean"
    );
  });

  test("can validate an object with simple shape", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: { type: Object, shape: { id: Number, url: String } },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: Error | undefined;
    let state: { p?: any };
    try {
      state = { p: { id: 1, url: "url" } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    state = { p: { id: 1, url: "url", extra: true } };
    let app = new App({ test: true });
    let mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape (unknown key 'extra')"
    );
    state = { p: { id: "1", url: "url" } };
    app = new App({ test: true });
    mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape ('id' is not a number)"
    );
    error = undefined;
    state = { p: { id: 1 } };
    app = new App({ test: true });
    mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape ('url' is missing (should be a string))"
    );
  });

  test("can validate recursively complicated prop def", async () => {
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
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return state.p;
      }
    }
    let error: Error;
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
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape ('url' is not a boolean or list of numbers)"
    );
  });

  test("can validate optional attributes in nested sub props", async () => {
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
        props: { myprop: [{}] },
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
    expect(error!.message).toBe(
      "Invalid props for component 'TestComponent': 'myprop[0]' doesn't have the correct shape (unknown key 'a')"
    );
  });

  test("can validate with a custom validator", async () => {
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
        props: { size: "small" },
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { size: "abcdef" },
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'TestComponent': 'size' is not valid");
  });

  test("can validate with a custom validator, and a type", async () => {
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
        props: { n: 3 },
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
    expect(error!.message).toBe("Invalid props for component 'TestComponent': 'n' is not a number");
    expect(validator).toBeCalledTimes(1);
    error = undefined;
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { n: 100 },
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'TestComponent': 'n' is not valid");
    expect(validator).toBeCalledTimes(2);
  });

  test("props are validated in dev mode (code snapshot)", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="this.props.message"/></div>`;
      props = props(["message"]);
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><Child message="1"/></div>`;
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
  });

  test("props: list of strings with optional props", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props(["message", "someProp?"]);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { someProp: 1 },
      })
    ).rejects.toThrow(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1 },
      })
    ).resolves.toEqual(expect.anything());
  });

  test("props: can be defined with a boolean", async () => {
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

  test("props with type array, and no element", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ myprop: { type: Array } });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: [1] },
      })
    ).resolves.toEqual(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: 1 } as any,
      })
    ).rejects.toThrow("Invalid props for component 'SubComp': 'myprop' is not a array");
  });

  test("props with type object, and no shape", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ myprop: { type: Object } });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: { a: 3 } },
      })
    ).resolves.toEqual(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { myprop: false },
      })
    ).rejects.toThrow("Invalid props for component 'SubComp': 'myprop' is not a object");
  });

  test.skip("props: extra props cause an error", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props(["message"]);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1, flag: true },
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

  test("props: optional prop do not cause an error", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props(["message?"]);
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1 },
      })
    ).resolves.toEqual(expect.anything());
  });

  test("optional prop do not cause an error if value is undefined", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: { type: String, optional: true } });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: undefined },
      })
    ).resolves.toEqual(expect.anything());

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: null } as any,
      })
    ).rejects.toThrow(expect.anything());
  });

  test("missing required boolean prop causes an error", async () => {
    class SubComp extends Component {
      static template = xml`<span><t t-if="this.props.p">hey</t></span>`;
      props = props(["p"]);
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/></div>`;
      static components = { SubComp };
    }
    let error: Error;
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'p' is missing");
  });

  test.skip("props are validated whenever component is updated", async () => {
    // fixme
    let error: Error;
    class SubComp extends Component {
      static template = xml`<div><t t-esc="this.props.p"/></div>`;
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
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' is undefined (should be a number)"
    );
  });

  test("default values are applied before validating props at update", async () => {
    // need to do something about errors catched in render
    class SubComp extends Component {
      static template = xml`<div><t t-esc="this.props.p"/></div>`;
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

  test("mix of optional and mandatory", async () => {
    class Child extends Component {
      static template = xml` <div><t t-esc="this.props.mandatory"/></div>`;
      props = props({
        optional: { type: String, optional: true },
        mandatory: Number,
      });
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><Child/></div>`;
    }
    let error: Error;
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'Child'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'Child': 'mandatory' is missing (should be a number)"
    );
  });

  test("can specify that additional props are allowed (array)", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props(["message", "*"]);
    }
    class Parent extends Component {
      static template = xml`<Child message="'m'" otherProp="'o'"/>`;
      static components = { Child };
    }

    await expect(mount(Parent, fixture, { dev: true })).resolves.toEqual(expect.anything());
  });

  test("can specify that additional props are allowed (object)", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        message: { type: String },
        "*": true,
      });
    }
    class Parent extends Component {
      static template = xml`<Child message="'m'" otherProp="'o'"/>`;
      static components = { Child };
    }

    // we just check that it doesn't throw
    await expect(mount(Parent, fixture, { dev: true })).resolves.toEqual(expect.anything());
  });

  test("can validate through slots", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props(["message"]);
    }

    class Wrapper extends Component {
      static template = xml`<t t-slot="default"/>`;
      props = props(["slots"]);
    }

    class Parent extends Component {
      static components = { Child, Wrapper };
      static template = xml`<Wrapper><Child /></Wrapper>`;
    }

    const app = new App({ test: true });
    let error: OwlError | undefined;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "Invalid props for component 'Child': 'message' is missing"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'Child': 'message' is missing");
  });

  test("can use custom class as type", async () => {
    class CustomClass {
      val = "hey";
    }
    class Child extends Component {
      static template = xml`<t t-esc="this.props.customObj.val"/>`;
      props = props({ customObj: CustomClass });
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child customObj="customObj" />`;
      customObj = new CustomClass();
    }

    await mount(Parent, fixture, { test: true });
    expect(fixture.innerHTML).toBe("hey");
  });

  test("can use custom class as type: validation failure", async () => {
    class CustomClass {}
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ customObj: CustomClass });
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child customObj="customObj" />`;
      customObj = {};
    }

    const app = new App({ test: true });
    let error: OwlError | undefined;
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "Invalid props for component 'Child': 'customObj' is not a customclass"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'Child': 'customObj' is not a customclass"
    );
  });
});

//------------------------------------------------------------------------------
// Default props
//------------------------------------------------------------------------------

describe("default props", () => {
  test("can set default values", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-esc="this.props.p"/></div>`;
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

  test("default values are also set whenever component is updated", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-esc="this.props.p"/></div>`;
      props = props({
        p: {
          optional: true,
          defaultValue: 4,
        },
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="state.p"/></div>`;
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

  test("can set default boolean values", async () => {
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

  test("a default prop cannot be defined on a mandatory prop", async () => {
    class Child extends Component {
      static template = xml` <div><t t-esc="this.props.mandatory"/></div>`;
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
    let error: Error;
    const app = new App({ test: true });
    const mountProm = app
      .createRoot(Parent)
      .mount(fixture)
      .catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "default value cannot be defined for the mandatory prop"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'Child': A default value cannot be defined for the mandatory prop 'mandatory', 'mandatory' is missing (should be a number)"
    );
  });
});
