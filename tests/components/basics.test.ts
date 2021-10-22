import { App, Component, mount, status, useState } from "../../src";
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

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("<span>simple vnode</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
  });

  test("has no el after creation", async () => {
    let el: any = null;
    class Test extends Component {
      static template = xml`<span>simple</span>`;
      setup() {
        el = this.el;
      }
    }

    await mount(Test, fixture);
    expect(el).toBeUndefined();
  });

  test("cannot mount on a documentFragment", async () => {
    class SomeWidget extends Component {
      static template = xml`<div>content</div>`;
    }
    let error;
    try {
      await mount(SomeWidget, document.createDocumentFragment() as any);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("Cannot mount component: the target is not a valid DOM element");
  });

  test("can mount a simple component with props", async () => {
    class Test extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
    }

    const app = new App(Test, { value: 3 });
    const component = await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>3</span>");
    expect(component.el).toEqual(fixture.querySelector("span"));
  });

  test("can mount a component with just some text", async () => {
    class Test extends Component {
      static template = xml`just text`;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("just text");
    expect(component.el).toBeInstanceOf(Text);
  });

  test("can mount a component with no text", async () => {
    class Test extends Component {
      static template = xml`<t></t>`;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("");
    expect(component.el).toBeInstanceOf(Text);
  });

  test("can mount a simple component with multiple roots", async () => {
    class Test extends Component {
      static template = xml`<span></span><div></div>`;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("<span></span><div></div>");
    expect((component.el as any).tagName).toBe("SPAN");
  });

  test("component with dynamic content can be updated", async () => {
    class Test extends Component {
      static template = xml`<span><t t-esc="value"/></span>`;
      value = 1;
    }

    const component = await mount(Test, fixture);

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

    const component = await mount(Test, fixture);

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

    const app = new App(Test, p);
    await app.mount(fixture);
  });

  test("some simple sanity checks (el/status)", async () => {
    expect.assertions(4);
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        expect(this.el).toBe(undefined);
        expect(status(this)).toBe("new");
      }
    }

    const test = await mount(Test, fixture);
    expect(status(test)).toBe("mounted");
  });

  test("throws if mounting on target=null", async () => {
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
    }

    let error;
    try {
      await mount(Test, null as any);
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
      await mount(Test, document.createElement("div"));
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
      await mount(Test, fixture);
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

    await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<span>My value: 42</span>");
  });

  test("Multi root component", async () => {
    class Test extends Component {
      static template = xml`<span>1</span>text<span>2</span>`;

      value = 42;
    }

    await mount(Test, fixture);
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

    await mount(Parent, fixture);
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

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>");
  });

  test("simple component with a dynamic text", async () => {
    class Test extends Component {
      static template = xml`<div><t t-esc="value" /></div>`;
      value = 3;
    }

    const test = await mount(Test, fixture);
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

    const test = await mount(Test, fixture);
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

    await mount(Parent, fixture);
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

    await mount(Parent, fixture);
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

    await mount(Parent, fixture);
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

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("");
    parent.state.hasChild = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>simple vnode</div>");
  });

  test("text after a conditional component", async () => {
    class Child extends Component {
      static template = xml`<p>simple vnode</p>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Child t-if="state.hasChild"/>
          <span t-esc="state.text"/>
        </div>`;
      static components = { Child };
      state = useState({ hasChild: false, text: "1" });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span></div>");

    parent.state.hasChild = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><p>simple vnode</p><span>1</span></div>");

    parent.state.hasChild = false;
    parent.state.text = "2";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>2</span></div>");
  });

  test("can be clicked on and updated", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.counter"/><button t-on-click="state.counter++">Inc</button></div>`;
      state = useState({
        counter: 0,
      });
    }

    const counter = await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = (<HTMLElement>counter.el).getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });
  // TODO: rename
  test("rerendering a widget with a sub widget", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.counter"/><button t-on-click="state.counter++">Inc</button></div>`;
      state = useState({
        counter: 0,
      });
    }
    class Parent extends Component {
      static template = xml`<Counter/>`;
      static components = { Counter };
    }
    const parent = await mount(Parent, fixture);
    const button = fixture.getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<button>Inc</button></div>");
    await parent.render();
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

    await mount(Parent, fixture);
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

    const parent = await mount(Parent, fixture);
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

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(`<div>a</div>`);
    parent.state.child = "b";
    await nextTick();
    expect(fixture.innerHTML).toBe(`<span>b</span>`);
  });

  test("three level of components with collapsing root nodes", async () => {
    class GrandChild extends Component {
      static template = xml`<div>2</div>`;
    }
    class Child extends Component {
      static components = { GrandChild };
      static template = xml`<GrandChild/>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child></Child>`;
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div>2</div>");
  });

  test("do not remove previously rendered dom if not necessary", async () => {
    class SomeComponent extends Component {
      static template = xml`<div/>`;
    }
    const widget = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe(`<div></div>`);
    widget.el!.appendChild(document.createElement("span"));
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
    await widget.render();
    expect(fixture.innerHTML).toBe(`<div><span></span></div>`);
  });

  test("do not remove previously rendered dom if not necessary, variation", async () => {
    class SomeComponent extends Component {
      static template = xml`<div><h1>h1</h1><span><t t-esc="state.value"/></span></div>`;
      state = useState({ value: 1 });
    }
    const comp = await mount(SomeComponent, fixture);
    expect(fixture.innerHTML).toBe(`<div><h1>h1</h1><span>1</span></div>`);
    (comp.el! as any).querySelector("h1")!.appendChild(document.createElement("p"));
    expect(fixture.innerHTML).toBe("<div><h1>h1<p></p></h1><span>1</span></div>");

    comp.state.value++;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><h1>h1<p></p></h1><span>2</span></div>");
  });

  test("reconciliation alg is not confused in some specific situation", async () => {
    // in this test, we set t-key to 4 because it was in conflict with the
    // template id corresponding to the first child.
    class Child extends Component {
      static template = xml`<span>child</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
            <Child />
            <Child t-key="4"/>
        </div>
      `;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>child</span><span>child</span></div>");
  });

  test("same t-keys in two different places", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.blip"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
            <div><Child t-key="1" blip="'1'"/></div>
            <div><Child t-key="1" blip="'2'"/></div>
        </div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>1</span></div><div><span>2</span></div></div>");
  });

  test("t-key on a component with t-if, and a sibling component", async () => {
    class Child extends Component {
      static template = xml`<span>child</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Child t-if="false" t-key="'str'"/>
          <Child/>
        </div>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>child</span></div>");
  });

  test("widget after a t-foreach", async () => {
    class SomeComponent extends Component {
      static template = xml`<div/>`;
    }

    class Test extends Component {
      static template = xml`<div><t t-foreach="Array(2)" t-as="elem" t-key="elem_index">txt</t><SomeComponent/></div>`;
      static components = { SomeComponent };
    }

    await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<div>txttxt<div></div></div>");
  });

  test("t-if works with t-component", async () => {
    class Child extends Component {
      static template = xml`<span>hey</span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="state.flag"/></div>`;
      static components = { Child };
      state = useState({ flag: true });
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");

    parent.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("t-else works with t-component", async () => {
    class Child extends Component {
      static template = xml`<span>hey</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <div t-if="state.flag">somediv</div>
          <Child t-else=""/>
        </div>`;
      static components = { Child };
      state = useState({ flag: true });
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div>somediv</div></div>");

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("t-elif works with t-component", async () => {
    class Child extends Component {
      static template = xml`<span>hey</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <div t-if="state.flag">somediv</div>
          <Child t-elif="!state.flag" />
        </div>`;
      static components = { Child };
      state = useState({ flag: true });
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div>somediv</div></div>");

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("t-else with empty string works with t-component", async () => {
    class Child extends Component {
      static template = xml`<span>hey</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <div t-if="state.flag">somediv</div>
          <Child t-else="" />
        </div>`;
      static components = { Child };
      state = useState({ flag: true });
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div>somediv</div></div>");

    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  // TODO: implement scope lookup for components
  test.skip("don't fallback to component's registry if widget defined in the instance's context", async () => {
    class ChildA extends Component {
      static template = xml`<span>ChildA</span>`;
    }
    class ChildB extends Component {
      static template = xml`<span>ChildB</span>`;
    }
    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child: ChildA };
      Child = ChildB;
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>ChildB</span>");
  });

  test("sub components between t-ifs", async () => {
    // this confuses the patching algorithm...
    class Child extends Component {
      static template = xml`<span>child</span>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <h1 t-if="state.flag">hey</h1>
          <h2 t-else="">noo</h2>
          <span><Child/></span>
          <t t-if="state.flag"><span>test</span></t>
        </div>`;
      static components = { Child };
      state = useState({ flag: false });
    }
    const parent = await mount(Parent, fixture);
    const child = Object.values(parent.__owl__.children)[0].component;
    expect(fixture.innerHTML).toBe(`<div><h2>noo</h2><span><span>child</span></span></div>`);

    parent.state.flag = true;
    await nextTick();
    expect(Object.values(parent.__owl__.children)[0].component).toBe(child);
    expect(status(child)).toBe("mounted");
    expect(fixture.innerHTML).toBe(
      `<div><h1>hey</h1><span><span>child</span></span><span>test</span></div>`
    );
  });

  test("list of two sub components inside other nodes", async () => {
    class SubWidget extends Component {
      static template = xml`<span>asdf</span>`;
    }
    class Parent extends Component {
      static template = xml`
      <div>
          <div t-foreach="state.blips" t-as="blip" t-key="blip.id">
              <SubWidget />
              <SubWidget />
          </div>
      </div>`;
      static components = { SubWidget };
      state = useState({ blips: [{ a: "a", id: 1 }] });
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>asdf</span><span>asdf</span></div></div>");
  });
  // TODO: rename
  test("updating widget immediately", async () => {
    // in this situation, we protect against a bug that occurred: because of the
    // interplay between components and vnodes, a sub widget vnode was patched
    // twice.
    class Child extends Component {
      static template = xml`<span>abc<t t-if="props.flag">def</t></span>`;
    }
    class Parent extends Component {
      static template = xml`<Child flag="state.flag"/>`;
      static components = { Child };
      state = useState({ flag: false });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>abc</span>");
    parent.state.flag = true;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>abcdef</span>");
  });

  test("can inject values in tagged templates", async () => {
    const SUBTEMPLATE = xml`<span><t t-esc="state.n"/></span>`;
    class Parent extends Component {
      static template = xml`<t t-call="${SUBTEMPLATE}"/>`;
      state = useState({ n: 42 });
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>42</span>");
  });
  // Depends on t-props
  test.skip("update props of component without concrete own node", async () => {
    class Custom extends Component {
      static template = xml`
        <div class="widget-subkey">
          <t t-esc="props.key"/>__<t t-esc="props.subKey"/>
        </div>`;
    }
    class Child extends Component {
      static components = { Custom };
      static template = xml`
        <Custom
          t-key="props.subKey"
          key="props.key"
          subKey="props.subKey"/>`;
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          <Child t-key="childProps.key" t-props="childProps"/>
        </div>`;
      childProps = {
        key: 1,
        subKey: 1,
      };
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.textContent!.trim()).toBe("1__1");

    // First step: change the Custom's instance
    Object.assign(parent.childProps, {
      subKey: 2,
    });
    parent.render();
    await nextTick();
    expect(fixture.textContent!.trim()).toBe("1__2");

    // Second step, change both Child's and Custom's instance
    Object.assign(parent.childProps, {
      key: 2,
      subKey: 3,
    });
    parent.render();
    await nextTick();
    expect(fixture.textContent!.trim()).toBe("2__3");
  });

  test.skip("subcomponents cannot change observable state received from parent", async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    class Child extends Component {
      static template = xml`<div/>`;
      setup() {
        this.props.obj.coffee = 2;
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child obj="state.obj"/></div>`;
      static components = { Child };
      state = useState({ obj: { coffee: 1 } });
    }
    let error;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('Observed state cannot be changed here! (key: "coffee", val: "2")');
    expect(console.error).toBeCalledTimes(0);
    console.error = consoleError;
  });
});

describe("dynamic t-props", () => {
  test.skip("basic use", async () => {
    expect.assertions(4);

    class Child extends Component {
      static template = xml`
        <span>
            <t t-esc="props.a + props.b"/>
        </span>
      `;
      setup() {
        expect(this.props).toEqual({ a: 1, b: 2 });
        expect(this.props).not.toBe(parent.some.obj);
      }
    }
    class Parent extends Component {
      static template = xml`
        <div>
            <Child t-props="some.obj"/>
        </div>
      `;
      static components = { Child };

      some = { obj: { a: 1, b: 2 } };
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
  });

  test.skip("t-props with props", async () => {
    expect.assertions(1);

    class Child extends Component {
      static template = xml`<div />`;
      setup() {
        expect(this.props).toEqual({ a: 1, b: 2, c: "c" });
      }
    }
    class Parent extends Component {
      static template = xml`
        <div>
            <Child t-props="props" a="1" b="2" />
        </div>
      `;
      static components = { Child };

      props = { a: "a", c: "c" };
    }

    await mount(Parent, fixture);
  });
});

describe("mount targets", () => {
  test("can mount a component (with position='first-child')", async () => {
    class Root extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);
    const app = new App(Root);
    await app.mount(fixture, { position: "first-child" });
    expect(fixture.innerHTML).toBe("<div>app</div><span></span>");
  });

  test("can mount a component (with default position='last-child')", async () => {
    class Root extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);
    const app = new App(Root);
    await app.mount(fixture, { position: "last-child" });
    expect(fixture.innerHTML).toBe("<span></span><div>app</div>");
  });

  test("default mount option is 'last-child'", async () => {
    class Root extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);
    const app = new App(Root);
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<span></span><div>app</div>");
  });
});

describe.skip("mount special cases", () => {
  test("widget can be mounted on different target", async () => {
    // class MyWidget extends Component {
    //   static template = xml`<div>Hey</div>`;
    //   patched() {
    //     throw new Error("patched should not be called");
    //   }
    // }
    // const div = document.createElement("div");
    // const span = document.createElement("span");
    // fixture.appendChild(div);
    // fixture.appendChild(span);
    // const w = new MyWidget();
    // await w.mount(div);
    // expect(fixture.innerHTML).toBe("<div><div>Hey</div></div><span></span>");
    // await w.mount(span);
    // expect(fixture.innerHTML).toBe("<div></div><span><div>Hey</div></span>");
  });

  test("widget can be mounted on different target, another situation", async () => {
    // const def = makeDeferred();
    // const steps: string[] = [];
    // class MyWidget extends Component {
    //   static template = xml`<div>Hey</div>`;
    //   async willStart() {
    //     return def;
    //   }
    //   patched() {
    //     throw new Error("patched should not be called");
    //   }
    // }
    // const div = document.createElement("div");
    // const span = document.createElement("span");
    // fixture.appendChild(div);
    // fixture.appendChild(span);
    // const w = new MyWidget();
    // w.mount(div).catch(() => steps.push("1 catch"));
    // await nextTick();
    // expect(fixture.innerHTML).toBe("<div></div><span></span>");
    // w.mount(span).then(() => steps.push("2 resolved"));
    // // we wait two microticks because this is the number of internal promises
    // // that need to be resolved/rejected, and because we want to prove here
    // // that the first mount operation is cancelled immediately, and not after
    // // one full tick.
    // await nextMicroTick();
    // await nextMicroTick();
    // expect(steps).toEqual([]);
    // await nextTick();
    // expect(fixture.innerHTML).toBe("<div></div><span></span>");
    // def.resolve();
    // await nextTick();
    // expect(steps).toEqual(["2 resolved"]);
    // expect(fixture.innerHTML).toBe("<div></div><span><div>Hey</div></span>");
  });

  test("component can be mounted on same target, another situation", async () => {
    // const def = makeDeferred();
    // const steps: string[] = [];
    // class MyWidget extends Component {
    //   static template = xml`<div>Hey</div>`;
    //   async willStart() {
    //     return def;
    //   }
    //   patched() {
    //     throw new Error("patched should not be called");
    //   }
    // }
    // const w = new MyWidget();
    // w.mount(fixture).then(() => steps.push("1 resolved"));
    // await nextTick();
    // expect(fixture.innerHTML).toBe("");
    // w.mount(fixture).then(() => steps.push("2 resolved"));
    // await nextTick();
    // expect(steps).toEqual([]);
    // expect(fixture.innerHTML).toBe("");
    // def.resolve();
    // await nextTick();
    // expect(fixture.innerHTML).toBe("<div>Hey</div>");
    // expect(steps).toEqual(["1 resolved", "2 resolved"]);
  });

  test("mounting a destroyed widget", async () => {
    //   class MyWidget extends Component {
    //     static template = xml`<div>Hey</div>`;
    //   }
    //   const w = new MyWidget();
    //   w.destroy(); // because, why not
    //   let error;
    //   try {
    //     await w.mount(fixture);
    //   } catch (e) {
    //     error = e;
    //   }
    //   expect(scheduler.tasks.length).toBe(0);
    //   expect(error).toBeDefined();
    //   expect(error.message).toBe("Cannot mount a destroyed component");
  });

  test("destroying a sub-component cleans itself from parent's vnode", async () => {
    //   class C1 extends Component {
    //     static template = xml`<div><div><t t-esc="props.a"/></div></div>`;
    //   }
    //   class P extends Component {
    //     static components = { C1 };
    //     static template = xml`<div><div><C1 t-props="state" t-if="state.a"/></div></div>`;
    //     state = {
    //       a: "first",
    //     };
    //   }
    //   const parent = new P();
    //   await parent.mount(fixture);
    //   expect(fixture.textContent).toBe("first");
    //   parent.unmount();
    //   parent.state.a = "";
    //   parent.mount(fixture);
    //   parent.state.a = "fixed";
    //   await parent.render();
    //   expect(fixture.textContent).toBe("fixed");
  });

  test("destroying a sub-component cleans itself from parent's vnode, part 2", async () => {
    // class C1 extends Component {
    //   static template = xml`<div><div><t t-esc="props.a"/></div></div>`;
    // }
    // class P extends Component {
    //   static components = { C1 };
    //   static template = xml`<div><div><C1 t-props="state" t-if="state.a"/>some text</div></div>`;
    //   state = {
    //     a: "first",
    //   };
    // }
    // const parent = new P();
    // await parent.mount(fixture);
    // expect(fixture.textContent).toBe("firstsome text");
    // parent.unmount();
    // parent.state.a = "";
    // parent.mount(fixture);
    // parent.state.a = "fixed";
    // await parent.render();
    // expect(fixture.textContent).toBe("fixedsome text");
  });

  test("destroying a sub-component cleans itself from parent's vnode, part 3", async () => {
    // class C1 extends Component {
    //   static template = xml`<div><div><t t-esc="props.a"/></div></div>`;
    // }
    // class C2 extends Component {
    //   static template = xml`<C1 a="props.a"/>`;
    //   static components = { C1 };
    // }
    // class P extends Component {
    //   static components = { C2 };
    //   static template = xml`<div><div><C2 t-props="state" t-if="state.a"/></div></div>`;
    //   state = {
    //     a: "first",
    //   };
    // }
    // const parent = new P();
    // await parent.mount(fixture);
    // expect(fixture.textContent).toBe("first");
    // parent.unmount();
    // parent.state.a = "";
    // parent.mount(fixture);
    // parent.state.a = "fixed";
    // await parent.render();
    // expect(fixture.textContent).toBe("fixed");
  });

  test("destroying a sub-component cleans itself from parent's vnode, part 4", async () => {
    // class C1 extends Component {
    //   static template = xml`<div><div><t t-esc="props.a"/></div></div>`;
    // }
    // class C2 extends Component {
    //   static template = xml`<C1 a="props.a"/>`;
    //   static components = { C1 };
    // }
    // class P extends Component {
    //   static components = { C2 };
    //   static template = xml`<div><div><C2 t-props="state" t-if="state.a"/>some text</div></div>`;
    //   state = {
    //     a: "first",
    //   };
    // }
    // const parent = new P();
    // await parent.mount(fixture);
    // expect(fixture.textContent).toBe("firstsome text");
    // parent.unmount();
    // parent.state.a = "";
    // parent.mount(fixture);
    // parent.state.a = "fixed";
    // await parent.render();
    // expect(fixture.textContent).toBe("fixedsome text");
  });
});

describe("support svg components", () => {
  test("add proper namespace to svg", async () => {
    class GComp extends Component {
      static template = xml`
        <g>
            <circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/>
        </g>`;
    }

    class Svg extends Component {
      static template = xml`
        <svg>
            <GComp/>
        </svg>`;
      static components = { GComp };
    }
    await mount(Svg, fixture);

    expect(fixture.innerHTML).toBe(
      '<svg><g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"></circle></g></svg>'
    );
  });
});

describe("t-raw in components", () => {
  test("update properly on state changes", async () => {
    class Test extends Component {
      static template = xml`<div><t t-raw="state.value"/></div>`;
      state = useState({ value: "<b>content</b>" });
    }
    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("<div><b>content</b></div>");

    component.state.value = "<span>other content</span>";
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>other content</span></div>");
  });

  test("can render list of t-raw ", async () => {
    class Test extends Component {
      static template = xml`
        <div>
            <t t-foreach="state.items" t-as="item" t-key="item">
            <t t-esc="item"/>
            <t t-raw="item"/>
            </t>
        </div>`;
      state = useState({ items: ["<b>one</b>", "<b>two</b>", "<b>tree</b>"] });
    }
    await mount(Test, fixture);

    expect(fixture.innerHTML).toBe(
      "<div>&lt;b&gt;one&lt;/b&gt;<b>one</b>&lt;b&gt;two&lt;/b&gt;<b>two</b>&lt;b&gt;tree&lt;/b&gt;<b>tree</b></div>"
    );
  });
});
