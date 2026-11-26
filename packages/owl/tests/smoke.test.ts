import { App, compile, Component, mount, xml } from "../src";

function makeFixture() {
  const fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

test("umbrella wiring: compile + mount + runtime work end-to-end", async () => {
  class Hello extends Component {
    static template = xml`<div>Hello world!</div>`;
  }
  const fixture = makeFixture();
  await mount(Hello, fixture);
  expect(fixture.innerHTML).toBe("<div>Hello world!</div>");
});

test("umbrella wiring: addTemplates parses XML strings", async () => {
  class Root extends Component {
    static template = "root_template";
  }
  const app = new App();
  app.addTemplates(`
    <templates>
      <t t-name="root_template">
        <span>ok</span>
      </t>
    </templates>
  `);
  const root = app.createRoot(Root);
  const fixture = makeFixture();
  await root.mount(fixture);
  expect(fixture.innerHTML).toBe("<span>ok</span>");
  app.destroy();
});

test("umbrella wiring: compile is exported, and its result can be used as a template", async () => {
  // e.g. a precompiled template
  const hello = compile(`<div>Hello <t t-out="this.name"/></div>`);
  class Hello extends Component {
    static template = "hello";
    name = "owl";
  }
  const fixture = makeFixture();
  await mount(Hello, fixture, { templates: { hello } });
  expect(fixture.innerHTML).toBe("<div>Hello owl</div>");
});
