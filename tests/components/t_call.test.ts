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
      dev: true,
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
});
