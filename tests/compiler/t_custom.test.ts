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

  test("can use t-custom directive with modifiers on a node", async () => {
    const steps: string[] = [];
    class SomeComponent extends Component {
      static template = xml`<div t-custom-plop.mouse.stop="click" class="my-div"/>`;
      click() {
        steps.push("clicked");
      }
    }
    const app = new App(SomeComponent, {
      customDirectives: {
        plop: (node, value, modifiers) => {
          node.setAttribute("t-on-click", value);
          for (let mod of modifiers) {
            steps.push(mod);
          }
        },
      },
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(`<div class="my-div"></div>`);
    fixture.querySelector("div")!.click();
    expect(steps).toEqual(["mouse", "stop", "clicked"]);
  });
});
