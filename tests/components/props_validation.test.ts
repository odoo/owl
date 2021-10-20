import { makeTestFixture, nextTick, snapshotApp } from "../helpers";
import { Component, useState, xml } from "../../src";
import { App, DEV_MSG } from "../../src/app";
import { validateProps } from "../../src/component/props_validation";

let fixture: HTMLElement;

const info = console.info;

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
});

async function mountApp(Root: any, dev: boolean = true) {
  const app = new App(Root);
  app.configure({ dev });
  await app.mount(fixture);
  snapshotApp(app);
  return app;
}

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
    let error;

    try {
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(`Missing props 'message' (component 'SubComp')`);
    error = undefined;

    try {
      await mountApp(Parent, false);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
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

    let error;
    try {
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(`Missing props 'message' (component 'SubComp')`);
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

      let error;
      props = {};

      try {
        await mountApp(Parent);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe(`Missing props 'p' (component '_a')`);
      error = undefined;
      props = { p: test.ok };
      try {
        await mountApp(Parent);
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();
      props = { p: test.ko };
      try {
        await mountApp(Parent);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe("Invalid Prop 'p' in component '_a'");
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
      let error;
      props = {};
      try {
        await mountApp(Parent);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe(`Missing props 'p' (component '_a')`);
      error = undefined;
      props = { p: test.ok };
      try {
        await mountApp(Parent);
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();
      props = { p: test.ko };
      try {
        await mountApp(Parent);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe("Invalid Prop 'p' in component '_a'");
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
    let error;
    let props: { p?: any };
    try {
      props = { p: "string" };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: true };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: 1 };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    let error;
    let props: { p?: any };
    try {
      props = { p: "key" };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = {};
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: 1 };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    let error;
    let props: { p?: any };
    try {
      props = { p: [] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: ["string"] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: [1] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    error = undefined;
    try {
      props = { p: ["string", 1] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
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
    let error;
    let props: { p?: any };
    try {
      props = { p: [] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: ["string"] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: [false, true, "string"] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: [true, 1] };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    let error;
    let props: { p?: any };
    try {
      props = { p: { id: 1, url: "url" } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: { id: 1, url: "url", extra: true } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid prop 'p' in component SubComp (unknown prop 'extra')");
    try {
      props = { p: { id: "1", url: "url" } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'SubComp'");
    error = undefined;
    try {
      props = { p: { id: 1 } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    let error;
    let props: { p?: any };
    try {
      props = { p: { id: 1, url: true } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: { id: 1, url: [12] } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      props = { p: { id: 1, url: [12, true] } };
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'SubComp'");
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
    let error;
    try {
      validateProps(TestComponent as any, { myprop: [{}] });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      validateProps(TestComponent as any, { myprop: [{ a: 1 }] });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(
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
    let error;
    try {
      validateProps(TestComponent as any, { size: "small" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    try {
      validateProps(TestComponent as any, { size: "abcdef" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'size' in component 'TestComponent'");
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
    let error;
    try {
      validateProps(TestComponent as any, { n: 3 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    expect(validator).toBeCalledTimes(1);
    try {
      validateProps(TestComponent as any, { n: "str" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'n' in component 'TestComponent'");
    expect(validator).toBeCalledTimes(1);
    error = null;
    try {
      validateProps(TestComponent as any, { n: 100 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'n' in component 'TestComponent'");
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
    await mountApp(Parent);
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
    let error;
    try {
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'p' (component 'SubComp')");
  });

  test("props are validated whenever component is updated", async () => {
    let error;
    class SubComp extends Component {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="state.p"/></div>`;
      static components = { SubComp };
      state: any = { p: 1 };
    }
    const app = await mountApp(Parent);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    try {
      (app as any).root.component.state.p = undefined;
      await (app as any).root.component.render();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'p' (component 'SubComp')");
  });

  test.skip("default values are applied before validating props at update", async () => {
    // need to do something about errors catched in render
    class SubComp extends Component {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;
      static defaultProps = { p: 4 };
    }
    class Parent extends Component {
      static template = xml`<div><SubComp p="state.p"/></div>`;
      static components = { SubComp };
      state: any = useState({ p: 1 });
    }

    const app = await mountApp(Parent);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    (app as any).root.component.state.p = undefined;
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
    let error;
    try {
      await mountApp(Parent);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'mandatory' (component 'Child')");
  });
});

//------------------------------------------------------------------------------
// Default props
//------------------------------------------------------------------------------

describe.skip("default props", () => {
  test("can set default values", async () => {
    // class SubComp extends Component {
    //   static defaultProps = { p: 4 };
    //   static template = xml`<div><t t-esc="props.p"/></div>`;
    // }
    // class Parent extends Component {
    //   static template = xml`<div><SubComp /></div>`;
    //   static components = { SubComp };
    // }
    // const w = new Parent();
    // await w.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("default values are also set whenever component is updated", async () => {
    // class SubComp extends Component {
    //   static template = xml`<div><t t-esc="props.p"/></div>`;
    //   static defaultProps = { p: 4 };
    // }
    // class Parent extends Component {
    //   static template = xml`<div><SubComp p="state.p"/></div>`;
    //   static components = { SubComp };
    //   state: any = useState({ p: 1 });
    // }
    // const w = new Parent();
    // await w.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    // w.state.p = undefined;
    // await nextTick();
    // expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("can set default required boolean values", async () => {
    // class SubComp extends Component {
    //   static props = ["p", "q"];
    //   static defaultProps = { p: true, q: false };
    //   static template = xml`<span><t t-if="props.p">hey</t><t t-if="!props.q">hey</t></span>`;
    // }
    // class App extends Component {
    //   static template = xml`<div><SubComp/></div>`;
    //   static components = { SubComp };
    // }
    // const w = new App(undefined, {});
    // await w.mount(fixture);
    // expect(fixture.innerHTML).toBe("<div><span>heyhey</span></div>");
  });
});
