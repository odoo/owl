import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import { Component, onError, xml, mount } from "../../src";
import { DEV_MSG } from "../../src/app/app";
import { validateProps } from "../../src/component/props_validation";

let fixture: HTMLElement;

snapshotEverything();
const info = console.info;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;

beforeAll(() => {
  console.info = (message: any) => {
    if (message === DEV_MSG) {
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
    let error: Error | undefined;

    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`Missing props 'message' (component 'SubComp')`);
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

    let error: Error;
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(`Missing props 'message' (component 'SubComp')`);
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

      let error: Error | undefined;
      props = {};

      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeDefined();
      expect(error!.message).toBe(`Missing props 'p' (component '_a')`);
      error = undefined;
      props = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeUndefined();
      props = { p: test.ko };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeDefined();
      expect(error!.message).toBe("Invalid Prop 'p' in component '_a'");
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
      let error: Error | undefined;
      props = {};
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeDefined();
      expect(error!.message).toBe(`Missing props 'p' (component '_a')`);
      error = undefined;
      props = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeUndefined();
      props = { p: test.ko };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e as Error;
      }
      expect(error!).toBeDefined();
      expect(error!.message).toBe("Invalid Prop 'p' in component '_a'");
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
    try {
      props = { p: "string" };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: true };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: 1 };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    try {
      props = { p: "key" };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = {};
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeUndefined();
    try {
      props = { p: 1 };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    try {
      props = { p: [1] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    error = undefined;
    try {
      props = { p: ["string", 1] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
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
    try {
      props = { p: [true, 1] };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    try {
      props = { p: { id: 1, url: "url", extra: true } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid prop 'p' in component SubComp (unknown prop 'extra')");
    try {
      props = { p: { id: "1", url: "url" } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'p' in component 'SubComp'");
    error = undefined;
    try {
      props = { p: { id: 1 } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    try {
      props = { p: { id: 1, url: [12, true] } };
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
      "Invalid prop 'myprop' in component TestComponent (unknown prop 'a')"
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
    expect(error!.message).toBe("Invalid Prop 'size' in component 'TestComponent'");
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
    expect(error!.message).toBe("Invalid Prop 'n' in component 'TestComponent'");
    expect(validator).toBeCalledTimes(1);
    error = undefined;
    try {
      validateProps(TestComponent as any, { n: 100 });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Invalid Prop 'n' in component 'TestComponent'");
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
    }).toThrow(`Invalid Prop 'myprop' in component 'SubComp'`);
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
    }).toThrow(`Invalid Prop 'myprop' in component 'SubComp'`);
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
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Missing props 'p' (component 'SubComp')");
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
    expect(error!.message).toBe("Missing props 'p' (component 'SubComp')");
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
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Missing props 'mandatory' (component 'Child')");
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
      static props = {
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
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe(
      "A default value cannot be defined for a mandatory prop (name: 'mandatory', component: Child)"
    );
  });
});
