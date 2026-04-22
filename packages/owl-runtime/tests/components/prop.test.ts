import { Component, mount, prop, proxy, signal, types as t, xml } from "../../src";
import {
  getConsoleOutput,
  makeTestFixture,
  nextAppError,
  nextTick,
  render,
  snapshotEverything,
} from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

// -----------------------------------------------------------------------------
// Basics
// -----------------------------------------------------------------------------

describe("basics", () => {
  test("reads the named prop", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.value"/></span>`;
      value = prop("value", t.number());
    }
    class Parent extends Component {
      static template = xml`<div><Child value="42"/></div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("default value when prop is absent", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.label"/></span>`;
      label = prop("label", t.string(), "untitled");
    }
    class Parent extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>untitled</span></div>");
  });

  test("provided value takes precedence over default", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.label"/></span>`;
      label = prop("label", t.string(), "untitled");
    }
    class Parent extends Component {
      static template = xml`<div><Child label="'hello'"/></div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");
  });

  test("multiple prop fields in same component", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.a"/>/<t t-out="this.b"/></span>`;
      a = prop("a", t.string());
      b = prop("b", t.number());
    }
    class Parent extends Component {
      static template = xml`<div><Child a="'x'" b="2"/></div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>x/2</span></div>");
  });

  test("can be mixed with props()", async () => {
    const { props } = await import("../../src");
    class Child extends Component {
      static template = xml`<span><t t-out="this.all.extra"/>/<t t-out="this.main"/></span>`;
      all = props({ "extra?": t.string() });
      main = prop("main", t.number());
    }
    class Parent extends Component {
      static template = xml`<div><Child main="7" extra="'side'"/></div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>side/7</span></div>");
  });

  test("type argument is optional (accepts any value)", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.value"/></span>`;
      value = prop("value");
    }
    class Parent extends Component {
      static template = xml`<div><Child value="'anything'"/></div>`;
      static components = { Child };
    }

    await mount(Parent, fixture, { test: true });
    expect(fixture.innerHTML).toBe("<div><span>anything</span></div>");
  });

  test("prop accepts instanceOf type", async () => {
    class Todo {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
    }
    class Child extends Component {
      static template = xml`<span><t t-out="this.todo.name"/></span>`;
      todo = prop("todo", t.instanceOf(Todo));
    }
    class Parent extends Component {
      static template = xml`<div><Child todo="this.myTodo"/></div>`;
      static components = { Child };
      myTodo = new Todo("buy milk");
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>buy milk</span></div>");
  });
});

// -----------------------------------------------------------------------------
// Dev mode
// -----------------------------------------------------------------------------

describe("dev mode", () => {
  test("validates initial type on mount (root component)", async () => {
    class Root extends Component {
      static template = xml`<div/>`;
      value = prop("value", t.number());
    }

    let error: any;
    try {
      await mount(Root, fixture, { dev: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toMatch("Invalid prop 'value' in 'Root'");
    expect(getConsoleOutput()).toEqual([`info:Owl is running in 'dev' mode.`]);
  });

  test("validates initial type on mount (child component)", async () => {
    class Child extends Component {
      static template = xml`<div/>`;
      value = prop("value", t.number());
    }
    class Parent extends Component {
      static template = xml`<Child value="'not-a-number'"/>`;
      static components = { Child };
    }

    let error: any;
    try {
      await mount(Parent, fixture, { dev: true });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.cause.message).toMatch("Invalid prop 'value' in 'Child'");
  });

  test("throws if prop reference changes on re-render", async () => {
    class Todo {}
    class Child extends Component {
      static template = xml`<div/>`;
      todo = prop("todo", t.instanceOf(Todo));
    }
    class Parent extends Component {
      static template = xml`<Child todo="this.state.todo"/>`;
      static components = { Child };
      state = proxy({ todo: new Todo() });
    }

    const parent = await mount(Parent, fixture, { dev: true });
    parent.state.todo = new Todo(); // different reference
    render(parent);
    const error = await nextAppError(parent.__owl__.app);
    expect(error.cause.message).toMatch("Prop 'todo' changed in component 'Child'");
  });

  test("does not throw if signal reference is stable across re-renders", async () => {
    class Todo {}
    const todoSig = signal(new Todo());

    class Child extends Component {
      static template = xml`<div/>`;
      todo = prop("todo", t.signal());
    }
    class Parent extends Component {
      static template = xml`<Child todo="this.todoSig"/>`;
      static components = { Child };
      get todoSig() {
        return todoSig;
      }
    }

    const parent = await mount(Parent, fixture, { dev: true });
    todoSig.set(new Todo()); // inner value changes, signal reference stays the same
    render(parent, true); // deep re-render → triggers willUpdateProps
    await nextTick();
    // no error: same signal reference, so the static-prop check passes
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("skips validation in non-dev mode", async () => {
    class Root extends Component {
      static template = xml`<div/>`;
      value = prop("value", t.number());
    }

    let error: any;
    try {
      await mount(Root, fixture, { dev: false });
    } catch (e) {
      error = e;
    }
    expect(error).toBeUndefined();
  });

  test("skips immutability check in non-dev mode", async () => {
    class Todo {}
    class Child extends Component {
      static template = xml`<div/>`;
      todo = prop("todo", t.instanceOf(Todo));
    }
    class Parent extends Component {
      static template = xml`<Child todo="this.state.todo"/>`;
      static components = { Child };
      state = proxy({ todo: new Todo() });
    }

    const parent = await mount(Parent, fixture);
    parent.state.todo = new Todo(); // different reference
    render(parent);
    await nextTick();
    // no error in prod mode
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("default value skips validation when prop is absent", async () => {
    class Root extends Component {
      static template = xml`<div t-out="this.label"/>`;
      label = prop("label", t.string(), "fallback");
    }

    // No error even though prop is missing: default covers it
    await mount(Root, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div>fallback</div>");
  });

  test("omitted prop with default does not trigger static-prop error on re-render", async () => {
    class Child extends Component {
      static template = xml`<div t-out="this.label"/>`;
      label = prop("label", t.string(), "fallback");
    }
    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
      state = proxy({ tick: 0 });
    }

    const parent = await mount(Parent, fixture, { dev: true });
    expect(fixture.innerHTML).toBe("<div>fallback</div>");
    parent.state.tick = 1;
    render(parent, true); // deep re-render → triggers willUpdateProps on Child
    await nextTick();
    // no error: the raw prop stayed undefined, so the static-prop check passes
    expect(fixture.innerHTML).toBe("<div>fallback</div>");
  });
});

// -----------------------------------------------------------------------------
// Error outside component scope
// -----------------------------------------------------------------------------

test("throws if called outside a component scope", () => {
  let error: any;
  try {
    prop("foo", t.string());
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  expect(error.message).toMatch("No active scope");
});
