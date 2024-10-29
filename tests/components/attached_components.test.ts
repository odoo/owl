import { Component, markup, mount, useState, xml } from "../../src";
import { useAttachedEl } from "../../src/runtime/hooks";
import { makeTestFixture, nextTick, steps, useLogLifecycle } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("can attach an empty component", async () => {
    fixture.innerHTML = "<div>hello</div>";

    class Test extends Component {
      setup() {
        useLogLifecycle();
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Test:setup",
        "Test:willStart",
        "Test:willRender",
        "Test:rendered",
        "Test:mounted",
      ]
    `);
    expect(fixture.innerHTML).toBe("<div>hello</div>");
  });

  test("attaching a component with a template throws", async () => {
    fixture.innerHTML = "<div>hello</div>";

    class Test extends Component {
      static template = xml`hello`;
    }

    let error: Error | null = null;
    try {
      await mount(Test, fixture, { position: "attach" });
    } catch (e: any) {
      error = e;
    }
    expect(error!.message).toBe("Cannot attach a component with a template");

    expect(fixture.innerHTML).toBe("<div>hello</div>");
  });

  test("can attach a component with simple dynamic content", async () => {
    fixture.innerHTML = "<div><p>hello</p></div>";

    class Test extends Component {
      static dynamicContent = {
        "p:t-att-a": "value",
      };
      value: string = "";
      setup() {
        this.value = "b";
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(fixture.innerHTML).toBe('<div><p a="b">hello</p></div>');
  });

  test("useAttachedEl returns the attached element", async () => {
    fixture.innerHTML = "<div><p>hello</p></div>";
    let el: any = null;

    class Test extends Component {
      setup() {
        el = useAttachedEl();
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(el).toBe(fixture);
  });

  test("useAttachedEl throws if component is not attached", async () => {
    class Test extends Component {
      static template = xml`hello`;
      setup() {
        useAttachedEl();
      }
    }

    let error: any = null;
    try {
      await mount(Test, fixture);
    } catch (_e: any) {
      error = _e;
    }

    expect(error.message).toBe("useAttachedEl can only be called with component that are attached");
  });

  test("multiple dynamic attribute", async () => {
    fixture.innerHTML = "<div><p>hello</p></div>";

    class Test extends Component {
      static dynamicContent = {
        "p:t-att-a": "value",
        "p:t-att-b": "value + 'coucou'",
      };
      value: string = "";
      setup() {
        this.value = "b";
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(fixture.innerHTML).toBe('<div><p a="b" b="bcoucou">hello</p></div>');
  });

  test("attrs can target root", async () => {
    fixture.innerHTML = "<p>hello</p>";

    class Test extends Component {
      static dynamicContent = {
        "root:t-att-a": "value",
      };
      value: string = "";
      setup() {
        this.value = "b";
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(fixture.outerHTML).toBe('<div a="b"><p>hello</p></div>');
  });

  test("dynamic attribute is updated on rerender", async () => {
    fixture.innerHTML = "<div><p>hello</p></div>";

    class Test extends Component {
      static dynamicContent = {
        "p:t-att-a": "state.value",
      };
      state: any;
      setup() {
        this.state = useState({ value: 1 });
      }
    }

    const test = await mount(Test, fixture, { position: "attach" });
    expect(fixture.innerHTML).toBe('<div><p a="1">hello</p></div>');
    test.state.value = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><p a="2">hello</p></div>');
  });

  test("t-on-click, basic", async () => {
    fixture.innerHTML = "<div><p>hello</p></div>";

    let ev: Event | null = null;

    class Test extends Component {
      static dynamicContent = {
        "p:t-att-a": "state.value",
        "p:t-on-click": "onClick",
      };
      state: any;
      setup() {
        this.state = useState({ value: 1 });
      }
      onClick(_ev: any) {
        ev = _ev;
        this.state.value = 2;
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(fixture.innerHTML).toBe('<div><p a="1">hello</p></div>');
    fixture.querySelector("p")!.click();
    expect(ev).toBeInstanceOf(Event);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><p a="2">hello</p></div>');
  });

  test("t-on-click, target root element", async () => {
    fixture.innerHTML = "hello";
    let click = false;
    class Test extends Component {
      static dynamicContent = {
        "root:t-on-click": "onClick",
      };
      onClick() {
        click = true;
      }
    }

    await mount(Test, fixture, { position: "attach" });
    fixture.click();
    expect(click).toBe(true);
  });

  test("t-out, basic", async () => {
    fixture.innerHTML = "<div><p>hello</p></div>";

    class Test extends Component {
      static dynamicContent = {
        "p:t-out": "state.value",
      };
      state: any;
      setup() {
        this.state = useState({ value: 1 });
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(fixture.innerHTML).toBe("<div><p>1</p></div>");
  });

  test("t-out, on root", async () => {
    fixture.innerHTML = "hello";

    class Test extends Component {
      static dynamicContent = {
        "root:t-out": "state.value",
      };
      state: any;
      setup() {
        this.state = useState({ value: 1 });
      }
    }

    expect(fixture.outerHTML).toBe("<div>hello</div>");
    await mount(Test, fixture, { position: "attach" });
    expect(fixture.outerHTML).toBe("<div>1</div>");
  });

  test("t-out, with markup", async () => {
    fixture.innerHTML = `<p class="p1">hello</p><p class="p2">hello</p>`;

    class Test extends Component {
      static dynamicContent = {
        "p.p1:t-out": "value1",
        "p.p2:t-out": "value2",
      };

      value1: any;
      value2: any;
      setup() {
        this.value1 = "<div>value1</div>";
        this.value2 = markup("<div>value2</div>");
      }
    }

    await mount(Test, fixture, { position: "attach" });
    expect(fixture.innerHTML).toBe(
      `<p class="p1">&lt;div&gt;value1&lt;/div&gt;</p><p class="p2"><div>value2</div></p>`
    );
  });
});
