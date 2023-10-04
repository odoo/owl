import { App, Component, mount, status, toRaw, useState, xml } from "../../src";
import {
  elem,
  makeTestFixture,
  nextAppError,
  nextTick,
  snapshotEverything,
  steps,
  useLogLifecycle,
} from "../helpers";
import { markup } from "../../src/runtime/utils";

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
    expect(elem(component)).toEqual(fixture.querySelector("span"));
  });

  test("cannot mount on a documentFragment", async () => {
    class SomeWidget extends Component {
      static template = xml`<div>content</div>`;
    }
    let error: Error;
    try {
      await mount(SomeWidget, document.createDocumentFragment() as any);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Cannot mount component: the target is not a valid DOM element");
  });

  test("can mount a simple component with props", async () => {
    class Test extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
    }

    const app = new App(Test, { props: { value: 3 } });
    const component = await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>3</span>");
    expect(elem(component)).toEqual(fixture.querySelector("span"));
  });

  test("can mount a component with just some text", async () => {
    class Test extends Component {
      static template = xml`just text`;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("just text");
    expect(elem(component)).toBeInstanceOf(Text);
  });

  test("can mount a component with no text", async () => {
    class Test extends Component {
      static template = xml`<t></t>`;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("");
    expect(elem(component)).toBeInstanceOf(Text);
  });

  test("can mount a simple component with multiple roots", async () => {
    class Test extends Component {
      static template = xml`<span></span><div></div>`;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("<span></span><div></div>");
    expect(elem(component).tagName).toBe("SPAN");
  });

  test("component with dynamic content can be updated", async () => {
    class Test extends Component {
      static template = xml`<span><t t-esc="value"/></span>`;
      value = 1;
    }

    const component = await mount(Test, fixture);

    expect(fixture.innerHTML).toBe("<span>1</span>");

    component.value = 2;
    component.render();
    await nextTick();
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
    component.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("twothreeone");
  });

  test("props is set on root component", async () => {
    expect.assertions(2);
    const p = {};
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        expect(toRaw(this.props)).not.toBe(p);
      }
    }

    const app = new App(Test, { props: p });
    await app.mount(fixture);
  });

  test("props value are own property of props object", async () => {
    expect.assertions(2);
    const p = { a: 1 };
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
        expect(Object.prototype.hasOwnProperty.call(this.props, "a")).toBe(true);
      }
    }

    const app = new App(Test, { props: p });
    await app.mount(fixture);
  });

  test("props value are own property of props object, even with default values", async () => {
    expect.assertions(3);
    const p = { a: 1 };
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      static defaultProps = { b: 1 };
      setup() {
        expect(Object.prototype.hasOwnProperty.call(this.props, "a")).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(this.props, "b")).toBe(true);
      }
    }

    const app = new App(Test, { props: p });
    await app.mount(fixture);
  });

  test("some simple sanity checks (el/status)", async () => {
    expect.assertions(3);
    class Test extends Component {
      static template = xml`<span>simple vnode</span>`;
      setup() {
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

    let error: Error;
    try {
      await mount(Test, null as any);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Cannot mount component: the target is not a valid DOM element");
  });

  test("a component cannot be mounted in a detached node", async () => {
    class Test extends Component {
      static template = xml`<div/>`;
    }
    let error: Error;
    try {
      await mount(Test, document.createElement("div"));
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Cannot mount a component on a detached dom node");
  });

  test("a component cannot be mounted in a detached node (even if node is detached later)", async () => {
    const warn = console.warn;
    console.warn = jest.fn();
    class Test extends Component {
      static template = xml`<div/>`;
    }
    let error: Error;
    const app = new App(Test);
    const prom = app.mount(fixture);
    await Promise.resolve();
    fixture.remove();
    prom.catch((e: Error) => (error = e));
    await expect(nextAppError(app)).resolves.toThrow(
      "Cannot mount a component on a detached dom node"
    );
    expect(error!).toBeDefined();
    expect(error!.message).toBe("Cannot mount a component on a detached dom node");
    expect(console.warn).toBeCalledTimes(1);
    console.warn = warn;
  });

  test("crashes if it cannot find a template", async () => {
    class Test extends Component {
      static template = "wrongtemplate";
    }

    let error: Error;
    try {
      await mount(Test, fixture);
    } catch (e) {
      error = e as Error;
    }
    expect(error!).toBeDefined();
    expect(error!.message).toBe('Missing template: "wrongtemplate" (for component "Test")');
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
    test.render();
    await nextTick();
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
      <div><t t-esc="state.counter"/><button t-on-click="() => state.counter++">Inc</button></div>`;
      state = useState({
        counter: 0,
      });
    }

    await mount(Counter, fixture);
    expect(fixture.innerHTML).toBe("<div>0<button>Inc</button></div>");
    const button = fixture.getElementsByTagName("button")[0];
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<button>Inc</button></div>");
  });

  // TODO: rename
  test("rerendering a widget with a sub widget", async () => {
    class Counter extends Component {
      static template = xml`
      <div><t t-esc="state.counter"/><button t-on-click="() => state.counter++">Inc</button></div>`;
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
    fixture.querySelector("div")!.appendChild(document.createElement("span"));
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
    fixture.querySelector("h1")!.appendChild(document.createElement("p"));
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
  test("update props of component without concrete own node", async () => {
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

  test("component children doesn't leak (if case)", async () => {
    class Child extends Component {
      static template = xml`<div />`;
      setup() {
        useLogLifecycle();
      }
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child t-if="ifVar" />`;
      ifVar = true;
    }

    const parent = await mount(Parent, fixture);
    expect(Object.keys(parent.__owl__.children).length).toStrictEqual(1);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Child:setup",
        "Child:willStart",
        "Child:willRender",
        "Child:rendered",
        "Child:mounted",
      ]
    `);

    parent.ifVar = false;
    parent.render();
    await nextTick();
    expect(Object.keys(parent.__owl__.children).length).toStrictEqual(0);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Child:willUnmount",
        "Child:willDestroy",
      ]
    `);
  });

  test("component children doesn't leak (t-key case)", async () => {
    // This test should encompass the t-foreach and t-call cases too (because they also use a flavor of some key)
    class Child extends Component {
      static template = xml`<div />`;
      setup() {
        useLogLifecycle();
      }
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child t-key="keyVar" />`;
      keyVar = 1;
    }

    const parent = await mount(Parent, fixture);
    expect(Object.keys(parent.__owl__.children).length).toStrictEqual(1);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Child:setup",
        "Child:willStart",
        "Child:willRender",
        "Child:rendered",
        "Child:mounted",
      ]
    `);

    parent.keyVar = 2;
    parent.render();
    await nextTick();
    expect(Object.keys(parent.__owl__.children).length).toStrictEqual(1);
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "Child:setup",
        "Child:willStart",
        "Child:willRender",
        "Child:rendered",
        "Child:willUnmount",
        "Child:willDestroy",
        "Child:mounted",
      ]
    `);
  });

  test("GrandChild display is controlled by its GrandParent", async () => {
    class GrandChild extends Component {
      static template = xml`<div />`;
      setup() {
        useLogLifecycle();
      }
    }

    class Child extends Component {
      static components = { GrandChild };
      static template = xml`<GrandChild t-if="props.displayGrandChild" />`;
    }

    class Parent extends Component {
      static template = xml`<t t-component="myComp" displayGrandChild="displayGrandChild"/>`;
      myComp = Child;
      displayGrandChild = true;
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "GrandChild:setup",
        "GrandChild:willStart",
        "GrandChild:willRender",
        "GrandChild:rendered",
        "GrandChild:mounted",
      ]
    `);

    parent.displayGrandChild = false;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("");

    expect(steps.splice(0)).toMatchInlineSnapshot(`
      Array [
        "GrandChild:willUnmount",
        "GrandChild:willDestroy",
      ]
    `);
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

  test("mount function: can mount a component (with default position='last-child')", async () => {
    class Root extends Component {
      static template = xml`<div>app</div>`;
    }
    const span = document.createElement("span");
    fixture.appendChild(span);
    await mount(Root, fixture, { position: "last-child" });
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
      '<svg xmlns="http://www.w3.org/2000/svg"><g xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"></circle></g></svg>'
    );
  });
});

describe("t-out in components", () => {
  test("update properly on state changes", async () => {
    class Test extends Component {
      static template = xml`<div><t t-out="state.value"/></div>`;
      state = useState({ value: markup("<b>content</b>") });
    }
    const component = await mount(Test, fixture);

    markup("prout");
    expect(fixture.innerHTML).toBe("<div><b>content</b></div>");

    component.state.value = markup("<span>other content</span>");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>other content</span></div>");
  });

  test("can render list of t-out ", async () => {
    class Test extends Component {
      static template = xml`
        <div>
            <t t-foreach="state.items" t-as="item" t-key="item">
            <t t-esc="item"/>
            <t t-out="item"/>
            </t>
        </div>`;
      state = useState({
        items: [markup("<b>one</b>"), markup("<b>two</b>"), markup("<b>tree</b>")],
      });
    }
    await mount(Test, fixture);

    expect(fixture.innerHTML).toBe(
      "<div>&lt;b&gt;one&lt;/b&gt;<b>one</b>&lt;b&gt;two&lt;/b&gt;<b>two</b>&lt;b&gt;tree&lt;/b&gt;<b>tree</b></div>"
    );
  });

  test("can switch the contents of two t-out repeatedly", async () => {
    class Test extends Component {
      static template = xml`
        <t t-out="state.a"/>
        <t t-out="state.b"/>
      `;
      state = useState({
        a: markup("<div>1</div>"),
        b: markup("<div>2</div>"),
      });

      reverse() {
        const { state } = this;
        [state.a, state.b] = [state.b, state.a];
      }
    }

    const comp = await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<div>1</div><div>2</div>");
    comp.reverse();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>2</div><div>1</div>");
    comp.reverse();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1</div><div>2</div>");
  });

  test("t-out and updating falsy values, ", async () => {
    class Test extends Component {
      static template = xml`<t t-out="state.a"/>`;
      state: any = useState({ a: 0 });
    }

    const comp = await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("0");
    comp.state.a = undefined;
    await nextTick();
    expect(fixture.innerHTML).toBe("");

    comp.state.a = "hello";
    await nextTick();
    expect(fixture.innerHTML).toBe("hello");

    comp.state.a = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("false");
  });
});
