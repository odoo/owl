import { App, Component, mount, onMounted, useState, xml } from "../../src/index";
import { children, makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();
let originalconsoleWarn = console.warn;
let mockConsoleWarn: any;
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
  mockConsoleWarn = jest.fn(() => {});
  console.warn = mockConsoleWarn;
});

afterEach(() => {
  console.warn = originalconsoleWarn;
});

describe("slots", () => {
  test("simple default slot", async () => {
    class Child extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }

    class Parent extends Component {
      static template = xml`<Child>some text</Child>`;
      static components = { Child };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<span>some text</span>");
  });

  test("simple default slot, variation", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    class Parent extends Component {
      static template = xml`<Child>some text</Child>`;
      static components = { Child };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("some text");
  });

  test("simple slot with slot scope", async () => {
    let child: any;
    class Child extends Component {
      static template = xml`<span><t t-slot="slotName" bool="state.bool"/></span>`;
      state = useState({ bool: true });
      setup() {
        child = this;
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child>
          <t t-set-slot="slotName" t-slot-scope="slotScope">
            <t t-if="slotScope.bool">some text</t>
            <t t-else="slotScope.bool">other text</t>
          </t>
        </Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>some text</span>");

    child.state.bool = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>other text</span>");
  });

  test("slot with slot scope and t-props", async () => {
    class Child extends Component {
      static template = xml`
        <t t-slot="slotName" t-props="info"/>`;
      info = { a: 1, b: 2 };
    }

    class Parent extends Component {
      static template = xml`
        <Child>
          <t t-set-slot="slotName" t-slot-scope="info">
            <p t-esc="info.a"/>
            <p t-esc="info.b"/>
          </t>
        </Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<p>1</p><p>2</p>");
  });

  test("simple dynamic slot with slot scope", async () => {
    let child: any;
    class Child extends Component {
      static template = xml`<span><t t-slot="{{ 'slotName' }}" bool="state.bool"/></span>`;
      state = useState({ bool: true });
      setup() {
        child = this;
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child>
          <t t-set-slot="slotName" t-slot-scope="slotScope">
            <t t-if="slotScope.bool">some text</t>
            <t t-else="slotScope.bool">other text</t>
          </t>
        </Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>some text</span>");

    child.state.bool = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>other text</span>");
  });

  test("simple named and empty slot", async () => {
    class Child extends Component {
      static template = xml`<span><t t-slot="default" /><t t-slot="myEmptySlot"/></span>`;

      setup() {
        expect(this.props.slots["myEmptySlot"]).toBeTruthy();
      }
    }

    class Parent extends Component {
      static template = xml`<Child>some text<t t-set-slot="myEmptySlot" /></Child>`;
      static components = { Child };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<span>some text</span>");
  });

  test("simple named and empty slot -- 2", async () => {
    class Child extends Component {
      static template = xml`<span><t t-slot="myEmptySlot">default empty</t></span>`;

      setup() {
        expect(this.props.slots["myEmptySlot"]).toBeTruthy();
        expect(this.props.slots["myEmptySlot"].myProp).toBe("myProp text");
      }
    }

    class Parent extends Component {
      static template = xml`<Child><t t-set-slot="myEmptySlot" myProp="'myProp text'" /></Child>`;
      static components = { Child };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<span>default empty</span>");
  });

  test("default slot with slot scope: shorthand syntax", async () => {
    let child: any;
    class Child extends Component {
      static template = xml`<span><t t-slot="default" bool="state.bool"/></span>`;
      state = useState({ bool: true });
      setup() {
        child = this;
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child t-slot-scope="slotScope">
          <t t-if="slotScope.bool">some text</t>
          <t t-else="slotScope.bool">other text</t>
        </Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>some text</span>");

    child.state.bool = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>other text</span>");
  });

  test("simple default slot with params", async () => {
    class Child extends Component {
      static template = xml`<span><t t-slot="default" bool="state.bool"/></span>`;
      state = useState({ bool: true });
    }

    class Parent extends Component {
      static template = xml`
        <Child>
          <t t-if="slotScope.bool">some text</t>
          <t t-else="slotScope.bool">other text</t>
        </Child>`;
      static components = { Child };
    }

    let error = null;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(mockConsoleWarn).toBeCalledTimes(1);
  });

  test("simple default slot with params and bound function", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default" fn.bind="getValue"/>`;
      state = useState({ value: 123 });
      getValue() {
        return this.state.value;
      }
    }

    class Parent extends Component {
      static template = xml`
        <Child t-slot-scope="slotScope"><t t-esc="slotScope.fn()"/></Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("123");
  });

  test("default slot with params with - in it", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default" some-value="state.value"/>`;
      state = useState({ value: 123 });
    }

    class Parent extends Component {
      static template = xml`
        <Child t-slot-scope="slotScope"><t t-esc="slotScope['some-value']"/></Child>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("123");
  });

  test("fun: two calls to the same slot", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default"/><t t-slot="default"/>`;
    }

    class Parent extends Component {
      static template = xml`<Child>some text</Child>`;
      static components = { Child };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("some textsome text");
  });

  test("slot content is bound to caller", async () => {
    class Child extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }

    class Parent extends Component {
      static template = xml`<Child><button t-on-click="inc">some text</button></Child>`;
      static components = { Child };
      state = useState({ value: 0 });
      inc() {
        this.state.value++;
      }
    }
    const parent = await mount(Parent, fixture);

    expect(parent.state.value).toBe(0);
    fixture.querySelector("button")!.click();
    expect(parent.state.value).toBe(1);
  });

  test("slot content is bound to caller (variation)", async () => {
    class Child extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }

    class Parent extends Component {
      // t-set t-value in template is to force compiler to protect the scope
      // which in turns means that the ctx propagated to the slot is a sub object
      static template = xml`
        <Child>
          <t t-set="var" t-value="1"/>
          <button t-on-click="() => this.inc()">some text</button>
        </Child>`;
      static components = { Child };
      state = useState({ value: 0 });
      inc() {
        expect(this).toBe(parent);
        this.state.value++;
      }
    }
    const parent = await mount(Parent, fixture);

    expect(parent.state.value).toBe(0);
    fixture.querySelector("button")!.click();
    expect(parent.state.value).toBe(1);
  });

  test("can define and call slots", async () => {
    class Dialog extends Component {
      static template = xml`
        <div>
          <div><t t-slot="header"/></div>
          <div><t t-slot="footer"/></div>
        </div>`;
    }

    class Parent extends Component {
      static components = { Dialog };
      static template = xml`
        <div>
          <Dialog>
            <t t-set-slot="header"><span>header</span></t>
            <t t-set-slot="footer"><span>footer</span></t>
          </Dialog>
        </div>`;
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      "<div><div><div><span>header</span></div><div><span>footer</span></div></div></div>"
    );
  });

  test("can define and call slots with params", async () => {
    class Dialog extends Component {
      static template = xml`
        <div>
          <t t-esc="props.slots['header'].param"/>
          <div><t t-slot="header"/></div>
          <t t-esc="props.slots['footer'].param"/>
          <div><t t-slot="footer"/></div>
        </div>`;
    }

    class Parent extends Component {
      static components = { Dialog };
      static template = xml`
        <div>
          <Dialog>
            <t t-set-slot="header" param="var"><span>header</span></t>
            <t t-set-slot="footer" param="'5'"><span>footer</span></t>
          </Dialog>
        </div>`;
      var = 3;
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      "<div><div>3<div><span>header</span></div>5<div><span>footer</span></div></div></div>"
    );
  });

  test("can define and call slots with bound params", async () => {
    class Child extends Component {
      static template = xml`
        <t t-slot="abc"/>
        <t t-esc="props.slots['abc'].getValue()"/>`;
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`
          <Child>
            <t t-set-slot="abc" getValue.bind="getValue">abc</t>
          </Child>`;
      state = useState({ value: 444 });
      getValue() {
        return this.state.value;
      }
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("abc444");
  });

  test("no named slot content => just no children", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="header"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<Dialog/>`;
      static components = { Dialog };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span></span>");
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

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>default content</span></div>");
  });

  test("can define a default content", async () => {
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
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>default content</span></div>");
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
    await mount(Parent, fixture);

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
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>hey</span></div>");
  });

  test("slots are properly bound to correct component", async () => {
    let child: any = null;
    class Child extends Component {
      // t-set t-value in template is to force compiler to protect the scope
      // which in turns means that the ctx propagated to the slot is a sub object
      static template = xml`
        <t t-slot="default">
          <t t-set="var" t-value="1"/>
          <button t-on-click="() => this.increment()">
            <t t-esc="state.value"/>
          </button>
        </t>`;

      state = useState({ value: 1 });
      setup() {
        child = this;
      }
      increment() {
        expect(this).toBe(child);
        this.state.value++;
      }
    }

    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<button>1</button>");

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>2</button>");
  });

  test("slots are rendered with proper context", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="footer"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
          <div>
            <span class="counter"><t t-esc="state.val"/></span>
            <Dialog>
              <t t-set-slot="footer">
                <button t-on-click="doSomething">do something</button>
              </t>
            </Dialog>
          </div>`;
      static components = { Dialog };
      state = useState({ val: 0 });
      doSomething() {
        this.state.val++;
      }
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
  });

  test("slots are rendered with proper context, part 2", async () => {
    class Link extends Component {
      static template = xml`
            <a t-att-href="props.to">
              <t t-slot="default"/>
            </a>`;
    }

    class App extends Component {
      static template = xml`
          <div>
            <u><li t-foreach="state.users" t-as="user" t-key="user.id">
                <Link to="'/user/' + user.id">User <t t-esc="user.name"/></Link>
            </li></u>
          </div>`;

      state = useState({
        users: [
          { id: 1, name: "Aaron" },
          { id: 2, name: "David" },
        ],
      });
      static components = { Link };
    }

    const app = await mount(App, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User David</a></li></u></div>'
    );

    // test updateprops here
    app.state.users[1].name = "Mathieu";
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User Mathieu</a></li></u></div>'
    );
  });

  test("slots are rendered with proper context, part 3", async () => {
    class Link extends Component {
      static template = xml`
            <a t-att-href="props.to">
              <t t-slot="default"/>
            </a>`;
    }

    class App extends Component {
      static template = xml`
          <div>
            <u><li t-foreach="state.users" t-as="user" t-key="user.id" >
                <t t-set="userdescr" t-value="'User ' + user.name"/>
                <Link to="'/user/' + user.id"><t t-esc="userdescr"/></Link>
            </li></u>
          </div>`;
      state = useState({
        users: [
          { id: 1, name: "Aaron" },
          { id: 2, name: "David" },
        ],
      });
      static components = { Link };
    }

    const app = await mount(App, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User David</a></li></u></div>'
    );

    // test updateprops here
    app.state.users[1].name = "Mathieu";
    await nextTick();
    expect(fixture.innerHTML).toBe(
      '<div><u><li><a href="/user/1">User Aaron</a></li><li><a href="/user/2">User Mathieu</a></li></u></div>'
    );
  });

  test("slots are rendered with proper context, part 4", async () => {
    class Link extends Component {
      static template = xml`
            <a t-att-href="props.to">
              <t t-slot="default"/>
            </a>`;
    }

    class App extends Component {
      static template = xml`
          <div>
            <t t-set="userdescr" t-value="'User ' + state.user.name"/>
            <Link to="'/user/' + state.user.id"><t t-esc="userdescr"/></Link>
          </div>`;
      static components = { Link };
      state = useState({ user: { id: 1, name: "Aaron" } });
    }

    const app = await mount(App, fixture);

    expect(fixture.innerHTML).toBe('<div><a href="/user/1">User Aaron</a></div>');

    // test updateprops here
    app.state.user.name = "David";
    await nextTick();
    expect(fixture.innerHTML).toBe('<div><a href="/user/1">User David</a></div>');
  });

  test("content is the default slot", async () => {
    class Dialog extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Dialog>
              <span>sts rocks</span>
            </Dialog>
          </div>`;
      static components = { Dialog };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>sts rocks</span></div></div>");
  });

  test("content is the default slot (variation)", async () => {
    class Dialog extends Component {
      static template = xml`<t t-slot="default"/>`;
    }
    class Parent extends Component {
      static template = xml`
            <Dialog>
              <span>sts rocks</span>
            </Dialog>`;
      static components = { Dialog };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>sts rocks</span>");
  });

  test("default slot work with text nodes", async () => {
    class Dialog extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Dialog>sts rocks</Dialog>
          </div>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div>sts rocks</div></div>");
  });

  test("default slot work with text nodes (variation)", async () => {
    class Dialog extends Component {
      static template = xml`<t t-slot="default"/>`;
    }
    class Parent extends Component {
      static template = xml`<Dialog>sts rocks</Dialog>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("sts rocks");
  });

  test("multiple roots are allowed in a named slot", async () => {
    class Dialog extends Component {
      static template = xml`<div><t t-slot="content"/></div>`;
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Dialog>
              <t t-set-slot="content">
                  <span>sts</span>
                  <span>rocks</span>
              </t>
            </Dialog>
          </div>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts</span><span>rocks</span></div></div>");
  });

  test("multiple roots are allowed in a default slot", async () => {
    class Dialog extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Dialog>
              <span>sts</span>
              <span>rocks</span>
            </Dialog>
          </div>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div><span>sts</span><span>rocks</span></div></div>");
  });

  test("missing slots are ignored", async () => {
    class Dialog extends Component {
      static template = xml`
          <span>
            <t t-slot="default"/>
            <span>some content</span>
            <t t-slot="footer"/>
          </span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog /></div>`;
      static components = { Dialog };
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span><span>some content</span></span></div>");
  });

  test("t-debug on a t-set-slot (defining a slot)", async () => {
    const consoleLog = console.log;
    console.log = jest.fn();

    class Dialog extends Component {
      static template = xml`<span><t t-slot="content"/></span>`;
    }
    class Parent extends Component {
      static template = xml`
          <div>
            <Dialog><t t-set-slot="content" t-debug="">abc</t></Dialog>
          </div>`;
      static components = { Dialog };
    }

    await mount(Parent, fixture);
    expect(console.log).toHaveBeenCalledTimes(0);
    console.log = consoleLog;
  });

  test("slot preserves properly parented relationship", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default"/>`;
    }
    class GrandChild extends Component {
      static template = xml`Grand Child`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Child>
            <GrandChild/>
          </Child>
        </div>`;
      static components = { Child, GrandChild };
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div>Grand Child</div>");

    const parentChildren = children(parent);
    expect(parentChildren.length).toBe(1);
    expect(parentChildren[0]).toBeInstanceOf(Child);

    const childrenChildren = children(parentChildren[0]);
    expect(childrenChildren.length).toBe(1);
    expect(childrenChildren[0]).toBeInstanceOf(GrandChild);
  });

  test("slot preserves properly parented relationship, even through t-call", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    class GrandChild extends Component {
      static template = xml`Grand Child`;
    }

    class Parent extends Component {
      static template = xml`
          <div>
            <Child>
              <t t-call="sub"/>
            </Child>
          </div>`;
      static components = { Child, GrandChild };
    }

    // throw new Error("boom")
    const parent = await mount(Parent, fixture, {
      templates: `
        <templates>
          <t t-name="sub"><GrandChild/></t>
        </templates>`,
    });

    expect(fixture.innerHTML).toBe("<div>Grand Child</div>");

    const parentChildren = children(parent);
    expect(parentChildren.length).toBe(1);
    expect(parentChildren[0]).toBeInstanceOf(Child);

    const childrenChildren = children(parentChildren[0]);
    expect(childrenChildren.length).toBe(1);
    expect(childrenChildren[0]).toBeInstanceOf(GrandChild);
  });

  test("t-slot scope context", async () => {
    expect.assertions(4);

    class Wrapper extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    let dialog: any;

    class Dialog extends Component {
      static template = xml`
        <Wrapper>
          <div t-on-click="onClick">
            <t t-slot="default" />
          </div>
        </Wrapper>
      `;

      static components = { Wrapper };

      setup() {
        dialog = this;
      }

      onClick() {
        // we do not use expect(this).toBe(dialog) here because if it fails, it
        // may blow up jest because it then tries to compute a diff, which is
        // infinite if there is a cycle
        expect(this === dialog).toBe(true);
      }
    }

    class Parent extends Component {
      static template = xml`
        <Dialog>
            <button>The Button</button>
        </Dialog>`;
      static components = { Dialog };
    }

    await mount(Parent, fixture);

    fixture.querySelector("button")!.click();
    await nextTick();
  });

  test("t-slot in recursive templates", async () => {
    class Wrapper extends Component {
      static template = xml`
          <wrapper>
            <t t-slot="default"/>
          </wrapper>`;
    }

    class Parent extends Component {
      static template = "_test_recursive_template";
      static components = { Wrapper };
      name = "foo";
      items = [
        {
          name: "foo-0",
          children: [
            { name: "foo-00", children: [] },
            {
              name: "foo-01",
              children: [
                { name: "foo-010", children: [] },
                { name: "foo-011", children: [] },
                {
                  name: "foo-012",
                  children: [
                    { name: "foo-0120", children: [] },
                    { name: "foo-0121", children: [] },
                    { name: "foo-0122", children: [] },
                  ],
                },
              ],
            },
            { name: "foo-02", children: [] },
          ],
        },
        { name: "foo-1", children: [] },
        { name: "foo-2", children: [] },
      ];
    }

    const recursiveTemplate = `
          <Wrapper>
            <t t-esc="name" />
            <t t-foreach="items" t-as="item" t-key="item.name">
                <t t-if="!item.children.length">
                <t t-esc="item.name" />
                </t>
                <t t-else="" t-call="_test_recursive_template">
                <t t-set="name" t-value="item.name" />
                <t t-set="items" t-value="item.children" />
                </t>
            </t>
        </Wrapper>`;
    const app = new App(Parent);
    app.addTemplate("_test_recursive_template", recursiveTemplate);

    await app.mount(fixture);

    expect(fixture.innerHTML).toBe(
      "<wrapper>foo<wrapper>foo-0foo-00<wrapper>foo-01foo-010foo-011<wrapper>foo-012foo-0120foo-0121foo-0122</wrapper></wrapper>foo-02</wrapper>foo-1foo-2</wrapper>"
    );
  });

  test("t-slot within dynamic t-call", async () => {
    class Child extends Component {
      static template = xml`<div class="child"/>`;
    }

    class Slotted extends Component {
      static template = xml`<div class="slotted"><t t-slot="default" /></div>`;
    }

    class UsingTcallInSlotted extends Component {
      tcallTemplate = "sometemplate";
      static template = xml`
      <div>
        <Slotted>
          <t t-call="{{ tcallTemplate }}"/>
        </Slotted>
      </div>`;
      static components = { Slotted, Child };
    }

    const parent = await mount(UsingTcallInSlotted, fixture, {
      templates: `
        <templates>
          <t t-name="sometemplate">
            <div class="slot"><Child/></div>
          </t>
        </templates>`,
    });

    expect(parent).toBeInstanceOf(UsingTcallInSlotted);
    expect(children(parent).length).toBe(1);
    const slotted = children(parent)[0];
    expect(slotted).toBeInstanceOf(Slotted);
    expect(children(slotted).length).toBe(1);
    const child = children(slotted)[0];
    expect(child).toBeInstanceOf(Child);

    expect(fixture.innerHTML).toBe(
      `<div><div class="slotted"><div class="slot"><div class="child"></div></div></div></div>`
    );
  });

  test("slots in t-foreach in t-foreach", async () => {
    class Child extends Component {
      static template = xml`
        <div><t t-slot="default" /></div>
      `;
    }

    class App extends Component {
      static template = xml`
        <div>
          <t t-foreach="tree" t-as="node1" t-key="node1.key">
            <div t-esc="node1.value" />
            <ul>
              <t t-foreach="node1.nodes" t-as="node2" t-key="node2.key">
                <Child>
                  <li t-esc="node1.value" />
                </Child>
              </t>
            </ul>
          </t>
        </div>`;

      static components = { Child };

      tree = [
        {
          key: "a",
          value: "A",
          nodes: [
            {
              key: "1",
              value: "A-1",
            },
            {
              key: "2",
              value: "A-2",
            },
          ],
        },
        {
          key: "b",
          value: "B",
          nodes: [
            {
              key: "1",
              value: "B-1",
            },
            {
              key: "2",
              value: "B-2",
            },
          ],
        },
      ];
    }

    await mount(App, fixture);

    expect(fixture.innerHTML).toBe(
      "<div><div>A</div><ul><div><li>A</li></div><div><li>A</li></div></ul><div>B</div><ul><div><li>B</li></div><div><li>B</li></div></ul></div>"
    );
  });

  test("default slot next to named slot, with default content", async () => {
    class Dialog extends Component {
      // We're using 2 slots here: a "default" one and a "footer",
      // both having default children nodes.
      static template = xml`
        <div class="Dialog">
          <div class="content">
            <t t-slot="default">
              Default content
            </t>
          </div>
          <div class="footer">
            <t t-slot="footer">
              Default footer
            </t>
          </div>
        </div>
      `;
    }

    class App extends Component {
      // Here we're trying to assign the "footer" slot with some content
      static components = { Dialog };
      static template = xml`
        <div>
          <Dialog>
            <t t-set-slot="footer">
              Overridden footer
            </t>
          </Dialog>
        </div>
      `;
    }

    await mount(App, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><div class="Dialog"><div class="content"> Default content </div><div class="footer"> Overridden footer </div></div></div>'
    );
  });

  test("dynamic t-slot call", async () => {
    class Toggler extends Component {
      static template = xml`<button t-on-click="toggle"><t t-slot="{{current.slot}}"/></button>`;
      current = useState({ slot: "slot1" });
      toggle() {
        this.current.slot = this.current.slot === "slot1" ? "slot2" : "slot1";
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Toggler>
            <t t-set-slot="slot1"><p>slot1</p><span>content</span></t>
            <t t-set-slot="slot2"><h1>slot2</h1></t>
          </Toggler>
        </div>`;
      static components = { Toggler };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><button><p>slot1</p><span>content</span></button></div>");

    fixture.querySelector<HTMLElement>("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button><h1>slot2</h1></button></div>");

    fixture.querySelector<HTMLElement>("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button><p>slot1</p><span>content</span></button></div>");
  });

  test("dynamic t-slot call with default", async () => {
    class Toggler extends Component {
      static template = xml`
        <button t-on-click="toggle">
          <t t-slot="{{current.slot}}">
            owl
          </t>
        </button>`;
      current = useState({ slot: "slot1" });
      toggle() {
        this.current.slot = this.current.slot === "slot1" ? "slot2" : "slot1";
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Toggler>
            <t t-set-slot="slot1"><p>slot1</p><span>content</span></t>
            <t t-set-slot="slot2"><h1>slot2</h1></t>
          </Toggler>
        </div>`;
      static components = { Toggler };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><button><p>slot1</p><span>content</span></button></div>");

    fixture.querySelector<HTMLElement>("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><button><h1>slot2</h1></button></div>");
  });

  test("slot are properly rendered if inner props are changed", async () => {
    class SomeComponent extends Component {
      static template = xml`
        <div>
          SC:<t t-esc="props.val"/>
        </div>`;
    }
    class GenericComponent extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
    }

    class App extends Component {
      static template = xml`
        <div>
          <button t-on-click="inc">Inc[<t t-esc="state.val"/>]</button>
          <GenericComponent>
            <SomeComponent val="state.val"/>
          </GenericComponent>
        </div>`;
      static components = { GenericComponent, SomeComponent };
      state = useState({ val: 4 });

      inc() {
        this.state.val++;
      }
    }
    await mount(App, fixture);

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

    await mount(A, fixture);

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

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");

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

    await mount(A, fixture);

    expect(fixture.innerHTML).toBe(`<div><span>1</span><span>2</span></div>`);
  });

  test("slots in t-foreach and re-rendering", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="state.val"/><t t-slot="default"/></span>`;
      state = useState({ val: "A" });
      setup() {
        onMounted(() => {
          this.state.val = "B";
        });
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
    await mount(Parent, fixture);
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
      setup() {
        onMounted(() => {
          this.state.val = "B";
        });
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

    await mount(ParentWidget, fixture);
    expect(fixture.innerHTML).toBe("<div><span>A0</span><span>A1</span></div>");

    await nextTick(); // wait for changes triggered in mounted to be applied
    expect(fixture.innerHTML).toBe("<div><span>B0</span><span>B1</span></div>");
  });

  test("nested slots in same template", async () => {
    let child: any = null;
    let child2: any = null;
    let child3: any = null;

    class Child extends Component {
      static template = xml`
          <span id="c1">
            <div>
              <t t-slot="default"/>
            </div>
          </span>`;
      setup() {
        child = this;
      }
    }
    class Child2 extends Component {
      static template = xml`
          <span id="c2">
            <t t-slot="default"/>
          </span>`;
      setup() {
        child2 = this;
      }
    }
    class Child3 extends Component {
      static template = xml`
          <span>Child 3</span>`;
      setup() {
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

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      '<span id="parent"><span id="c1"><div><span id="c2"><span>Child 3</span></span></div></span></span>'
    );

    expect(children(child2)).toEqual([child3]);
    expect(children(child)).toEqual([child2]);
    expect(children(parent)).toEqual([child]);
  });

  test("t-slot nested within another slot", async () => {
    let portal: any = null;
    let modal: any = null;
    let child3: any = null;

    class Child3 extends Component {
      static template = xml`<span>Child 3</span>`;
      setup() {
        child3 = this;
      }
    }
    class Modal extends Component {
      static template = xml`<span id="modal"><t t-slot="default"/></span>`;
      setup() {
        modal = this;
      }
    }
    class Portal extends Component {
      static template = xml`<span id="portal"><t t-slot="default"/></span>`;
      setup() {
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

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe(
      '<span id="c1"><span id="c2"><span id="modal"><span id="portal"><span>Child 3</span></span></span></span></span>'
    );

    expect(children(portal)[0]).toBe(child3);
    expect(children(modal)[0]).toBe(portal);
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

    await mount(Parent, fixture);
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
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>dash</span></div>");
  });

  test("slot and t-esc", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog><t t-esc="'toph'"/></Dialog></div>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>toph</span></div>");
  });

  test("slot and t-call", async () => {
    let sokka = xml`<p>sokka</p>`;
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog><t t-call="${sokka}"/></Dialog></div>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span><p>sokka</p></span></div>");
  });

  test("slot and (inline) t-call", async () => {
    let sokka = xml`<p>sokka</p>`;
    class Dialog extends Component {
      static template = xml`<span><t t-slot="default"/></span>`;
    }
    class Parent extends Component {
      static template = xml`<div><Dialog t-call="${sokka}"/></div>`;
      static components = { Dialog };
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span><p>sokka</p></span></div>");
  });

  test("nested slots: evaluation context and parented relationship", async () => {
    let slot: any = null;
    let grandChild: any = null;

    class Slot extends Component {
      static template = xml`<span t-esc="props.val"/>`;
      setup() {
        slot = this;
      }
    }
    class GrandChild extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
      setup() {
        grandChild = this;
      }
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

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>3</span></div>");
    expect(children(grandChild)).toEqual([slot]);
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
    await mount(Parent, fixture);

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
    await mount(Parent, fixture);

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
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><div><p>Ablip</p><div><p>Bblip</p></div></div></div>");
  });

  test("can render only empty slot", async () => {
    class Parent extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    let error = null;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
    expect(fixture.innerHTML).toEqual("");
  });

  test("can render node with t-ref and Component in same slot", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    class Parent extends Component {
      static template = xml`<Child><div t-ref="div"/><Child/></Child>`;
      static components = { Child };
    }
    let error = null;
    try {
      await mount(Parent, fixture);
    } catch (e) {
      error = e;
    }
    expect(error).toBeNull();
  });

  test("can use t-call in default-content of t-slot", async () => {
    const template = xml``;
    class Child extends Component {
      static template = xml`<t t-slot="default"><t t-call="${template}"/></t>`;
    }

    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
  });

  test("can use component in default-content of t-slot", async () => {
    class GrandChild extends Component {
      static template = xml``;
    }
    class Child extends Component {
      static template = xml`<t t-slot="default"><GrandChild/></t>`;
      static components = { GrandChild };
    }

    class Parent extends Component {
      static template = xml`<Child/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
  });

  test("slot content has different key from other content -- static slot", async () => {
    class Child extends Component {
      static template = xml`<div t-esc="props.parent" />`;
    }

    class SlotDisplay extends Component {
      static components = { Child };
      static template = xml`<Child parent="'SlotDisplay'" /><t t-slot="default" />`;
    }

    class Parent extends Component {
      static components = { Child, SlotDisplay };
      static template = xml`
         <SlotDisplay>
           <Child parent="'Parent'" />
         </SlotDisplay>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>SlotDisplay</div><div>Parent</div>");
  });

  test("slot content has different key from other content -- dynamic slot", async () => {
    class Child extends Component {
      static template = xml`<div t-esc="props.parent" />`;
    }

    class SlotDisplay extends Component {
      static components = { Child };
      slotName = "default";
      static template = xml`<Child parent="'SlotDisplay'" /><t t-slot="{{ slotName }}" />`;
    }

    class Parent extends Component {
      static components = { Child, SlotDisplay };
      static template = xml`
         <SlotDisplay>
           <Child parent="'Parent'" />
         </SlotDisplay>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>SlotDisplay</div><div>Parent</div>");
  });

  test("mix of slots, t-call, t-call with body, and giving own props child", async () => {
    expect.assertions(11);

    class C extends Component {
      static template = xml`[C]<t t-slot="default" />`;
    }
    class B extends Component {
      static template = xml`[B]<C slots="props.slots" />`;
      static components = { C };
    }

    const subTemplate2 = xml`[sub2<t t-esc="v"/>]`;
    const subTemplate1 = xml`[sub1]
      <t t-set="dummy" t-value="validate"/>
      <t t-call="${subTemplate2}">
        <t t-set="v" t-value="props.number"/>
      </t>`;

    let a: any;
    class A extends Component {
      static components = { B };
      static template = xml`<B>[A]<t t-call="${subTemplate1}"/></B>`;
      setup() {
        a = this;
      }

      get validate() {
        // we check here that the actual component was not lost somehow
        expect(this.__owl__.component === a).toBe(true);
        return 1;
      }
    }

    class P extends Component {
      static components = { A };
      static template = xml`<button t-on-click="inc">inc</button><A number="state.number"/>`;

      state = useState({ number: 333 });
      inc() {
        this.state.number++;
      }
    }

    class Parent extends Component {
      static template = xml`<P/>`;
      static components = { P };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<button>inc</button>[B][C][A][sub1] [sub2333]");

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<button>inc</button>[B][C][A][sub1] [sub2334]");
  });

  test("slot in multiple locations", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
    }

    class Slotter extends Component {
      static components = { Child };
      static template = xml`
          <t t-if="props.location === 1">
            <p><t t-slot="default"/></p>
          </t>
          <t t-if="props.location === 2">
            <t t-slot="default"/>
          </t>
      `;
    }

    class Parent extends Component {
      static components = { Child, Slotter };
      static template = xml`
         <Slotter location="state.location">
          hello <Child/>
         </Slotter>`;
      state = useState({ location: 1 });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<p> hello <div>child</div></p>");
    parent.state.location = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe(" hello <div>child</div>");
  });

  test("dynamic slot in multiple locations", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
    }

    class Slotter extends Component {
      static components = { Child };
      static template = xml`
          <t t-if="props.location === 1">
            <p><t t-slot="{{'coffee'}}"/></p>
          </t>
          <t t-if="props.location === 2">
            <t t-slot="{{'coffee'}}"/>
          </t>
      `;
    }

    class Parent extends Component {
      static components = { Child, Slotter };
      static template = xml`
         <Slotter location="state.location">
          <t t-set-slot="coffee">hello <Child/></t>
         </Slotter>`;
      state = useState({ location: 1 });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<p>hello <div>child</div></p>");
    parent.state.location = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("hello <div>child</div>");
  });

  test("slot in t-foreach locations", async () => {
    class Child extends Component {
      static template = xml`<div>child</div>`;
    }

    class Slotter extends Component {
      static components = { Child };
      static template = xml`
          <t t-foreach="props.list" t-as="elem" t-key="elem_index">
            <p><t t-esc="elem"/><t t-slot="default"/></p>
          </t>
      `;
    }

    class Parent extends Component {
      static components = { Child, Slotter };
      static template = xml`
         <Slotter list="state.list">
          hello <Child/>
         </Slotter>`;
      state = useState({ list: [1] });
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<p>1 hello <div>child</div></p>");
    parent.state.list.push(2);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<p>1 hello <div>child</div></p><p>2 hello <div>child</div></p>"
    );
  });
});
