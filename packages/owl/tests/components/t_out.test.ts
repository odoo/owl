import { Component, mount, xml } from "../../src/index";
import { makeTestFixture, snapshotEverything } from "../helpers";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-out
// -----------------------------------------------------------------------------

describe("components in t-out", () => {
  let fixture: HTMLElement;

  beforeEach(() => {
    fixture = makeTestFixture();
  });

  test("simple list", async () => {
    class Child extends Component {
      static template = xml`child`;
    }

    class Parent extends Component {
      static template = xml`
                <t t-foreach="[1,2]" t-as="n" t-key="n">
                  <t t-set="blabla">
                    <Child />
                  </t>
                  <t t-out="blabla"/>
                </t>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("childchild");
  });
});
