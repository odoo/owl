import { App, Component, mount, useState, xml } from "../../src/index";
import { isDirectChildOf, makeTestFixture, nextTick, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-call", () => {
  test("dynamic t-call", async () => {
    class Root extends Component {
      static template = xml`
          <t t-call="{{current.template}}">
            owl
          </t>`;
      current = useState({ template: "foo" });
    }

    const root = await mount(Root, fixture, {
      templates: `
        <templates>
          <t t-name="foo"><div>foo</div></t>
          <t t-name="bar">bar</t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("<div>foo</div>");

    root.current.template = "bar";
    await nextTick();
    expect(fixture.innerHTML).toBe("bar");
  });

  test("sub components in two t-calls", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
          <t t-if="state.val===1">
            <t t-call="sub"/>
          </t>
          <div t-else=""><t t-call="sub"/></div>`;
      static components = { Child };
      state = useState({ val: 1 });
    }
    const app = new App(Parent);
    app.addTemplate("sub", `<Child val="state.val"/>`);

    const parent = await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<span>1</span>");
    parent.state.val = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>2</span></div>");
  });

  test("handlers are properly bound through a t-call", async () => {
    let parent: any;

    const subTemplate = xml`<p t-on-click="update">lucas</p>`;
    class Parent extends Component {
      static template = xml`
        <div><t t-call="${subTemplate}"/><t t-esc="counter"/></div>`;
      counter = 0;

      update() {
        expect(this).toBe(parent);
        this.counter++;
        this.render();
      }
    }
    parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><p>lucas</p>0</div>");
    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><p>lucas</p>1</div>");
  });

  test("handlers are properly bound through a dynamic t-call", async () => {
    let parent: any;

    const subTemplate = xml`<p t-on-click="() => this.update()">lucas</p>`;
    class Parent extends Component {
      static template = xml`
        <div><t t-call="{{'${subTemplate}'}}"/><t t-esc="counter"/></div>`;
      counter = 0;

      update() {
        expect(this).toBe(parent);
        this.counter++;
        this.render();
      }
    }
    parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><p>lucas</p>0</div>");
    fixture.querySelector("p")!.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><p>lucas</p>1</div>");
  });

  test("parent is set within t-call", async () => {
    const sub = xml`<Child/>`;
    let child: any = null;
    class Child extends Component {
      static template = xml`<span>lucas</span>`;
      setup() {
        child = this;
      }
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`<div><t t-call="${sub}"/></div>`;
    }
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>lucas</span></div>");
    expect(isDirectChildOf(child, parent)).toBeTruthy();
  });

  test("t-call in t-foreach and children component", async () => {
    const sub = xml`<Child val="val"/>`;

    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          <t t-foreach="['a', 'b', 'c']" t-as="val" t-key="val">
            <t t-call="${sub}"/>
          </t>
        </div>`;
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>a</span><span>b</span><span>c</span></div>");
  });

  test("parent is set within t-call with no parentNode", async () => {
    const sub = xml`<Child />`;

    let child: any = null;

    class Child extends Component {
      setup() {
        child = this;
      }
      static template = xml`<span>lucas</span>`;
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<t t-call="${sub}"/>`;
    }

    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<span>lucas</span>");
    expect(isDirectChildOf(child, parent)).toBe(true);
  });

  test("handlers with arguments are properly bound through a t-call", async () => {
    const sub = xml`<p t-on-click="() => this.update(a)">lucas</p>`;

    let value: any = null;

    class Parent extends Component {
      static template = xml`<div><t t-call="${sub}"/></div>`;
      update(a: any) {
        expect(this).toBe(parent);
        value = a;
      }
      a = 3;
    }
    const parent = await mount(Parent, fixture);

    fixture.querySelector("p")!.click();
    expect(value).toBe(3);
  });

  test("dynamic t-call: key is propagated", async () => {
    let childId = 0;
    class Child extends Component {
      static template = xml`<div t-att-id="id" />`;
      id: any;
      setup() {
        this.id = childId++;
      }
    }
    const sub = xml`<Child />`;

    class Parent extends Component {
      static template = xml`<Child /><t t-call="{{ sub }}"/>`;
      static components = { Child };

      sub = sub;
    }

    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(`<div id="0"></div><div id="1"></div>`);
  });

  test("recursive t-call binding this -- static t-call", async () => {
    let clickCount = 0;
    class Parent extends Component {
      onClicked?: Function;
      setup() {
        const instance = this;

        this.onClicked = function () {
          clickCount++;
          expect(this).toBe(instance);
        };
      }

      static template = xml`
          <div><t t-call="recursive"><t t-set="level" t-value="0" /></t></div>
      `;
    }

    const app = new App(Parent);
    app.addTemplate(
      "recursive",
      `
        <t t-if="level &lt; 2" >
          <div t-on-click.stop="onClicked.bind(this)" t-esc="level" />
          <t t-call="recursive">
            <t t-set="level" t-value="level + 1" />
          </t>
        </t>
    `
    );

    await app.mount(fixture);
    for (const div of fixture.querySelectorAll("div")) {
      div.click();
    }
    expect(clickCount).toBe(2);
  });

  test("t-call with t-call-context, simple use", async () => {
    class Root extends Component {
      static template = xml`
          <t t-call="someTemplate" t-call-context="subctx"/>`;

      subctx = { aab: "aaron", lpe: "lucas" };
    }

    await mount(Root, fixture, {
      templates: `
        <templates>
          <t t-name="someTemplate"><t t-esc="aab"/><t t-esc="lpe"/></t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("aaronlucas");
  });

  test("t-call with t-call-context and subcomponent", async () => {
    class Child extends Component {
      static template = xml`child<t t-esc="props.name"/>`;
    }

    class Root extends Component {
      static template = xml`
          <t t-call="someTemplate" t-call-context="subctx"/>`;

      static components = { Child };

      subctx = { aab: "aaron", lpe: "lucas" };
    }

    await mount(Root, fixture, {
      templates: `
        <templates>
          <t t-name="someTemplate">
            <Child name="aab"/>
            <Child name="lpe"/>
          </t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("childaaronchildlucas");
  });

  test("t-call with t-call-context and subcomponent, in dev mode", async () => {
    class Child extends Component {
      static template = xml`child<t t-esc="props.name"/>`;
      static props = ["name"];
    }

    class Root extends Component {
      static template = xml`
          <t t-call="someTemplate" t-call-context="subctx"/>`;

      static components = { Child };

      subctx = { aab: "aaron", lpe: "lucas" };
    }

    await mount(Root, fixture, {
      test: true,
      templates: `
        <templates>
          <t t-name="someTemplate">
            <Child name="aab"/>
            <Child name="lpe"/>
          </t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("childaaronchildlucas");
  });

  test("t-call-context: ComponentNode is not looked up in the context", async () => {
    let child: any;
    class Child extends Component {
      static template = xml`<t t-slot="default"/>`;
      static props = ["name"];
      setup() {
        child = this;
      }
    }

    class Root extends Component {
      static template = xml`
          <t t-call="someTemplate" t-call-context="{method: function(){}}"/>`;
      static components = { Child };
    }

    // The following things need a reference to the ComponentNode, historically
    // we used to do this with ctx.__owl__, but this cannot work inside t-call-context
    // - t-ref: node.refs[refName] = something
    // - t-set: caused a call to capture, which used to use node.component
    // - .bind: used to bind to node.component
    const root = await mount(Root, fixture, {
      templates: `
        <templates>
          <t t-name="someTemplate">
            <div t-ref="myRef">outside slot</div>
            <Child prop.bind="method">
              <div t-ref="myRef2">I'm the default slot</div>
              <t t-set="test" t-value="3"/>
              <div t-esc="test"/>
            </Child>
          </t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe(
      "<div>outside slot</div><div>I'm the default slot</div><div>3</div>"
    );
    expect(Object.keys(child.__owl__.refs)).toEqual([]);
    expect(Object.keys(root.__owl__.refs)).toEqual(["myRef", "myRef2"]);
  });

  test("t-call-context: slots don't make component available again when context is captured", async () => {
    class Child extends Component {
      static template = xml`<t t-slot="default"/>`;
    }

    class Root extends Component {
      static template = xml`<t t-call="template" t-call-context="{}"/>`;
      static components = { Child };
      someValue = "Hello";
    }

    await mount(Root, fixture, {
      test: true,
      templates: `
        <templates>
          <t t-name="template">
            <t t-set="dummy" t-value="0"/>
            <Child>
              <t t-esc="someValue"/>
            </Child>
          </t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("");
  });

  test("t-call-context: this is not available inside t-call-context", async () => {
    class Root extends Component {
      static template = xml`<t t-call="someTemplate" t-call-context="{}"/>`;
    }

    await mount(Root, fixture, {
      templates: `
        <templates>
          <t t-name="someTemplate">
            <t t-esc="this"/>
          </t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("");
  });

  test("dynamic t-call with same sub component", async () => {
    class Child extends Component {
      static template = xml`child`;
    }

    class Root extends Component {
      static template = xml`
        <t t-esc="current.template"/>
        <t t-call="{{current.template}}"/>`;
      static components = { Child };
      current = useState({ template: "A" });
    }

    const root = await mount(Root, fixture, {
      templates: `
        <templates>
          <t t-name="A"><Child/></t>
          <t t-name="B"><Child/></t>
        </templates>`,
    });
    expect(fixture.innerHTML).toBe("Achild");

    root.current.template = "B";
    await nextTick();
    expect(fixture.innerHTML).toBe("Bchild");
  });
});
