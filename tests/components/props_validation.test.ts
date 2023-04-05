import { makeTestFixture, nextAppError, nextTick, snapshotEverything } from "../helpers";
import { Component, onError, xml, mount, OwlError, useState } from "../../src";
import { App, DEV_MSG } from "../../src/runtime/app";
import { validateProps } from "../../src/runtime/template_helpers";
import { Schema } from "../../src/runtime/validation";

let fixture: HTMLElement;

snapshotEverything();
const info = console.info;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;

beforeAll(() => {
  console.info = (message: any) => {
    if (message === DEV_MSG()) {
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
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }
    class Parent extends Component {
      static components = { SubComp };
      static template = xml`<div><SubComp /></div>`;
    }

    const app = new App(Parent, { test: true });
    let error: OwlError | undefined;
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
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
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }
    class Parent extends Component {
      static components = { SubComp };
      static template = xml`<div><SubComp /></div>`;
    }

    const app = new App(Parent, { test: true });
    let error: OwlError | undefined;
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "Invalid props for component 'SubComp': 'message' is missing"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'message' is missing");
  });

  test("validate props for root component", async () => {
    class Root extends Component {
      static props = ["message"];
      static template = xml`<div t-esc="message"/>`;
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
    let props: { p?: any };
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      get p() {
        return props.p;
      }
    }
    for (let test of Tests) {
      const SubComp = class extends Component {
        static template = xml`<div>hey</div>`;
        static props = { p: test.type };
      };
      (Parent as any).components = { SubComp };

      props = {};
      let app = new App(Parent, { test: true });
      let error: OwlError | undefined;
      let mountProm = app.mount(fixture).catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow("Invalid props for component '_a'");
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.message).toBe(
        `Invalid props for component '_a': 'p' is undefined (should be a ${test.type.name.toLowerCase()})`
      );
      error = undefined;
      props = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeUndefined();
      props = { p: test.ko };
      app = new App(Parent, { test: true });
      mountProm = app.mount(fixture).catch((e: Error) => (error = e));
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
    let props: { p?: any };
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      get p() {
        return props.p;
      }
    }
    for (let test of Tests) {
      const SubComp = class extends Component {
        static props = { p: { type: test.type } };
        static template = xml`<div>hey</div>`;
      };
      (Parent as any).components = { SubComp };
      props = {};
      let app = new App(Parent, { test: true });
      let error: OwlError | undefined;
      let mountProm = app.mount(fixture).catch((e: Error) => (error = e));
      await expect(nextAppError(app)).resolves.toThrow("Invalid props for component '_a'");
      await mountProm;
      expect(error!).toBeDefined();
      expect(error!.message).toBe(
        `Invalid props for component '_a': 'p' is undefined (should be a ${test.type.name.toLowerCase()})`
      );
      error = undefined;
      props = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeUndefined();
      props = { p: test.ko };
      app = new App(Parent, { test: true });
      mountProm = app.mount(fixture).catch((e: Error) => (error = e));
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
      static props = { p: [String, Boolean] };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return props.p;
      }
    }
    let error: Error;
    let props: { p?: any };
    props = { p: "string" };
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: true };
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: 1 };
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
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
      static props = { p: { type: String, optional: true } };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return props.p;
      }
    }
    let error: Error;
    let props: { p?: any };
    props = { p: "key" };
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = {};
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: 1 };
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'p' is not a string");
  });

  test("can validate an array with given primitive type", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: Array, element: String } };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return props.p;
      }
    }
    let error: Error | undefined;
    let props: { p?: any };
    try {
      props = { p: [] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: ["string"] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: [1] };
    let app = new App(Parent, { test: true });
    let mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    error = undefined;
    app = new App(Parent, { test: true });
    mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
  });

  test("can validate an array with multiple sub element types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: Array, element: [String, Boolean] } };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return props.p;
      }
    }
    let error: Error;
    let props: { p?: any };
    try {
      props = { p: [] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: ["string"] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: [false, true, "string"] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: [true, 1] };
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
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
      static props = {
        p: { type: Object, shape: { id: Number, url: String } },
      };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return props.p;
      }
    }
    let error: Error | undefined;
    let props: { p?: any };
    try {
      props = { p: { id: 1, url: "url" } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: { id: 1, url: "url", extra: true } };
    let app = new App(Parent, { test: true });
    let mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape (unknown key 'extra')"
    );
    props = { p: { id: "1", url: "url" } };
    app = new App(Parent, { test: true });
    mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape ('id' is not a number)"
    );
    error = undefined;
    props = { p: { id: 1 } };
    app = new App(Parent, { test: true });
    mountProm = app.mount(fixture).catch((e: Error) => (error = e));
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
      static props = {
        p: {
          type: Object,
          shape: {
            id: Number,
            url: [Boolean, { type: Array, element: Number }],
          },
        },
      };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="p"/></div>`;
      static components = { SubComp };
      get p() {
        return props.p;
      }
    }
    let error: Error;
    let props: { p?: any };
    try {
      props = { p: { id: 1, url: true } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: { id: 1, url: [12] } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    props = { p: { id: 1, url: [12, true] } };
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'SubComp': 'p' doesn't have the correct shape ('url' is not a boolean or list of numbers)"
    );
  });

  test("can validate optional attributes in nested sub props", () => {
    class TestComponent extends Component {
      static props = {
        myprop: {
          type: Array,
          element: {
            type: Object,
            shape: {
              num: { type: Number, optional: true },
            },
          },
        },
      };
    }
    let error: Error;
    try {
      validateProps(TestComponent as any, { myprop: [{}] });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      validateProps(TestComponent as any, { myprop: [{ a: 1 }] });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'TestComponent': 'myprop[0]' doesn't have the correct shape (unknown key 'a')"
    );
  });

  test("can validate with a custom validator", () => {
    class TestComponent extends Component {
      static props = {
        size: {
          validate: (e: string) => ["small", "medium", "large"].includes(e),
        },
      };
    }
    let error: Error;
    try {
      validateProps(TestComponent as any, { size: "small" });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      validateProps(TestComponent as any, { size: "abcdef" });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'TestComponent': 'size' is not valid");
  });

  test("can validate with a custom validator, and a type", () => {
    const validator = jest.fn((n) => 0 <= n && n <= 10);
    class TestComponent extends Component {
      static props = {
        n: {
          type: Number,
          validate: validator,
        },
      };
    }
    let error: Error | undefined;
    try {
      validateProps(TestComponent as any, { n: 3 });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    expect(validator).toBeCalledTimes(1);
    try {
      validateProps(TestComponent as any, { n: "str" });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'TestComponent': 'n' is not a number");
    expect(validator).toBeCalledTimes(1);
    error = undefined;
    try {
      validateProps(TestComponent as any, { n: 100 });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'TestComponent': 'n' is not valid");
    expect(validator).toBeCalledTimes(2);
  });

  test("props are validated in dev mode (code snapshot)", async () => {
    class Child extends Component {
      static props = ["message"];
      static template = xml`<div><t t-esc="props.message"/></div>`;
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
      static props = ["message", "someProp?"];
    }
    expect(() => {
      validateProps(SubComp as any, { someProp: 1 });
    }).toThrow();
    expect(() => {
      validateProps(SubComp as any, { message: 1 });
    }).not.toThrow();
  });

  test("props: can be defined with a boolean", async () => {
    class SubComp extends Component {
      static props = { message: true };
    }
    expect(() => {
      validateProps(SubComp as any, {});
    }).toThrow();
  });

  test("props with type array, and no element", async () => {
    class SubComp extends Component {
      static props = { myprop: { type: Array } };
    }
    expect(() => {
      validateProps(SubComp as any, { myprop: [1] });
    }).not.toThrow();
    expect(() => {
      validateProps(SubComp as any, { myprop: 1 });
    }).toThrow("Invalid props for component 'SubComp': 'myprop' is not a array");
  });

  test("props with type object, and no shape", async () => {
    class SubComp extends Component {
      static props = { myprop: { type: Object } };
    }
    expect(() => {
      validateProps(SubComp as any, { myprop: { a: 3 } });
    }).not.toThrow();
    expect(() => {
      validateProps(SubComp as any, { myprop: false });
    }).toThrow("Invalid props for component 'SubComp': 'myprop' is not a object");
  });

  test("props: extra props cause an error", async () => {
    class SubComp extends Component {
      static props = ["message"];
    }
    expect(() => {
      validateProps(SubComp as any, { message: 1, flag: true });
    }).toThrow();
  });

  test("props: extra props cause an error, part 2", async () => {
    class SubComp extends Component {
      static props = { message: true };
    }
    expect(() => {
      validateProps(SubComp as any, { message: 1, flag: true });
    }).toThrow();
  });

  test("props: optional prop do not cause an error", async () => {
    class SubComp extends Component {
      static props = ["message?"];
    }
    expect(() => {
      validateProps(SubComp as any, { message: 1 });
    }).not.toThrow();
  });

  test("optional prop do not cause an error if value is undefined", async () => {
    class SubComp extends Component {
      static props = { message: { type: String, optional: true } };
    }
    expect(() => {
      validateProps(SubComp as any, { message: undefined });
    }).not.toThrow();
    expect(() => {
      validateProps(SubComp as any, { message: null });
    }).toThrow();
  });

  test("missing required boolean prop causes an error", async () => {
    class SubComp extends Component {
      static props = ["p"];
      static template = xml`<span><t t-if="props.p">hey</t></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/></div>`;
      static components = { SubComp };
    }
    let error: Error;
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'SubComp'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'SubComp': 'p' is missing");
  });

  test("props validation does not cause additional subscription", async () => {
    let obj = {
      value: 1,
      otherValue: 2,
    };
    class Child extends Component {
      static props = {
        obj: { type: Object, shape: { value: Number, otherValue: Number } },
      };
      static template = xml`<t t-esc="props.obj.value"/>`;
    }
    class Parent extends Component {
      static template = xml`<Child obj="obj"/><t t-esc="obj.otherValue"/>`;
      static components = { Child };

      obj = useState(obj);
    }
    const app = new App(Parent, { test: true });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("12");
    expect(app.root!.subscriptions).toEqual([{ keys: ["otherValue"], target: obj }]);
  });

  test("props are validated whenever component is updated", async () => {
    let error: Error;
    class SubComp extends Component {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="state.p"/></div>`;
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
      static props = { p: { type: Number, optional: true } };
      static template = xml`<div><t t-esc="props.p"/></div>`;
      static defaultProps = { p: 4 };
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

  test("mix of optional and mandatory", async () => {
    class Child extends Component {
      static props = {
        optional: { type: String, optional: true },
        mandatory: Number,
      };
      static template = xml` <div><t t-esc="props.mandatory"/></div>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><Child/></div>`;
    }
    let error: Error;
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow("Invalid props for component 'Child'");
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "Invalid props for component 'Child': 'mandatory' is missing (should be a number)"
    );
  });

  test("can specify that additional props are allowed (array)", async () => {
    class Child extends Component {
      static props = ["message", "*"];
      static template = xml`<div>hey</div>`;
    }
    class Parent extends Component {
      static template = xml`<Child message="'m'" otherProp="'o'"/>`;
      static components = { Child };
    }

    await expect(mount(Parent, fixture, { dev: true })).resolves.toEqual(expect.anything());
  });

  test("can specify that additional props are allowed (object)", async () => {
    class Child extends Component {
      static props: Schema = {
        message: { type: String },
        "*": true,
      };
      static template = xml`<div>hey</div>`;
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
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }

    class Wrapper extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    class Parent extends Component {
      static components = { Child, Wrapper };
      static template = xml`<Wrapper><Child /></Wrapper>`;
    }

    const app = new App(Parent, { test: true });
    let error: OwlError | undefined;
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "Invalid props for component 'Child': 'message' is missing"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid props for component 'Child': 'message' is missing");
  });
});

//------------------------------------------------------------------------------
// Default props
//------------------------------------------------------------------------------

describe("default props", () => {
  test("can set default values", async () => {
    class SubComp extends Component {
      static defaultProps = { p: 4 };
      static template = xml`<div><t t-esc="props.p"/></div>`;
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
      static template = xml`<div><t t-esc="props.p"/></div>`;
      static defaultProps = { p: 4 };
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
      static props = ["p?", "q?"];
      static defaultProps = { p: true, q: false };
      static template = xml`<span><t t-if="props.p">hey</t><t t-if="!props.q">hey</t></span>`;
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
      static props = {
        mandatory: Number,
      };
      static defaultProps = { mandatory: 3 };
      static template = xml` <div><t t-esc="props.mandatory"/></div>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child/>`;
    }
    let error: Error;
    const app = new App(Parent, { test: true });
    const mountProm = app.mount(fixture).catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "default value cannot be defined for a mandatory prop"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "A default value cannot be defined for a mandatory prop (name: 'mandatory', component: Child)"
    );
  });
});
