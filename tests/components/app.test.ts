import { App, Component, xml } from "../../src";
import { status } from "../../src/component/status";
import { makeTestFixture, snapshotEverything, nextTick, elem } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("app", () => {
  test("destroy remove the widget from the DOM", async () => {
    class SomeComponent extends Component {
      static template = xml`<div/>`;
    }

    const app = new App(SomeComponent);
    const comp = await app.mount(fixture);
    const el = elem(comp);
    expect(document.contains(el)).toBe(true);
    app.destroy();
    expect(document.contains(el)).toBe(false);
    expect(status(comp)).toBe("destroyed");
  });

  test("App supports env with getters/setters", async () => {
    let someVal = "maggot";

    const services: any = { serv1: "" };
    const env = {
      get someVal() {
        return someVal;
      },
      services,
    };

    class SomeComponent extends Component {
      static template = xml`<div><t t-esc="env.someVal" /> <t t-esc="Object.keys(env.services)" /></div>`;
    }

    const app = new App(SomeComponent);
    app.configure({ env });
    const comp = await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>maggot serv1</div>");
    someVal = "brain";
    services.serv2 = "";
    comp.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>brain serv1,serv2</div>");
  });
});
