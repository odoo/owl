import { OwlError } from "../../src/runtime/error_handling";
import { Component, mount, onMounted, useState, xml } from "../../src";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();
let fixture: HTMLElement;
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;

beforeEach(() => {
  fixture = makeTestFixture();
  mockConsoleWarn = jest.fn(() => {});
  console.warn = mockConsoleWarn;
});

afterEach(() => {
  console.warn = originalconsoleWarn;
});

describe("style and class handling", () => {
  test("can set style and class inside component", async () => {
    class Test extends Component {
      static template = xml`
          <div style="font-weight:bold;" class="some-class">world</div>
        `;
    }
    await mount(Test, fixture);
    expect(fixture.innerHTML).toBe(`<div style="font-weight:bold;" class="some-class">world</div>`);
  });

  test("can set class on sub component, as prop", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="props.class">child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="'some-class'" />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div class="some-class">child</div>`);
  });

  test("no class is set is parent does not give it as prop", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="props.class">child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div>child</div>`);
  });

  test("no class is set is child ignores it", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="'hey'"/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div>child</div>`);
  });

  test("empty class attribute is not added on widget root el", async () => {
    class Child extends Component {
      static template = xml`<span t-att-class="props.class"/>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child class=""/></div>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
  });

  test("can set more than one class on sub component", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="props.class">child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="'a  b'" />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div class="a b">child</div>`);
  });

  test("component class and parent class combine together", async () => {
    class Child extends Component {
      static template = xml`<div class="child" t-att-class="props.class">child</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="'from parent'" />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div class="child from parent">child</div>`);
  });

  test("can set class on sub sub component", async () => {
    class ChildChild extends Component {
      static template = xml`<div t-att-class="props.class">childchild</div>`;
    }

    class Child extends Component {
      static template = xml`<ChildChild class="(props.class || '') + ' fromchild'" />`;
      static components = { ChildChild };
    }

    class Parent extends Component {
      static template = xml`<Child class="'fromparent'" />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div class="fromparent fromchild">childchild</div>`);
  });

  test("can set class on multi root component", async () => {
    class Child extends Component {
      static template = xml`<div>a</div><span t-att-class="props.class">b</span>`;
    }

    class Parent extends Component {
      static template = xml`<Child class="'fromparent'" />`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div>a</div><span class="fromparent">b</span>`);
  });

  test("class on sub component, which is switched to another", async () => {
    class ChildA extends Component {
      static template = xml`<div t-att-class="props.class">a</div>`;
    }
    class ChildB extends Component {
      static template = xml`<span t-att-class="props.class">b</span>`;
    }
    class Child extends Component {
      static template = xml`<ChildA class="props.class" t-if="props.child==='a'"/><ChildB class="props.class" t-else=""/>`;
      static components = { ChildA, ChildB };
    }

    class Parent extends Component {
      static template = xml`<Child class="'someclass'" child="state.child" />`;
      static components = { Child };

      state = useState({ child: "a" });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div class="someclass">a</div>`);
    parent.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe(`<span class="someclass">b</span>`);
  });

  // test("t-att-class is properly added/removed on widget root el", async () => {
  //   class Child extends Component {
  //     static template = xml`<div class="c"/>`;
  //   }
  //   class Parent extends Component {
  //     static template = xml`<div><Child t-att-class="{a:state.a, b:state.b}"/></div>`;
  //     static components = { Child };
  //     state = useState({ a: true, b: false });
  //   }
  //   const widget = await mount(Parent, fixture);
  //   expect(fixture.innerHTML).toBe(`<div><div class="c a"></div></div>`);

  //   widget.state.a = false;
  //   widget.state.b = true;
  //   await nextTick();
  //   expect(fixture.innerHTML).toBe(`<div><div class="c b"></div></div>`);
  // });

  test("class with extra whitespaces", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="props.class"/>`;
    }
    class Parent extends Component {
      static template = xml`<Child class="'a  b c   d'"/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div class="a b c d"></div>`);
  });

  test("class with extra whitespaces (variation)", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="props.class"/>`;
    }
    class Parent extends Component {
      static template = xml`<p><Child class="'a  b c   d'"/></p>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<p><div class="a b c d"></div></p>`);
  });

  // TODO: adapt name (t-att-class no longer makes sense on Components)
  test("t-att-class is properly added/removed on widget root el (v2)", async () => {
    let child: Child;
    class Child extends Component {
      static template = xml`<span class="c" t-att-class="{ d: state.d, ...props.class }"/>`;
      state = useState({ d: true });
      setup() {
        child = this;
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Child class="{ b: state.b }" />
        </div>`;
      static components = { Child };
      state = useState({ b: true });
    }
    const widget = await mount(Parent, fixture);

    const span = fixture.querySelector("span")!;
    expect(span.className).toBe("c d b");

    widget.state.b = false;
    await nextTick();
    expect(span.className).toBe("c d");

    child!.state.d = false;
    await nextTick();
    expect(span.className).toBe("c");

    widget.state.b = true;
    await nextTick();
    expect(span.className).toBe("c b");

    child!.state.d = true;
    await nextTick();
    expect(span.className).toBe("c b d");
  });

  // TODO: adapt name (t-att-class no longer makes sense on Components)
  test("t-att-class is properly added/removed on widget root el (v3)", async () => {
    let child: Child;
    class Child extends Component {
      static template = xml`<span class="c" t-att-class="{ d: state.d, ...props.class }"/>`;
      state = useState({ d: true });
      setup() {
        child = this;
      }
    }
    class Parent extends Component {
      static template = xml`<Child class="{ a: true, b: state.b }"/>`;
      static components = { Child };
      state = useState({ b: true });
    }
    const widget = await mount(Parent, fixture);

    const span = fixture.querySelector("span")!;
    expect(span.className).toBe("c d a b");

    widget.state.b = false;
    await nextTick();
    expect(span.className).toBe("c d a");

    child!.state.d = false;
    await nextTick();
    expect(span.className).toBe("c a");

    widget.state.b = true;
    await nextTick();
    expect(span.className).toBe("c a b");

    child!.state.d = true;
    await nextTick();
    expect(span.className).toBe("c a b d");
  });

  test("class on components do not interfere with user defined classes", async () => {
    class App extends Component {
      static template = xml`<div t-att-class="{ c: state.c }" />`;
      state = useState({ c: true });
      setup() {
        onMounted(() => {
          fixture.querySelector("div")!.classList.add("user");
        });
      }
    }
    const widget = await mount(App, fixture);

    expect(fixture.innerHTML).toBe('<div class="c user"></div>');

    widget.state.c = false;
    await nextTick();

    expect(fixture.innerHTML).toBe('<div class="user"></div>');
  });

  // TODO: adapt name
  test("style is properly added on widget root el", async () => {
    class SomeComponent extends Component {
      static template = xml`<div t-att-style="props.style"/>`;
    }

    class ParentWidget extends Component {
      static components = { Child: SomeComponent };
      static template = xml`<Child style="'font-weight: bold;'"/>`;
    }
    await mount(ParentWidget, fixture);
    expect(fixture.innerHTML).toBe(`<div style="font-weight: bold;"></div>`);
  });

  // TODO: adapt name
  // TODO: t-att-style as object (like class)
  test.skip("dynamic t-att-style is properly added and updated on widget root el", async () => {
    class SomeComponent extends Component {
      static template = xml`<div t-att-style="{ 'font-size': '20px', ...props.style }"/>`;
    }

    class ParentWidget extends Component {
      static template = xml`<Child style="state.style"/>`;
      static components = { Child: SomeComponent };
      state = useState({ style: { "font-size": "20px" } });
    }
    const widget = await mount(ParentWidget, fixture);

    expect(fixture.innerHTML).toBe(`<div t-att-style="font-size: 20px;"></div>`);

    widget.state.style["font-size"] = "30px";
    await nextTick();

    expect(fixture.innerHTML).toBe(`<div style="font-size: 30px;"></div>`);
  });

  // TODO: does this test need to be moved? (class now a standard prop)
  test("error in subcomponent with class", async () => {
    class Child extends Component {
      static template = xml`<div t-att-class="props.class" t-esc="this.will.crash"/>`;
    }
    class ParentWidget extends Component {
      static template = xml`<Child class="'a'"/>`;
      static components = { Child };
    }
    let error: OwlError;
    try {
      await mount(ParentWidget, fixture);
    } catch (e) {
      error = e as OwlError;
    }
    expect(error!).toBeDefined();
    expect(error!.cause).toBeDefined();
    const regexp =
      /Cannot read properties of undefined \(reading 'crash'\)|Cannot read property 'crash' of undefined/g;
    expect(error!.cause.message).toMatch(regexp);
    expect(fixture.innerHTML).toBe("");
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });
});
