import { Component, mount, useRef, useState } from "../../src/index";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import { xml } from "../../src/index";

snapshotEverything();
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("refs", () => {
  test("basic use", async () => {
    class Test extends Component {
      static template = xml`<div t-ref="div"/>`;
      button = useRef("div");
    }
    const test = await mount(Test, fixture);
    expect(test.button.el).toBe(fixture.firstChild);
  });

  test("refs are properly bound in slots", async () => {
    class Dialog extends Component {
      static template = xml`<span><t t-slot="footer"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
            <div>
              <span class="counter"><t t-esc="state.val"/></span>
              <Dialog>
                <t t-set-slot="footer"><button t-ref="myButton" t-on-click="doSomething">do something</button></t>
              </Dialog>
            </div>
          `;
      static components = { Dialog };
      state = useState({ val: 0 });
      button = useRef("myButton");
      doSomething() {
        this.state.val++;
      }
    }
    const parent = await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">0</span><span><button>do something</button></span></div>'
    );

    parent.button.el!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe(
      '<div><span class="counter">1</span><span><button>do something</button></span></div>'
    );
  });
});
