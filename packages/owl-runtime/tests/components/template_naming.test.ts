import { App, Component, xml } from "../../src";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("template naming", () => {
  test("component with named template has named template function", async () => {
    const app = new App();
    app.addTemplate("my.Widget", "<div>hello</div>");
    class MyWidget extends Component {
      static template = "my.Widget";
    }
    const root = app.createRoot(MyWidget);
    await root.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hello</div>");
    const templateFn = app.getTemplate("my.Widget");
    expect(templateFn.name).toBe("template_my_Widget");
    app.destroy();
  });

  test("component with hyphenated template name has named template function", async () => {
    const app = new App();
    app.addTemplate("o-spreadsheet-grid", "<div>grid</div>");
    class Grid extends Component {
      static template = "o-spreadsheet-grid";
    }
    const root = app.createRoot(Grid);
    await root.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>grid</div>");
    const templateFn = app.getTemplate("o-spreadsheet-grid");
    expect(templateFn.name).toBe("template_o_spreadsheet_grid");
    app.destroy();
  });

  test("component with inline xml template uses its generated name", async () => {
    class MyWidget extends Component {
      static template = xml`<div>hello</div>`;
    }
    const app = new App();
    app.createRoot(MyWidget);
    const templateFn = app.getTemplate(MyWidget.template);
    expect(templateFn.name).toBe(MyWidget.template);
    app.destroy();
  });
});
