import { applyDefaults, Component, mount, onError, props, types as t, xml } from "../../src";
import {
  makeTestFixture,
  nextTick,
  render,
  snapshotEverything,
  getConsoleOutput,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
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

    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");

    error = undefined;
    try {
      await mount(Parent, fixture, { dev: false });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
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

    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");
  });

  test("validate props for root component", async () => {
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
    expect(error!.message).toMatch("Invalid component props (Root)");
    expect(getConsoleOutput()).toEqual([`info:Owl is running in 'dev' mode.`]);
  });

  test("validate simple types", async () => {
    const Tests = [
      { type: t.number(), ok: 1, ko: "1" },
      { type: t.boolean(), ok: true, ko: "1" },
      { type: t.string(), ok: "1", ko: 1 },
      { type: t.object(), ok: {}, ko: "1" },
      { type: t.instanceOf(Date), ok: new Date(), ko: "1" },
      { type: t.function(), ok: () => {}, ko: "1" },
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

      let error: any;

      state = {};
      try {
        await mount(Parent, fixture, { test: true });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatch(`Invalid component props (SubComp)`);

      error = undefined;
      state = { p: test.ok };
      try {
        await mount(Parent, fixture, { dev: true });
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();

      error = undefined;
      state = { p: test.ko };
      try {
        await mount(Parent, fixture, { test: true });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toMatch(`Invalid component props (SubComp)`);
    }
  });

  test("can validate a prop with multiple types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: t.or([t.string(), t.boolean()]) });
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
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate an optional props", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: t.string().optional() });
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
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate an array with given primitive type", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: t.array(t.string()) });
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
    expect(error.message).toMatch("Invalid component props (SubComp)");
    try {
      state = { p: [1] };
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
  });

  test("can validate an array with multiple sub element types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: t.array(t.or([t.string(), t.boolean()])) });
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
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate an object with simple shape", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: t.object({ id: t.number(), url: t.string() }),
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
    expect(error!).toBeUndefined();
    state = { p: { id: "1", url: "url" } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.message).toMatch("Invalid component props (SubComp)");
    error = undefined;
    state = { p: { id: 1 } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate recursively complicated prop def", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: t.object({
          id: t.number(),
          url: t.or([t.boolean(), t.array(t.number())]),
        }),
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
    expect(error!.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate optional attributes in nested sub props", async () => {
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        myprop: t.array(t.object({ num: t.number().optional() })),
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
    expect(error!).toBeUndefined();
  });

  test("can validate with a custom validator", async () => {
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        size: t.customValidator(t.string(), (e: string) =>
          ["small", "medium", "large"].includes(e)
        ),
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
    expect(error!.message).toMatch("Invalid component props (TestComponent)");
  });

  test("can validate with a custom validator, and a type", async () => {
    const validator = vi.fn((n) => 0 <= n && n <= 10);
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        n: t.customValidator(t.number(), validator),
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
    expect(validator).toHaveBeenCalledTimes(1);
    try {
      await mount(TestComponent, fixture, {
        dev: true,
        props: { n: "str" } as any,
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toMatch("Invalid component props (TestComponent)");
    expect(validator).toHaveBeenCalledTimes(1);
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
    expect(error!.message).toMatch("Invalid component props (TestComponent)");
    expect(validator).toHaveBeenCalledTimes(2);
  });

  test("props are validated in dev mode (code snapshot)", async () => {
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

  test("props: shape with optional props", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: t.any(), someProp: t.any().optional() });
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

  test("props: can be defined with a type any", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: t.any() });
    }
    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: {} as any,
      })
    ).rejects.toThrow(expect.anything());
  });

  test("props with type array, and no element", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ myprop: t.array() });
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

  test("props with type object, and no shape", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ myprop: t.object() });
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
      props = props({ message: t.any() });
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
      props = props({ message: t.any().optional() });
    }

    await expect(
      mount(SubComp, fixture, {
        dev: true,
        props: { message: 1 } as any,
      })
    ).resolves.toEqual(expect.anything());
  });

  test("optional prop do not cause an error if value is undefined", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: t.string().optional() });
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

  test("missing required boolean prop causes an error", async () => {
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
    expect(error!.message).toMatch("Invalid component props (SubComp)");
  });

  test.skip("props are validated whenever component is updated", async () => {
    // fixme
    let error: Error;
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number() });
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
    render(parent);
    await nextTick();
    expect(error!).toBeDefined();
    expect(error!.message).toMatch("Invalid component props (SubComp)");
  });

  test("default values are applied before validating props at update", async () => {
    // need to do something about errors catched in render
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number().optional(4) });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.state.p"/></div>`;
      static components = { SubComp };
      state: any = { p: 1 };
    }

    const parent = await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    parent.state.p = undefined;
    render(parent);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("mix of optional and mandatory", async () => {
    class Child extends Component {
      static template = xml` <div><t t-out="this.props.mandatory"/></div>`;
      props = props({
        optional: t.string().optional(),
        mandatory: t.number(),
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
    expect(error!.message).toMatch("Invalid component props (Child)");
  });

  test("additional props are allowed (array)", async () => {
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

  test("additional props are allowed (object)", async () => {
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        message: t.string(),
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
      static template = xml`<t t-call-slot="default"/>`;
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
    expect(error!.message).toMatch("Invalid component props (Child)");
  });

  test("can use custom class as type", async () => {
    class CustomClass {
      val = "hey";
    }
    class Child extends Component {
      static template = xml`<t t-out="this.props.customObj.val"/>`;
      props = props({ customObj: t.instanceOf(CustomClass) });
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child customObj="this.customObj" />`;
      customObj = new CustomClass();
    }

    await mount(Parent, fixture, { test: true });
    expect(fixture.innerHTML).toBe("hey");
  });

  test("can use custom class as type: validation failure", async () => {
    class CustomClass {}
    class Child extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ customObj: t.instanceOf(CustomClass) });
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
    expect(error!.message).toMatch("Invalid component props (Child)");
  });
});

//------------------------------------------------------------------------------
// Schema defaults (.optional(value))
//------------------------------------------------------------------------------

describe("schema defaults", () => {
  test("default values can be declared in the schema", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number().optional(4) });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp /></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("a key with a schema default may be omitted", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number().optional(4) });
    }
    // no error in dev mode even though p is not given
    await mount(SubComp, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div>4</div>");
  });

  test("schema defaults work next to optional props", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/>|<t t-out="this.props.q"/></div>`;
      props = props({ p: t.number().optional(4), q: t.string().optional() });
    }
    await mount(SubComp, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div>4|</div>");
  });

  test("schema defaults are applied whenever component is updated", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number().optional(4) });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="this.state.p"/></div>`;
      static components = { SubComp };
      state: any = { p: 1 };
    }
    const parent = await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    parent.state.p = undefined;
    render(parent);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("falsy default values are applied", async () => {
    class SubComp extends Component {
      static template = xml`<span><t t-if="this.props.p">hey</t><t t-if="!this.props.q">hey</t></span>`;
      props = props({
        p: t.boolean().optional(true),
        q: t.boolean().optional(false),
      });
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><span>heyhey</span></div>");
  });

  test("factory defaults are resolved once per component instance", async () => {
    const values: number[][] = [];
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p.length"/></div>`;
      props: any = props({ p: t.array(t.number()).optional(() => []) });
      setup() {
        values.push(this.props.p);
      }
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/><SubComp/></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>0</div><div>0</div></div>");
    expect(values).toHaveLength(2);
    expect(values[0]).not.toBe(values[1]);
  });

  test("a plain default value is shared between component instances", async () => {
    const defaultValue: number[] = [];
    const values: number[][] = [];
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p.length"/></div>`;
      props: any = props({ p: t.array(t.number()).optional(defaultValue) });
      setup() {
        values.push(this.props.p);
      }
    }
    class Parent extends Component {
      static template = xml`<div><SubComp/><SubComp/></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div><div>0</div><div>0</div></div>");
    expect(values).toHaveLength(2);
    expect(values[0]).toBe(defaultValue);
    expect(values[1]).toBe(defaultValue);
  });

  test("schema defaults are validated in dev mode", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number().optional("4" as any) });
    }
    let error: any;
    try {
      await mount(SubComp, fixture, { dev: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component default props (SubComp)");
  });
});

//------------------------------------------------------------------------------
// Schema given as a type validator (t.object(...), t.and(...), ...) — see #1966
//------------------------------------------------------------------------------

describe("props from a type validator schema", () => {
  test("an object type validator can be used as the schema", async () => {
    let captured: any;
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.title"/></div>`;
      props = props(t.object({ title: t.string(), color: t.string().optional("red") }));
      setup() {
        captured = this.props;
      }
    }
    class Parent extends Component {
      static template = xml`<div><SubComp title="'hello'"/></div>`;
      static components = { SubComp };
    }
    await mount(Parent, fixture, { test: true });
    expect(fixture.innerHTML).toBe("<div><div>hello</div></div>");
    // a schema default is filled, and the declared key is reactive-readable
    expect(captured.color).toBe("red");
  });

  test("an intersection (t.and) schema does not report a spurious 'optional' key", async () => {
    // Minimal reproduction of #1966: passing a composed schema to props()
    // used to fail validation with missingKeys: ["optional"].
    const OptionSchema = t.object({
      type: t.selection(["warning", "danger"]).optional("warning"),
      title: t.string().optional(),
      autocloseDelay: t.number().optional(4000),
    });
    const Schema = t.and([t.object({ message: t.string() }), OptionSchema]);

    let captured: any;
    class Notification extends Component {
      static template = xml`<h1/>`;
      props = props(Schema);
      setup() {
        captured = this.props;
      }
    }
    class Root extends Component {
      static components = { Notification };
      static template = xml`<Notification message="'hello'" title="'DEBUG'"/>`;
    }
    await mount(Root, fixture, { test: true });
    expect(captured.message).toBe("hello");
    expect(captured.title).toBe("DEBUG");
    // top-level defaults from either member of the intersection are applied
    expect(captured.type).toBe("warning");
    expect(captured.autocloseDelay).toBe(4000);
  });

  test("a validator schema still rejects invalid props", async () => {
    class SubComp extends Component {
      static template = xml`<div/>`;
      props = props(t.object({ count: t.number() }));
    }
    class Parent extends Component {
      static template = xml`<div><SubComp count="'not a number'"/></div>`;
      static components = { SubComp };
    }
    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");
    expect(error.message).toMatch("value is not a number");
  });

  test("a validator schema reports genuinely missing required keys", async () => {
    class SubComp extends Component {
      static template = xml`<div/>`;
      props = props(t.and([t.object({ a: t.string() }), t.object({ b: t.string() })]));
    }
    class Parent extends Component {
      static template = xml`<div><SubComp a="'x'"/></div>`;
      static components = { SubComp };
    }
    let error: any;
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid component props (SubComp)");
    expect(error.message).toMatch("missing keys");
    expect(error.message).toMatch('"b"');
    // crucially, "optional" is not reported as a missing key
    expect(error.message).not.toMatch('"optional"');
  });

  test("applyDefaults completes nested defaults from the same schema", async () => {
    const Schema = t.and([
      t.object({ message: t.string() }),
      t.object({
        autocloseDelay: t.number().optional(4000),
        buttons: t
          .array(t.object({ name: t.string(), primary: t.boolean().optional(false) }))
          .optional(() => []),
      }),
    ]);

    let captured: any;
    class Notification extends Component {
      static template = xml`<h1/>`;
      props = applyDefaults(props(Schema), Schema);
      setup() {
        captured = this.props;
      }
    }
    class Root extends Component {
      static components = { Notification };
      static template = xml`<Notification message="'hi'" buttons="[{ name: 'ok' }]"/>`;
    }
    await mount(Root, fixture, { test: true });
    expect(captured.message).toBe("hi");
    expect(captured.autocloseDelay).toBe(4000);
    // nested default inside the array element is filled by applyDefaults
    expect(captured.buttons).toEqual([{ name: "ok", primary: false }]);
  });
});
