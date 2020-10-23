import { Component, Env } from "../../src/component/component";
import { QWeb } from "../../src/qweb/qweb";
import { xml } from "../../src/tags";
import { useState, useRef } from "../../src/hooks";
import { makeTestFixture, makeTestEnv, nextTick } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

// We create before each test:
// - fixture: a div, appended to the DOM, intended to be the target of dom
//   manipulations.  Note that it is removed after each test.
// - env: a WEnv, necessary to create new components

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  Component.env = env;
});

afterEach(() => {
  fixture.remove();
});

function children(w: Component): Component[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map((id) => childrenMap[id]);
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("t-slot directive", () => {
  test("can define and call slots", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
               <Dialog>
                  <t t-set-slot="header"><span>header</span></t>
                  <t t-set-slot="footer"><span>footer</span></t>
               </Dialog>
            </div>
            <div t-name="Dialog">
              <div><t t-slot="header"/></div>
              <div><t t-slot="footer"/></div>
            </div>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      "<div><div><div><span>header</span></div><div><span>footer</span></div></div></div>"
    );
    expect(env.qweb.templates.Parent.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.Dialog.fn.toString()).toMatchSnapshot();
    expect(QWeb.slots["1_header"].toString()).toMatchSnapshot();
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("can define and call slots using old t-set keyword", async () => {
    // NOTE: this test should be removed once we stop supporting the t-set directive
    // for defining slot content.
    class Dialog extends Component {
      static template = xml`
        <div>
          <div><t t-slot="header"/></div>
          <div><t t-slot="footer"/></div>
        </div>`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Dialog>
            <t t-set="header"><span>header</span></t>
            <t t-set="footer"><span>footer</span></t>
          </Dialog>
        </div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      "<div><div><div><span>header</span></div><div><span>footer</span></div></div></div>"
    );
    expect(env.qweb.templates[Parent.template].fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates[Dialog.template].fn.toString()).toMatchSnapshot();
    expect(QWeb.slots["1_header"].toString()).toMatchSnapshot();
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("named slots can define a default content", async () => {
    class Dialog extends Component {
      static template = xml`
          <span>
            <t t-slot="header">default content</t>
          </span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog/></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>default content</span></div>");
    expect(env.qweb.templates[Dialog.template].fn.toString()).toMatchSnapshot();
  });

  test("dafault slots can define a default content", async () => {
    class Dialog extends Component {
      static template = xml`
          <span>
            <t t-slot="default">default content</t>
          </span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog/></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>default content</span></div>");
    expect(env.qweb.templates[Dialog.template].fn.toString()).toMatchSnapshot();
  });

  test("default content is not rendered if slot is provided", async () => {
    class Dialog extends Component {
      static template = xml`
          <span>
            <t t-slot="default">default content</t>
          </span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog>hey</Dialog></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("default content is not rendered if named slot is provided", async () => {
    class Dialog extends Component {
      static template = xml`
          <span>
            <t t-slot="header">default content</t>
          </span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog><t t-set-slot="header">hey</t></Dialog></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("slots are rendered with proper context", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
              <span class="counter"><t t-esc="state.val"/></span>
              <Dialog>
                <t t-set-slot="footer"><button t-on-click="doSomething">do something</button></t>
              </Dialog>
            </div>
            <span t-name="Dialog"><t t-slot="footer"/></span>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
      state = useState({ val: 0 });
      doSomething() {
        this.state.val++;
      }
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context, part 2", async () => {
    env.qweb.addTemplates(`
          <templates>
              <a t-name="Link" t-att-href="props.to">
                  <t t-slot="default"/>
              </a>
              <div t-name="App">
                  <u><li t-foreach="state.users" t-as="user" t-key="user.id">
                      <Link to="'/user/' + user.id">User <t t-esc="user.name"/></Link>
                  </li></u>
              </div>
          </templates>
      `);
    class Link extends Component {}

    class App extends Component {
      state = useState({
        users: [
          { id: 1, name: "Aaron" },
          { id: 2, name: "David" },
        ],
      });
      static components = { Link };
    }

    const app = new App();
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User David</a></li></u></div>'
    );
    expect(env.qweb.templates.Link.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();

    // test updateprops here
    app.state.users[1].name = "Mathieu";
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User Mathieu</a></li></u></div>'
    );
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context, part 3", async () => {
    env.qweb.addTemplates(`
          <templates>
              <a t-name="Link" t-att-href="props.to">
                  <t t-slot="default"/>
              </a>
              <div t-name="App">
                  <u><li t-foreach="state.users" t-as="user" t-key="user.id" >
                      <t t-set="userdescr" t-value="'User ' + user.name"/>
                      <Link to="'/user/' + user.id"><t t-esc="userdescr"/></Link>
                  </li></u>
              </div>
          </templates>
      `);
    class Link extends Component {}

    class App extends Component {
      state = useState({
        users: [
          { id: 1, name: "Aaron" },
          { id: 2, name: "David" },
        ],
      });
      static components = { Link };
    }

    const app = new App();
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User David</a></li></u></div>'
    );
    expect(env.qweb.templates.Link.fn.toString()).toMatchSnapshot();
    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();

    // test updateprops here
    app.state.users[1].name = "Mathieu";
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User Mathieu</a></li></u></div>'
    );
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("slots are rendered with proper context, part 4", async () => {
    env.qweb.addTemplates(`
          <templates>
              <a t-name="Link" t-att-href="props.to">
                  <t t-slot="default"/>
              </a>
              <div t-name="App">
                  <t t-set="userdescr" t-value="'User ' + state.user.name"/>
                  <Link to="'/user/' + state.user.id"><t t-esc="userdescr"/></Link>
              </div>
          </templates>
      `);
    class Link extends Component {}

    class App extends Component {
      state = useState({ user: { id: 1, name: "Aaron" } });
      static components = { Link };
    }

    const app = new App();
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe('<div><a href="/user/1">User Aaron</a></div>');

    expect(env.qweb.templates.App.fn.toString()).toMatchSnapshot();

    // test updateprops here
    app.state.user.name = "David";
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><a href="/user/1">User David</a></div>');
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("refs are properly bound in slots", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="footer"/></span>`;
    }
    class Parent extends Component {
      static template = xml`
            <div>
              <span class="counter"><t t-esc="state.val"/></span>
              <Dialog>
                <t t-set-slot="footer"><button t-ref="myButton" t-on-click="doSomething">do something</button></t>
              </Dialog>
            </div>
          `;
      static components = { Dialog };
      state = useState({ val: 0 });
      button = useRef("myButton");
      doSomething() {
        this.state.val++;
      }
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    parent.button.el!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
    expect(QWeb.slots["1_footer"].toString()).toMatchSnapshot();
  });

  test("content is the default slot", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
               <Dialog>
                  <span>sts rocks</span>
               </Dialog>
            </div>
            <div t-name="Dialog"><t t-slot="default"/></div>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts rocks</span></div></div>");
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("default slot work with text nodes", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
               <Dialog>sts rocks</Dialog>
            </div>
            <div t-name="Dialog"><t t-slot="default"/></div>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div>sts rocks</div></div>");
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("multiple roots are allowed in a named slot", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
               <Dialog>
                  <t t-set-slot="content">
                      <span>sts</span>
                      <span>rocks</span>
                  </t>
               </Dialog>
            </div>
            <div t-name="Dialog"><t t-slot="content"/></div>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts</span><span>rocks</span></div></div>");
    expect(QWeb.slots["1_content"].toString()).toMatchSnapshot();
  });

  test("multiple roots are allowed in a default slot", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
               <Dialog>
                  <span>sts</span>
                  <span>rocks</span>
               </Dialog>
            </div>
            <div t-name="Dialog"><t t-slot="default"/></div>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts</span><span>rocks</span></div></div>");
    expect(QWeb.slots["1_default"].toString()).toMatchSnapshot();
  });

  test("missing slots are ignored", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
              <Dialog/>
            </div>
            <span t-name="Dialog">
              <t t-slot="default"/>
              <span>some content</span>
              <t t-slot="footer"/>
            </span>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span><span>some content</span></span></div>");
  });

  test("t-debug on a t-set-slot (defining a slot)", async () => {
    const consoleLog = console.log;
    console.log = jest.fn();

    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
              <Dialog><t t-set-slot="content" t-debug="">abc</t></Dialog>
            </div>
            <span t-name="Dialog">
              <t t-slot="content"/>
            </span>
          </templates>
      `);
    class Dialog extends Component {}
    class Parent extends Component {
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(console.log).toHaveBeenCalledTimes(0);
    console.log = consoleLog;
  });

  test("slot preserves properly parented relationship", async () => {
    env.qweb.addTemplates(`
          <templates>
            <div t-name="Parent">
               <Child>
                  <GrandChild/>
               </Child>
            </div>
            <div t-name="Child"><t t-slot="default"/></div>
            <div t-name="GrandChild">Grand Child</div>
          </templates>
      `);
    class Child extends Component {}
    class GrandChild extends Component {}
    class Parent extends Component {
      static components = { Child, GrandChild };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><div>Grand Child</div></div></div>");

    const parentChildren = children(parent);
    expect(parentChildren.length).toBe(1);
    expect(parentChildren[0]).toBeInstanceOf(Child);

    const childrenChildren = children(parentChildren[0]);
    expect(childrenChildren.length).toBe(1);
    expect(childrenChildren[0]).toBeInstanceOf(GrandChild);
  });

  test("nested slots: evaluation context and parented relationship", async () => {
    let slot;
    class Slot extends Component {
      static template = xml`<span t-esc="props.val"/>`;
      constructor(parent, props) {
        super(parent, props);
        slot = this;
      }
    }
    class GrandChild extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
    }
    class Child extends Component {
      static components = { GrandChild };
      static template = xml`
          <GrandChild>
            <t t-slot="default"/>
          </GrandChild>`;
    }
    class Parent extends Component {
      static components = { Child, Slot };
      static template = xml`<Child><Slot val="state.val"/></Child>`;
      state = useState({ val: 3 });
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
    expect(slot.__owl__.parent).toBeInstanceOf(GrandChild);
  });

  test("slot are properly rendered if inner props are changed", async () => {
    env.qweb.addTemplates(`
      <templates>
          <div t-name="SomeComponent">
              SC:<t t-esc="props.val"/>
          </div>
  
  
          <div t-name="GenericComponent">
              <t t-slot="default" />
          </div>
  
          <div t-name="App">
              <button t-on-click="inc">Inc[<t t-esc="state.val"/>]</button>
              <GenericComponent>
                  <SomeComponent val="state.val"/>
              </GenericComponent>
          </div>
      </templates>
      `);
    class SomeComponent extends Component {}
    class GenericComponent extends Component {}
    class App extends Component {
      static components = { GenericComponent, SomeComponent };
      state = useState({ val: 4 });

      inc() {
        this.state.val++;
      }
    }
    const app = new App();
    await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><button>Inc[4]</button><div><div> SC:4</div></div></div>");
    (<any>fixture.querySelector("button")).click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button>Inc[5]</button><div><div> SC:5</div></div></div>");
  });

  test("slots and wrapper components", async () => {
    class Link extends Component {
      static template = xml`
          <a href="abc">
              <t t-slot="default"/>
          </a>`;
    }

    class A extends Component {
      static template = xml`<Link>hey</Link>`;
      static components = { Link: Link };
    }

    const a = new A();
    await a.mount(fixture);

    expect(fixture.innerHTML).toBe(`<a href="abc">hey</a>`);
  });

  test("template can just return a slot", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.value"/></span>`;
    }
    class SlotComponent extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    class Parent extends Component {
      static template = xml`
          <div>
              <SlotComponent><Child value="state.value"/></SlotComponent>
          </div>`;
      static components = { SlotComponent, Child };
      state = useState({ value: 3 });
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");

    expect(QWeb.TEMPLATES[SlotComponent.template].fn.toString()).toMatchSnapshot();

    parent.state.value = 5;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>5</span></div>");
  });

  test("multiple slots containing components", async () => {
    class C extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }
    class B extends Component {
      static template = xml`<div><t t-slot="s1"/><t t-slot="s2"/></div>`;
    }
    class A extends Component {
      static template = xml`
          <B>
            <t t-set-slot="s1"><C val="1"/></t>
            <t t-set-slot="s2"><C val="2"/></t>
          </B>`;
      static components = { B, C };
    }

    const a = new A();
    await a.mount(fixture);

    expect(fixture.innerHTML).toBe(`<div><span>1</span><span>2</span></div>`);
  });

  test("slots in t-foreach and re-rendering", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="state.val"/><t t-slot="default"/></span>`;
      state = useState({ val: "A" });
      mounted() {
        this.state.val = "B";
      }
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
          <div>
            <t t-foreach="Array(2)" t-as="n" t-key="n_index">
              <Child><t t-esc="n_index"/></Child>
            </t>
          </div>`;
    }
    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>A0</span><span>A1</span></div>");

    await nextTick(); // wait for the changes triggered in mounted to be applied
    expect(fixture.innerHTML).toBe("<div><span>B0</span><span>B1</span></div>");
  });

  test("slots in t-foreach with t-set and re-rendering", async () => {
    class Child extends Component {
      static template = xml`
          <span>
            <t t-esc="state.val"/>
            <t t-slot="default"/>
          </span>`;
      state = useState({ val: "A" });
      mounted() {
        this.state.val = "B";
      }
    }
    class ParentWidget extends Component {
      static components = { Child };
      static template = xml`
          <div>
            <t t-foreach="Array(2)" t-as="n" t-key="n_index">
              <t t-set="dummy" t-value="n_index"/>
              <Child><t t-esc="dummy"/></Child>
            </t>
          </div>`;
    }

    const widget = new ParentWidget();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>A0</span><span>A1</span></div>");

    await nextTick(); // wait for changes triggered in mounted to be applied
    expect(fixture.innerHTML).toBe("<div><span>B0</span><span>B1</span></div>");
  });

  test("nested slots in same template", async () => {
    let child, child2, child3;
    class Child extends Component {
      static template = xml`
          <span id="c1">
            <div>
              <t t-slot="default"/>
            </div>
          </span>`;
      constructor(parent, props) {
        super(parent, props);
        child = this;
      }
    }
    class Child2 extends Component {
      static template = xml`
          <span id="c2">
            <t t-slot="default"/>
          </span>`;
      constructor(parent, props) {
        super(parent, props);
        child2 = this;
      }
    }
    class Child3 extends Component {
      static template = xml`
          <span>Child 3</span>`;
      constructor(parent, props) {
        super(parent, props);
        child3 = this;
      }
    }
    class Parent extends Component {
      static components = { Child, Child2, Child3 };
      static template = xml`
          <span id="parent">
            <Child>
              <Child2>
                <Child3/>
              </Child2>
            </Child>
          </span>`;
    }

    const widget = new Parent();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<span id="parent"><span id="c1"><div><span id="c2"><span>Child 3</span></span></div></span></span>'
    );

    expect(child3.__owl__.parent).toStrictEqual(child2);
    expect(child2.__owl__.parent).toStrictEqual(child);
    expect(child.__owl__.parent).toStrictEqual(widget);
  });

  test("t-slot nested within another slot", async () => {
    let portal, modal, child3;
    class Child3 extends Component {
      static template = xml`
          <span>Child 3</span>`;
      constructor(parent, props) {
        super(parent, props);
        child3 = this;
      }
    }
    class Modal extends Component {
      static template = xml`
          <span id="modal">
            <t t-slot="default"/>
          </span>`;
      constructor(parent, props) {
        super(parent, props);
        modal = this;
      }
    }
    class Portal extends Component {
      static template = xml`
          <span id="portal">
            <t t-slot="default"/>
          </span>`;
      constructor(parent, props) {
        super(parent, props);
        portal = this;
      }
    }
    class Dialog extends Component {
      static components = { Modal, Portal };
      static template = xml`
          <span id="c2">
            <Modal>
              <Portal>
                <t t-slot="default"/>
              </Portal>
             </Modal>
          </span>`;
    }
    class Parent extends Component {
      static components = { Child3, Dialog };
      static template = xml`
          <span id="c1">
            <Dialog>
              <Child3/>
            </Dialog>
          </span>`;
    }

    const widget = new Parent();
    await widget.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<span id="c1"><span id="c2"><span id="modal"><span id="portal"><span>Child 3</span></span></span></span></span>'
    );

    expect(child3.__owl__.parent).toStrictEqual(portal);
    expect(portal.__owl__.parent).toStrictEqual(modal);
  });

  test("t-slot supports many instances", async () => {
    let child3;
    class Child3 extends Component {
      static template = xml`
          <span>Child 3</span>`;
      constructor(parent, props) {
        super(parent, props);
        child3 = this;
      }
    }
    class Dialog extends Component {
      static template = xml`
          <span id="c2">
            <t t-slot="default"/>
          </span>`;
    }
    class Parent extends Component {
      static components = { Child3, Dialog };
      static template = xml`
          <span id="c1">
            <Dialog>
              <Child3 val="state.lol"/>
            </Dialog>
          </span>`;
      state = { lol: "k" };
    }

    const widget = new Parent();
    await widget.mount(fixture);
    expect(child3.props.val).toBe("k");

    const widget_1 = new Parent();
    widget_1.state.lol = "m";
    await widget_1.mount(fixture);
    expect(child3.props.val).toBe("m");
  });

  test("slots in slots, with vars", async () => {
    class B extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class A extends Component {
      static template = xml`
          <div>
            <B>
              <t t-slot="default"/>
            </B>
          </div>`;
      static components = { B };
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <t t-set="test" t-value="state.name"/>
            <A>
              <p>hey<t t-esc="test"/></p>
            </A>
          </div>`;
      static components = { A };
      state = { name: "aaron" };
    }

    const parent = new Parent();
    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span><p>heyaaron</p></span></div></div>");
  });

  test("t-set t-value in a slot", async () => {
    class Dialog extends Component {
      static template = xml`
          <span>
            <t t-slot="default"/>
          </span>`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Dialog>
            <t t-set="rainbow" t-value="'dash'"/>
            <t t-esc="rainbow"/>
          </Dialog>
        </div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>dash</span></div>");
    expect(env.qweb.templates[Dialog.template].fn.toString()).toMatchSnapshot();
  });

  test("slot and t-esc", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog><t t-esc="'toph'"/></Dialog></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>toph</span></div>");
  });

  test("slot and (inline) t-esc", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog t-esc="'toph'"/></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span>toph</span></div>");
  });

  test("slot and t-call", async () => {
    env.qweb.addTemplate("sokka", "<p>sokka</p>");
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog><t t-call="sokka"/></Dialog></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span><p>sokka</p></span></div>");
  });

  test("slot and (inline) t-call", async () => {
    env.qweb.addTemplate("sokka", "<p>sokka</p>");
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog t-call="sokka"/></div>`;
      static components = { Dialog };
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><span><p>sokka</p></span></div>");
  });

  test("named slot inside slot", async () => {
    class Child extends Component {
      static template = xml`
        <div>
          <t t-slot="brol"/>
          <t t-slot="default"/>
        </div>`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Child>
            <t t-set-slot="brol">
              <p>A<t t-esc="value"/></p>
            </t>
            <Child>
              <t t-set-slot="brol">
                <p>B<t t-esc="value"/></p>
              </t>
            </Child>
          </Child>
        </div>`;
      static components = { Child };
      value = "blip";
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><p>Ablip</p><div><p>Bblip</p></div></div></div>");
  });

  test("named slots inside slot, again", async () => {
    class Child extends Component {
      static template = xml`
        <child>
          <t t-slot="brol1">default1</t>
          <t t-slot="brol2">default2</t>
          <t t-slot="default"/>
        </child>`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Child>
            <t t-set-slot="brol1">
              <p>A<t t-esc="value"/></p>
            </t>
            <Child>
              <t t-set-slot="brol2">
                <p>B<t t-esc="value"/></p>
              </t>
            </Child>
          </Child>
        </div>`;
      static components = { Child };
      value = "blip";
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe(
      "<div><child><p>Ablip</p>default2<child>default1<p>Bblip</p></child></child></div>"
    );
  });

  test("named slot inside slot, part 3", async () => {
    class Child extends Component {
      static template = xml`
        <div>
          <t t-slot="brol"/>
          <t t-slot="default"/>
        </div>`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Child>
            <t t-set-slot="brol">
              <p>A<t t-esc="value"/></p>
            </t>
            <Child>
              <t>
                <t t-set-slot="brol">
                  <p>B<t t-esc="value"/></p>
                </t>
              </t>
            </Child>
          </Child>
        </div>`;
      static components = { Child };
      value = "blip";
    }
    const parent = new Parent();
    await parent.mount(fixture);

    expect(fixture.innerHTML).toBe("<div><div><p>Ablip</p><div><p>Bblip</p></div></div></div>");
  });
});
