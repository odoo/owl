import { Component, mount } from "../../src/core";
import { xml } from "../../src/tags";
import { fromName, makeTestFixture, snapshotTemplateCode } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("style and class handling", () => {
  test("can set style and class on component", async () => {
    class Test extends Component {
      static template = xml`
          <div style="font-weight:bold;" class="some-class">world</div>
        `;
    }
    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe(`<div style="font-weight:bold;" class="some-class">world</div>`);
    snapshotTemplateCode(fromName(Test.template));
  });
});
