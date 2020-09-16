import { Component, Env } from "../../src/component/component";
import { makeTestFixture, makeTestEnv, nextTick } from "../helpers";
import { useState } from "../../src/hooks";
import { QWeb } from "../../src/qweb";
import { xml } from "../../src/tags";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: Env;
let dev: boolean = false;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  Component.env = env;
  dev = QWeb.dev;
  QWeb.dev = true;
});

afterEach(() => {
  fixture.remove();
  QWeb.dev = dev;
});

class Widget extends Component {}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------
describe("props validation", () => {
  test("validation is only done in dev mode", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }
    class Parent extends Widget {
      static components = { TestWidget };
      static template = xml`<div><TestWidget /></div>`;
    }

    let error;
    QWeb.dev = true;
    try {
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(`Missing props 'message' (component 'TestWidget')`);

    error = undefined;

    QWeb.dev = false;
    try {
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
  });

  test("props: list of strings", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }
    class Parent extends Widget {
      static components = { TestWidget };
      static template = xml`<div><TestWidget /></div>`;
    }

    let error;
    try {
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe(`Missing props 'message' (component 'TestWidget')`);
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

    let props;
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      get p() {
        return props.p;
      }
    }
    for (let test of Tests) {
      let TestWidget = class extends Widget {
        static template = xml`<div>hey</div>`;
        static props = { p: test.type };
      };
      Parent.components = { TestWidget };

      let error;
      props = {};
      try {
        const p = new Parent();
        await p.mount(fixture);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe(`Missing props 'p' (component '_a')`);

      error = undefined;
      props = { p: test.ok };
      try {
        const p = new Parent();
        await p.mount(fixture);
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();

      props = { p: test.ko };
      try {
        const p = new Parent();
        await p.mount(fixture);
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

    let props;
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      get p() {
        return props.p;
      }
    }
    for (let test of Tests) {
      let TestWidget = class extends Component {
        static props = { p: { type: test.type } };
        static template = xml`<div>hey</div>`;
      };
      Parent.components = { TestWidget };

      let error;
      props = {};
      try {
        const p = new Parent();
        await p.mount(fixture);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe(`Missing props 'p' (component '_a')`);

      error = undefined;
      props = { p: test.ok };
      try {
        const p = new Parent();
        await p.mount(fixture);
      } catch (e) {
        error = e;
      }
      expect(error).toBeUndefined();

      props = { p: test.ko };
      try {
        const p = new Parent();
        await p.mount(fixture);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe("Invalid Prop 'p' in component '_a'");
    }
  });

  test("can validate a prop with multiple types", async () => {
    class TestWidget extends Component {
      static template = xml`<div>hey</div>`;
      static props = { p: [String, Boolean] };
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      static components = { TestWidget };
      get p() {
        return props.p;
      }
    }

    let error;
    let props;
    try {
      props = { p: "string" };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: true };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: 1 };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'TestWidget'");
  });

  test("can validate an optional props", async () => {
    class TestWidget extends Component {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: String, optional: true } };
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      static components = { TestWidget };
      get p() {
        return props.p;
      }
    }

    let error;
    let props;
    try {
      props = { p: "key" };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = {};
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: 1 };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'TestWidget'");
  });

  test("can validate an array with given primitive type", async () => {
    class TestWidget extends Component {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: Array, element: String } };
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      static components = { TestWidget };
      get p() {
        return props.p;
      }
    }

    let error;
    let props;
    try {
      props = { p: [] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: ["string"] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: [1] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();

    error = undefined;
    try {
      props = { p: ["string", 1] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
  });

  test("can validate an array with multiple sub element types", async () => {
    class TestWidget extends Component {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: Array, element: [String, Boolean] } };
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      static components = { TestWidget };
      get p() {
        return props.p;
      }
    }

    let error;
    let props;
    try {
      props = { p: [] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: ["string"] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: [false, true, "string"] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: [true, 1] };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'TestWidget'");
  });

  test("can validate an object with simple shape", async () => {
    class TestWidget extends Component {
      static template = xml`<div>hey</div>`;
      static props = {
        p: { type: Object, shape: { id: Number, url: String } },
      };
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="p"/></div>`;
      static components = { TestWidget };
      get p() {
        return props.p;
      }
    }

    let error;
    let props;
    try {
      props = { p: { id: 1, url: "url" } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: { id: 1, url: "url", extra: true } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid prop 'p' in component TestWidget (unknown prop 'extra')");

    try {
      props = { p: { id: "1", url: "url" } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'TestWidget'");

    error = undefined;
    try {
      props = { p: { id: 1 } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'TestWidget'");
  });

  test("can validate recursively complicated prop def", async () => {
    class TestWidget extends Component {
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
      static template = xml`<div><TestWidget p="p"/></div>`;
      static components = { TestWidget };
      get p() {
        return props.p;
      }
    }

    let error;
    let props;
    try {
      props = { p: { id: 1, url: true } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: { id: 1, url: [12] } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      props = { p: { id: 1, url: [12, true] } };
      const p = new Parent();
      await p.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'p' in component 'TestWidget'");
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
      QWeb.utils.validateProps(TestComponent, { myprop: [{}] });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      QWeb.utils.validateProps(TestComponent, { myprop: [{ a: 1 }] });
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
          validate: (e) => ["small", "medium", "large"].includes(e),
        },
      };
    }
    let error;
    try {
      QWeb.utils.validateProps(TestComponent, { size: "small" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();

    try {
      QWeb.utils.validateProps(TestComponent, { size: "abcdef" });
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
      QWeb.utils.validateProps(TestComponent, { n: 3 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
    expect(validator).toBeCalledTimes(1);

    try {
      QWeb.utils.validateProps(TestComponent, { n: "str" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'n' in component 'TestComponent'");
    expect(validator).toBeCalledTimes(1);

    error = null;
    try {
      QWeb.utils.validateProps(TestComponent, { n: 100 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Invalid Prop 'n' in component 'TestComponent'");
    expect(validator).toBeCalledTimes(2);
  });

  test("props are validated in dev mode (code snapshot)", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App">
          <Child message="1"/>
        </div>
        <div t-name="Child"><t t-esc="props.message"/></div>
      </templates>`);

    class Child extends Widget {
      static props = ["message"];
    }
    class App extends Widget {
      static components = { Child };
    }
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    // need to make sure there are 2 call to update props. one at component
    // creation, and one at update time.
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();
  });

  test("props: list of strings with optional props", async () => {
    class TestWidget extends Widget {
      static props = ["message", "someProp?"];
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { someProp: 1 });
    }).toThrow();
    expect(() => {
      QWeb.utils.validateProps(TestWidget, { message: 1 });
    }).not.toThrow();
  });

  test("props: can be defined with a boolean", async () => {
    class TestWidget extends Widget {
      static props = { message: true };
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, {});
    }).toThrow();
  });

  test("props with type array, and no element", async () => {
    class TestWidget extends Widget {
      static props = { myprop: { type: Array } };
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { myprop: [1] });
    }).not.toThrow();
    expect(() => {
      QWeb.utils.validateProps(TestWidget, { myprop: 1 });
    }).toThrow(`Invalid Prop 'myprop' in component 'TestWidget'`);
  });

  test("props with type object, and no shape", async () => {
    class TestWidget extends Widget {
      static props = { myprop: { type: Object } };
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { myprop: { a: 3 } });
    }).not.toThrow();
    expect(() => {
      QWeb.utils.validateProps(TestWidget, { myprop: false });
    }).toThrow(`Invalid Prop 'myprop' in component 'TestWidget'`);
  });

  test("props: extra props cause an error", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { message: 1, flag: true });
    }).toThrow();
  });

  test("props: extra props cause an error, part 2", async () => {
    class TestWidget extends Widget {
      static props = { message: true };
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { message: 1, flag: true });
    }).toThrow();
  });

  test("props: optional prop do not cause an error", async () => {
    class TestWidget extends Widget {
      static props = ["message?"];
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { message: 1 });
    }).not.toThrow();
  });

  test("optional prop do not cause an error if value is undefined", async () => {
    class TestWidget extends Widget {
      static props = { message: { type: String, optional: true } };
    }

    expect(() => {
      QWeb.utils.validateProps(TestWidget, { message: undefined });
    }).not.toThrow();
    expect(() => {
      QWeb.utils.validateProps(TestWidget, { message: null });
    }).toThrow();
  });

  test("missing required boolean prop causes an error", async () => {
    class TestWidget extends Widget {
      static props = ["p"];
      static template = xml`<span><t t-if="props.p">hey</t></span>`;
    }

    class App extends Widget {
      static template = xml`<div><TestWidget/></div>`;
      static components = { TestWidget };
    }

    const w = new App(undefined, {});
    let error;
    try {
      await w.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'p' (component 'TestWidget')");
  });

  test("props are validated whenever component is updated", async () => {
    let error;
    class TestWidget extends Component {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;

      async __updateProps() {
        try {
          await Component.prototype.__updateProps.apply(this, arguments);
        } catch (e) {
          error = e;
        }
      }
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="state.p"/></div>`;
      static components = { TestWidget };
      state: any = useState({ p: 1 });
    }

    const w = new Parent();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    w.state.p = undefined;
    await nextTick();
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'p' (component 'TestWidget')");
  });

  test("default values are applied before validating props at update", async () => {
    class TestWidget extends Component {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;
      static defaultProps = { p: 4 };
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget p="state.p"/></div>`;
      static components = { TestWidget };
      state: any = useState({ p: 1 });
    }

    const w = new Parent();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    w.state.p = undefined;
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

    class App extends Component {
      static components = { Child };
      static template = xml`<div><Child/></div>`;
    }

    const w = new App(undefined, {});
    let error;
    try {
      await w.mount(fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'mandatory' (component 'Child')");
  });
});

describe("default props", () => {
  test("can set default values", async () => {
    class TestWidget extends Component {
      static defaultProps = { p: 4 };
      static template = xml`<div><t t-esc="props.p"/></div>`;
    }
    class Parent extends Component {
      static template = xml`<div><TestWidget /></div>`;
      static components = { TestWidget };
    }

    const w = new Parent();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("default values are also set whenever component is updated", async () => {
    class TestWidget extends Widget {
      static template = xml`<div><t t-esc="props.p"/></div>`;
      static defaultProps = { p: 4 };
    }
    class Parent extends Widget {
      static template = xml`<div><TestWidget p="state.p"/></div>`;
      static components = { TestWidget };
      state: any = useState({ p: 1 });
    }

    const w = new Parent();
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    w.state.p = undefined;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });

  test("can set default required boolean values", async () => {
    class TestWidget extends Widget {
      static props = ["p", "q"];
      static defaultProps = { p: true, q: false };
      static template = xml`<span><t t-if="props.p">hey</t><t t-if="!props.q">hey</t></span>`;
    }

    class App extends Widget {
      static template = xml`<div><TestWidget/></div>`;
      static components = { TestWidget };
    }

    const w = new App(undefined, {});
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>heyhey</span></div>");
  });
});
