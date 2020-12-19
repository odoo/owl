import { BText } from "../../src/bdom";
import { Component, mount, xml } from "../../src/index";
import { fromName, makeTestFixture, snapshotTemplateCode } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-call-block", () => {
  test("simple t-call-block with static text", async () => {
    class Test extends Component {
      static template = xml`<div><t t-call-block="myBlock()"/></div>`;
      myBlock() {
        return new BText("hello");
      }
    }

    snapshotTemplateCode(fromName(Test.template));

    await mount(Test, { target: fixture });
    expect(fixture.innerHTML).toBe("<div>hello</div>");
  });
});
