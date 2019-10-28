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
  dev = QWeb.dev;
  QWeb.dev = true;
});

afterEach(() => {
  fixture.remove();
  QWeb.dev = dev;
});

class Widget extends Component<any, any> {}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------
describe("props validation", () => {
  test("validation is only done in dev mode", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }

    QWeb.dev = true;
    expect(() => {
      new TestWidget(env);
    }).toThrow();

    QWeb.dev = false;

    expect(() => {
      new TestWidget(env);
    }).not.toThrow();
  });

  test("props: list of strings", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
      static template = xml`<div>hey</div>`;
    }

    expect(() => {
      new TestWidget(env);
    }).toThrow("Missing props 'message' (component 'TestWidget')");
  });

  test("validate simple types", async () => {
    const Tests = [
      { type: Number, ok: 1, ko: "1" },
      { type: Boolean, ok: true, ko: "1" },
      { type: String, ok: "1", ko: 1 },
      { type: Object, ok: {}, ko: "1" },
      { type: Date, ok: new Date(), ko: "1" },
      { type: Function, ok: () => {}, ko: "1" }
    ];

    for (let test of Tests) {
      let TestWidget = class extends Widget {
        static template = xml`<div>hey</div>`;
        static props = { p: test.type };
      };

      expect(() => {
        new TestWidget(env);
      }).toThrow("Missing props 'p'");

      expect(() => {
        new TestWidget(env, { p: test.ok });
      }).not.toThrow();

      expect(() => {
        new TestWidget(env, { p: test.ko });
      }).toThrow("Props 'p' of invalid type in component");
    }
  });

  test("validate simple types, alternate form", async () => {
    const Tests = [
      { type: Number, ok: 1, ko: "1" },
      { type: Boolean, ok: true, ko: "1" },
      { type: String, ok: "1", ko: 1 },
      { type: Object, ok: {}, ko: "1" },
      { type: Date, ok: new Date(), ko: "1" },
      { type: Function, ok: () => {}, ko: "1" }
    ];

    for (let test of Tests) {
      let TestWidget = class extends Widget {
        static template = xml`<div>hey</div>`;
        static props = { p: { type: test.type } };
      };

      expect(() => {
        new TestWidget(env);
      }).toThrow("Missing props 'p'");

      expect(() => {
        new TestWidget(env, { p: test.ok });
      }).not.toThrow();

      expect(() => {
        new TestWidget(env, { p: test.ko });
      }).toThrow("Props 'p' of invalid type in component");
    }
  });

  test("can validate a prop with multiple types", async () => {
    let TestWidget = class extends Widget {
      static template = xml`<div>hey</div>`;
      static props = { p: [String, Boolean] };
    };

    expect(() => {
      new TestWidget(env, { p: "string" });
      new TestWidget(env, { p: true });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: 1 });
    }).toThrow("Props 'p' of invalid type in component");
  });

  test("can validate an optional props", async () => {
    let TestWidget = class extends Widget {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: String, optional: true } };
    };

    expect(() => {
      new TestWidget(env, { p: "hey" });
      new TestWidget(env, {});
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: 1 });
    }).toThrow();
  });

  test("can validate an array with given primitive type", async () => {
    let TestWidget = class extends Widget {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: Array, element: String } };
    };

    expect(() => {
      new TestWidget(env, { p: [] });
      new TestWidget(env, { p: ["string"] });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: [1] });
    }).toThrow();

    expect(() => {
      new TestWidget(env, { p: ["string", 1] });
    }).toThrow();
  });

  test("can validate an array with multiple sub element types", async () => {
    let TestWidget = class extends Widget {
      static template = xml`<div>hey</div>`;
      static props = { p: { type: Array, element: [String, Boolean] } };
    };

    expect(() => {
      new TestWidget(env, { p: [] });
      new TestWidget(env, { p: ["string"] });
      new TestWidget(env, { p: [false, true, "string"] });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: [true, 1] });
    }).toThrow();
  });

  test("can validate an object with simple shape", async () => {
    let TestWidget = class extends Widget {
      static template = xml`<div>hey</div>`;
      static props = {
        p: { type: Object, shape: { id: Number, url: String } }
      };
    };

    expect(() => {
      new TestWidget(env, { p: { id: 1, url: "url" } });
      new TestWidget(env, { p: { id: 1, url: "url", extra: true } });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: { id: "1", url: "url" } });
    }).toThrow();

    expect(() => {
      new TestWidget(env, { p: { id: 1 } });
    }).toThrow();
  });

  test("can validate recursively complicated prop def", async () => {
    let TestWidget = class extends Widget {
      static template = xml`<div>hey</div>`;
      static props = {
        p: {
          type: Object,
          shape: {
            id: Number,
            url: [Boolean, { type: Array, element: Number }]
          }
        }
      };
    };

    expect(() => {
      new TestWidget(env, { p: { id: 1, url: true } });
      new TestWidget(env, { p: { id: 1, url: [12] } });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: { id: 1, url: [12, true] } });
    }).toThrow();
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
    const app = new App(env);
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

    const w = new App(env, {});
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
    class TestWidget extends Component<any, any> {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;

      async __updateProps() {
        try {
          await Component.prototype.__updateProps.apply(this, arguments);
        } catch(e) {
          error = e;
        }
      }
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><TestWidget p="state.p"/></div>`;
      static components = { TestWidget };
      state: any = useState({ p: 1 });
    }

    const w = new Parent(env);
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    w.state.p = undefined;
    await nextTick();
    expect(error).toBeDefined();
    expect(error.message).toBe("Missing props 'p' (component 'TestWidget')");
  });

  test("default values are applied before validating props at update", async () => {
    class TestWidget extends Component<any, any> {
      static props = { p: { type: Number } };
      static template = xml`<div><t t-esc="props.p"/></div>`;
      static defaultProps = { p: 4 };
    }
    class Parent extends Component<any, any> {
      static template = xml`<div><TestWidget p="state.p"/></div>`;
      static components = { TestWidget };
      state: any = useState({ p: 1 });
    }

    const w = new Parent(env);
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    w.state.p = undefined;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div>4</div></div>");
  });
});

describe("default props", () => {
  test("can set default values", async () => {
    class TestWidget extends Widget {
      static defaultProps = { p: 4 };
      static template = xml`<div>hey</div>`;
    }

    const w = new TestWidget(env, {});
    expect(w.props.p).toBe(4);
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

    const w = new Parent(env);
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

    const w = new App(env, {});
    await w.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>heyhey</span></div>");
  });
});
