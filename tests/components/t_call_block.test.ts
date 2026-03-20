import { text } from "../../src/runtime/blockdom";
import { Component, mount, xml } from "../../src/index";
import { makeTestFixture, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-call-block", () => {
  test("simple t-call-block with static text", async () => {
    class Test extends Component {
      static template = xml`<div><t t-call-block="this.myBlock()"/></div>`;
      myBlock() {
        return text("hello");
      }
    }

    await mount(Test, fixture);
    expect(fixture.innerHTML).toBe("<div>hello</div>");
  });
});
