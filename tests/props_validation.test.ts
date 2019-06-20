import { Component, Env } from "../src/component";
import { makeTestFixture, makeTestEnv } from "./helpers";
import { QWeb } from "../src";

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

class Widget extends Component<any, any, any> {}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------
describe("props validation", () => {
  test("validation is only done in dev mode", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
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

  test("props validation is also done on update props", async () => {
    expect.assertions(1);
    class TestWidget extends Widget {
      static props = ["message"];
    }
    const w = new TestWidget(env, { message: "bottle" });
    try {
      await w._updateProps({});
    } catch (e) {
      expect(e.message).toBe("Missing props 'message' (component 'TestWidget')");
    }
  });

  test("props: list of strings", async () => {
    class TestWidget extends Widget {
      static props = ["message"];
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
      static props = { p: { type: String, optional: true } };
    };

    expect(() => {
      new TestWidget(env, { p: "hey" });
      new TestWidget(env, { });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: 1 });
    }).toThrow();

  });


  test("can validate an array with given primitive type", async () => {
    let TestWidget = class extends Widget {
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
      static props = {
        p: {
          type: Object,
          shape: {
            id: Number,
            url: [Boolean, {type: Array, element: Number}],
          }
        }
      };
    };

    expect(() => {
      new TestWidget(env, { p: { id: 1, url: true } });
      new TestWidget(env, { p: { id: 1, url: [12]} });
    }).not.toThrow();

    expect(() => {
      new TestWidget(env, { p: { id: 1, url: [12, true]} });
    }).toThrow();

  });
});


describe("default props", () => {
  test("can set default values", async () => {
    class TestWidget extends Widget {
      static defaultProps = {p: 4}
    }

    const w = new TestWidget(env, {});
    expect(w.props.p).toBe(4);
  });

  test("default values are also set whenever component is updated", async () => {
    class TestWidget extends Widget {
      static defaultProps = {p: 4}
    }

    const w = new TestWidget(env, {p: 1});
    await w._updateProps({});
    expect(w.props.p).toBe(4);
  });
});
