import { App } from "../../src/";
import { Component } from "../../src/core/component";
import { status } from "../../src/status";
import { xml } from "../../src/tags";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("lifecycle hooks", () => {
  test("lifecycle for a simple component", async () => {
    expect.assertions(5);
    class Test extends Component {
      static template = xml`<span>test</span>`;

      setup() {
        expect(status(this)).toBe("new");
      }
    }

    const app = new App(Test);

    const component = await app.mount(fixture);

    expect(fixture.innerHTML).toBe("<span>test</span>");
    expect(status(component)).toBe("mounted");

    app.destroy();

    expect(fixture.innerHTML).toBe("");
    expect(status(component)).toBe("destroyed");
  });
});
