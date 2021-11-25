import { App, Component, mount, useState, xml } from "../../src/index";
import {
  addTemplate,
  isDirectChildOf,
  makeTestFixture,
  nextTick,
  snapshotEverything,
} from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-call", () => {
  test("dynamic t-call", async () => {
    class App extends Component {
      static template = xml`
          <t t-call="{{current.template}}">
            owl
          </t>`;
      current = useState({ template: "foo" });
    }
    addTemplate("foo", "<div>foo</div>");
    addTemplate("bar", "bar");

    const app = await mount(App, fixture);
    expect(fixture.innerHTML).toBe("<div>foo</div>");

    app.current.template = "bar";
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
});
