import { App, Component, mount, useState, xml } from "../../src/index";
import { addTemplate, makeTestFixture, nextTick, snapshotEverything } from "../helpers";

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
});
