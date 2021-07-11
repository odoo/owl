import { Component, mount, useState, xml } from "../../src/index";
import { addTemplate, fromName, makeTestFixture, nextTick, snapshotTemplateCode } from "../helpers";

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

    snapshotTemplateCode(fromName(App.template));
    const app = await mount(App, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>foo</div>");

    app.current.template = "bar";
    await nextTick();
    expect(fixture.innerHTML).toBe("bar");
  });
});
