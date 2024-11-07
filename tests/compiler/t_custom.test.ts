import { App, Component, xml } from "../../src";
import { makeTestFixture, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-custom", () => {
  test("can use t-custom directive on a node", async () => {
    const steps: string[] = [];
    class SomeComponent extends Component {
      static template = xml`<div t-custom-plop="click" class="my-div"/>`;
      click() {
        steps.push("clicked");
      }
    }
    const app = new App(SomeComponent, {
      customDirectives: {
        plop: (node, value) => {
          node.setAttribute("t-on-click", value);
        },
      },
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div class="my-div"></div>`);
    fixture.querySelector("div")!.click();
    expect(steps).toEqual(["clicked"]);
  });

  test("can use t-custom directive with modifier on a node", async () => {
    const steps: string[] = [];
    class SomeComponent extends Component {
      static template = xml`<div t-custom-plop.mouse="click" class="my-div"/>`;
      click() {
        steps.push("clicked");
      }
    }
    const app = new App(SomeComponent, {
      customDirectives: {
        plop: (node, value, modifier) => {
          node.setAttribute("t-on-click", value);
          steps.push(modifier || "");
        },
      },
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div class="my-div"></div>`);
    fixture.querySelector("div")!.click();
    expect(steps).toEqual(["mouse", "clicked"]);
  });
});
