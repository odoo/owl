import { App, Component, mount, useState, xml } from "../../src/index";
import { addTemplate, makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();
let fixture: HTMLElement;

function children(w: Component): Component[] {
  const childrenMap = w.__owl__.children;
  return Object.keys(childrenMap).map((id) => childrenMap[id].component);
}

beforeEach(() => {
  fixture = makeTestFixture();
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

    addTemplate("sub", `<GrandChild/>`);

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
    const parent = await mount(Parent, fixture);

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

    addTemplate("sometemplate", `<div class="slot"><Child/></div>`);
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

    const parent = await mount(UsingTcallInSlotted, fixture);

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
});
