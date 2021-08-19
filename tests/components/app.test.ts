import { App, Component } from "../../src";
import { status } from "../../src/component/status";
import { xml } from "../../src/tags";
import { makeTestFixture, snapshotEverything } from "../helpers";

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
    const el = comp.el!;
    expect(document.contains(el)).toBe(true);
    app.destroy();
    expect(document.contains(el)).toBe(false);
    expect(status(comp)).toBe("destroyed");
  });
});
