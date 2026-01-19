import { Component, mount, onError, OwlError, props, types as t, xml } from "../../src";
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
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
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
      "[Owl] Unhandled error. Destroying the root component"
    );
    await mountProm;
    expect(error!).toBeDefined();
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
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
  });

  test("validate simple types", async () => {
    const Tests = [
      { type: t.number, ok: 1, ko: "1" },
      { type: t.boolean, ok: true, ko: "1" },
      { type: t.string, ok: "1", ko: 1 },
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
      expect(error!.cause.message).toMatch(`Invalid component props (SubComp)`);
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
      expect(error!.cause.message).toMatch(`Invalid component props (SubComp)`);
    }
  });

  test("can validate a prop with multiple types", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: t.union([t.string, t.boolean]) });
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
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate an optional props", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ "p?": t.string });
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
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate an array with given primitive type", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({ p: t.array(t.string) });
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
    expect(error.cause.message).toMatch("Invalid component props (SubComp)");
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
      props = props({ p: t.array(t.union([t.string, t.boolean])) });
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
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate an object with simple shape", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: t.object({ id: t.number, url: t.string }),
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
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
    error = undefined;
    state = { p: { id: 1 } };
    try {
      await mount(Parent, fixture, { test: true });
    } catch (e) {
      error = e;
    }
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate recursively complicated prop def", async () => {
    class SubComp extends Component {
      static template = xml`<div>hey</div>`;
      props = props({
        p: t.object({
          id: t.number,
          url: t.union([t.boolean, t.array(t.number)]),
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
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
  });

  test("can validate optional attributes in nested sub props", async () => {
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        myprop: t.array(t.object({ "num?": t.number })),
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
        size: t.customValidator(t.string, (e: string) => ["small", "medium", "large"].includes(e)),
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
    const validator = jest.fn((n) => 0 <= n && n <= 10);
    class TestComponent extends Component {
      static template = xml``;
      props = props({
        n: t.customValidator(t.number, validator),
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
    expect(error!.message).toMatch("Invalid component props (TestComponent)");
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
    expect(error!.message).toMatch("Invalid component props (TestComponent)");
    expect(validator).toBeCalledTimes(2);
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

  test("props: list of strings with optional props", async () => {
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

  test("props: can be defined with a type any", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ message: t.any });
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
      props = props({ message: t.any });
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
        props: { message: 1 } as any,
      })
    ).resolves.toEqual(expect.anything());
  });

  test("optional prop do not cause an error if value is undefined", async () => {
    class SubComp extends Component {
      static template = xml``;
      props = props({ "message?": t.string });
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
    expect(error!.cause.message).toMatch("Invalid component props (SubComp)");
  });

  test.skip("props are validated whenever component is updated", async () => {
    // fixme
    let error: Error;
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ p: t.number });
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
    expect(error!.message).toMatch("Invalid component props (SubComp)");
  });

  test("default values are applied before validating props at update", async () => {
    // need to do something about errors catched in render
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props({ "p?": t.number }, { p: 4 });
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
      static template = xml` <div><t t-out="this.props.mandatory"/></div>`;
      props = props({
        "optional?": t.string,
        mandatory: t.number,
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
    expect(error!.cause.message).toMatch("Invalid component props (Child)");
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
        message: t.string,
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
    expect(error!.cause.message).toMatch("Invalid component props (Child)");
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
    expect(error!.cause.message).toMatch("Invalid component props (Child)");
  });
});

//------------------------------------------------------------------------------
// Default props
//------------------------------------------------------------------------------

describe("default props", () => {
  test("can set default values", async () => {
    class SubComp extends Component {
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props(["p?"], { p: 4 });
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
      static template = xml`<div><t t-out="this.props.p"/></div>`;
      props = props(["p?"], { p: 4 });
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

  test("can set default boolean values", async () => {
    class SubComp extends Component {
      static template = xml`<span><t t-if="this.props.p">hey</t><t t-if="!this.props.q">hey</t></span>`;
      props = props(["p?", "q?"], { p: true, q: false });
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
      static template = xml` <div><t t-out="this.props.mandatory"/></div>`;
      props = props(["mandatory"], { mandatory: 3 });
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
    expect(error!.cause.message).toMatch("Invalid component props (Child)");
  });
});
