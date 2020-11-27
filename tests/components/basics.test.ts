import { fromName, makeTestFixture, snapshotTemplateCode, nextTick } from "../helpers";
import { mount, Component, xml, useState } from "../../src/core";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("props is set on root component", async () => {
    expect.assertions(2);
    const p = {};
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      constructor(props: any) {
        super(props);
        expect(this.props).toBe(p);
        expect(props).toBe(p);
      }
    }

    await mount(Test, { target: fixture, props: p });
  });

  test("has no el after creation", async () => {
    expect.assertions(1);
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      constructor(props: any) {
        super(props);
        expect(this.el).toBe(null);
      }
    }

    await mount(Test, { target: fixture });
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

  test("crashes if it cannot find a template", async () => {
    class Test extends Component {}

    let error;
    try {
      await mount(Test, { target: fixture });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('Could not find template for component "Test"');
  });

  test("can mount a simple class component", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    const component = await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>simple vnode</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
    snapshotTemplateCode(fromName(Test.template));
  });

  test("can mount a simple class component in a detached div", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    const div = document.createElement("div");
    await mount(Test, { target: div });
    expect(div.innerHTML).toBe("<span>simple vnode</span>");
  });

  test("can mount a simple class component in a documentfragment", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    const fragment = document.createDocumentFragment();
    const test = await mount(Test, { target: fragment });
    expect(fixture.innerHTML).toBe("");

    await mount(test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>simple vnode</span>");
  });

  test("class component with dynamic text", async () => {
    class Test extends Component {
      static template = xml`<span>My value: <t t-esc="value"/></span>`;

      value = 42;
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<span>My value: 42</span>");
    snapshotTemplateCode(fromName(Test.template));
  });

  test("Multi root component", async () => {
    class Test extends Component {
      static template = xml`<span>1</span>text<span>2</span>`;

      value = 42;
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe(`<span>1</span>text<span>2</span>`);
    snapshotTemplateCode(fromName(Test.template));
  });

  test("a class component inside a class component", async () => {
    class Child extends Component {
      static template = xml`<div>simple vnode</div>`;
    }

    class Parent extends Component {
      static template = xml`<span><Child/></span>`;
      static components = { Child };
    }
    snapshotTemplateCode(fromName(Parent.template));

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
    snapshotTemplateCode(fromName(Parent.template));

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
    snapshotTemplateCode(fromName(Parent.template));

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
    snapshotTemplateCode(fromName(Parent.template));
    snapshotTemplateCode(fromName(Child.template));

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
    snapshotTemplateCode(fromName(Parent.template));

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
    snapshotTemplateCode(fromName(Parent.template));

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

    snapshotTemplateCode(fromName(Parent.template));
    await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("<div><span></span></div>");
  });

  test("cannot be clicked on and updated if not in DOM", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.counter"/><button t-on-click="state.counter++">Inc</button></div>`;
      state = useState({
        counter: 0,
      });
    }
    snapshotTemplateCode(fromName(Counter.template));

    const target = document.createElement("div");
    const counter = await mount(Counter, { target });
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(target.innerHTML).toBe("<div>0<button>Inc</button></div>");
    expect(counter.state.counter).toBe(0);
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

    snapshotTemplateCode(fromName(Child.template));
    snapshotTemplateCode(fromName(Parent.template));

    const parent = await mount(Parent, { target: fixture });
    expect(fixture.innerHTML).toBe("0");

    parent.state.counter = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe("1");
  });
});
