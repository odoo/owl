import { mount, useState, Component } from "../../src";
import { status } from "../../src/status";
import { xml } from "../../src/tags";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("can mount a simple component", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    const component = await mount(Test, { target: fixture });

    expect(fixture.innerHTML).toBe("<span>simple vnode</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
  });

  test("can mount a simple component with props", async () => {
    class Test extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
    }

    const component = await mount(Test, { props: { value: 3 }, target: fixture });

    expect(fixture.innerHTML).toBe("<span>3</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
  });

  test("can mount a component with just some text", async () => {
    class Test extends Component {
      static template = xml`just text`;
    }

    const component = await mount(Test, { target: fixture });

    expect(fixture.innerHTML).toBe("just text");
    expect(component.el).toBeInstanceOf(Text);
  });

  test("can mount a simple component with multiple roots", async () => {
    class Test extends Component {
      static template = xml`<span></span><div></div>`;
    }

    const component = await mount(Test, { target: fixture });

    expect(fixture.innerHTML).toBe("<span></span><div></div>");
    expect(component.el).toEqual(null);
  });

  test("component with dynamic content can be updated", async () => {
    class Test extends Component {
      static template = xml`<span><t t-esc="value"/></span>`;
      value = 1;
    }

    const component = await mount(Test, { target: fixture });

    expect(fixture.innerHTML).toBe("<span>1</span>");

    component.value = 2;
    await component.render();
    expect(fixture.innerHTML).toBe("<span>2</span>");
  });

  test("updating a component with t-foreach as root", async () => {
    class Test extends Component {
      static template = xml`
        <t t-foreach="items" t-as="item" t-key="item">
          <t t-esc="item"/>
        </t>`;
      items = ["one", "two", "three"];
    }

    const component = await mount(Test, { target: fixture });

    expect(fixture.innerHTML).toBe("onetwothree");
    component.items = ["two", "three", "one"];
    await component.render();
    expect(fixture.innerHTML).toBe("twothreeone");
  });

  test("props is set on root component", async () => {
    expect.assertions(2);
    const p = {};
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        expect(this.props).toBe(p);
      }
    }

    await mount(Test, { target: fixture, props: p });
  });

  test("some simple sanity checks (el/status)", async () => {
    expect.assertions(4);
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        expect(this.el).toBe(null);
        expect(status(this)).toBe("new");
      }
    }

    const test = await mount(Test, { target: fixture });
    expect(status(test)).toBe("mounted");
  });

  test("throws if mounting on target=null", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    let error;
    try {
      await mount(Test, { target: null as any });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot mount component: the target is not a valid DOM element");
  });

  test("a component cannot be mounted in a detached node", async () => {
    class Test extends Component {
      static template = xml`<div/>`;
    }
    let error;
    try {
      await mount(Test, { target: document.createElement("div") });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot mount a component on a detached dom node");
  });

  test("crashes if it cannot find a template", async () => {
    class Test extends Component {
      static template = "wrongtemplate";
    }

    let error;
    try {
      await mount(Test, { target: fixture });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('Missing template: "wrongtemplate"');
  });

  test("class component with dynamic text", async () => {
    class Test extends Component {
      static template = xml`<span>My value: <t t-esc="value"/></span>`;

      value = 42;
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>My value: 42</span>");
  });

  test("Multi root component", async () => {
    class Test extends Component {
      static template = xml`<span>1</span>text<span>2</span>`;

      value = 42;
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe(`<span>1</span>text<span>2</span>`);
  });

  test("a component inside a component", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<span><Child/></span>`;
      static components = { Child };
    }

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<span><div>simple vnode</div></span>");
  });

  test("a class component inside a class component, no external dom", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>");
  });

  test("simple component with a dynamic text", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="value" /></div>`;
      value = 3;
    }

    const test = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>3</div>");
    test.value = 5;
    await test.render();
    expect(fixture.innerHTML).toBe("<div>5</div>");
  });

  test("simple component, useState", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="state.value" /></div>`;
      state = useState({ value: 3 });
    }

    const test = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>3</div>");
    test.state.value = 5;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>5</div>");
  });

  test("two child components", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child/><Child/>`;
      static components = { Child };
    }

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>simple vnode</div><div>simple vnode</div>");
  });

  test("class parent, class child component with props", async () => {
    class Child extends Component {
      static template = xml`<div><t t-esc="props.value" /></div>`;
    }

    class Parent extends Component {
      static template = xml`<Child value="42" />`;
      static components = { Child };
    }

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>42</div>");
  });

  test("parent, child and grandchild", async () => {
    class GrandChild extends Component {
      static template = xml`<div>hey</div>`;
    }

    class Child extends Component {
      static template = xml`<GrandChild />`;
      static components = { GrandChild };
    }

    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>hey</div>");
  });

  test("zero or one child components", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<Child t-if="state.hasChild"/>`;
      static components = { Child };
      state = useState({ hasChild: false });
    }

    const parent = await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("");
    parent.state.hasChild = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>");
  });

  test("can be clicked on and updated", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.counter"/><button t-on-click="state.counter++">Inc</button></div>`;
      state = useState({
        counter: 0,
      });
    }

    const counter = await mount(Counter, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });

  test("can handle empty props", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child val=""/></div>`;
      static components = { Child };
    }

    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div><span></span></div>");
  });

  test("child can be updated", async () => {
    class Child extends Component {
      static template = xml`<t t-esc="props.value"/>`;
    }

    class Parent extends Component {
      static template = xml`<Child value="state.counter"/>`;
      static components = { Child };
      state = useState({
        counter: 0,
      });
    }

    const parent = await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("0");

    parent.state.counter = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe("1");
  });

  test("higher order components parent and child", async () => {
    class ChildA extends Component {
      static template = xml`<div>a</div>`;
    }
    class ChildB extends Component {
      static template = xml`<span>b</span>`;
    }
    class Child extends Component {
      static template = xml`<ChildA t-if="props.child==='a'"/><ChildB t-else=""/>`;
      static components = { ChildA, ChildB };
    }

    class Parent extends Component {
      static template = xml`<Child child="state.child" />`;
      static components = { Child };

      state = useState({ child: "a" });
    }

    const parent = await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div>a</div>`);
    parent.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe(`<span>b</span>`);
  });
});
