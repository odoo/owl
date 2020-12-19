import { Component, mount } from "../../src/index";
import { makeTestFixture } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

function block(s: string) {
  // ?
}

describe.skip("render functions", () => {
  test("simple render function", async () => {
    class Test extends Component {
      static renderFunction = "renderFn";
      renderFn() {
        return block("<div>hello</div>");
      }
    }

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>hello</div>");
  });
});
