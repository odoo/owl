import { Component, mount, useRef, useState } from "../../src/index";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";
import { xml } from "../../src/index";

snapshotEverything();
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("refs", () => {
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
  // TODO: rename
  test.skip("t-refs on widget are components", async () => {
    class Child extends Component {
      static template = xml`<div>b</div>`;
    }
    let parent: Parent;
    class Parent extends Component {
      static template = xml`<div class="outer-div">Hello<Child t-ref="mywidgetb" /></div>`;
      static components = { Child };
      ref = useRef<Child>("mywidgetb");
      setup() {
        parent = this;
      }
    }

    const mounted = mount(Parent, fixture);
    expect(parent!.ref.comp).toBe(null);
    expect(parent!.ref.el).toBe(null);
    await mounted;
    expect(parent!.ref.comp).toBeInstanceOf(Child);
    expect(parent!.ref.el).toEqual(fixture.querySelector(".outer-div > div"));
  });

  test.skip("t-refs are bound at proper timing", async () => {
    expect.assertions(4);
    class Child extends Component {
      static template = xml`<div>widget</div>`;
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <Child t-foreach="state.list" t-as="elem" t-ref="child" t-key="elem"/>
        </div>
      `;
      static components = { Child };
      state = useState({ list: <any>[] });
      child = useRef("child");
      willPatch() {
        expect(this.child.comp).toBeNull();
      }
      patched() {
        expect(this.child.comp).not.toBeNull();
      }
    }

    const parent = await mount(Parent, fixture);
    parent.state.list.push(1);
    await nextTick();
  });

  test.skip("t-refs are bound at proper timing (2)", async () => {
    expect.assertions(10);
    class Child extends Component {
      static template = xml`<div>widget</div>`;
    }
    class Parent extends Component {
      static template = xml`
        <div>
          <Child t-if="state.child1" t-ref="child1"/>
          <Child t-if="state.child2" t-ref="child2"/>
        </div>`;
      static components = { Child };
      state = useState({ child1: true, child2: false });
      child1 = useRef("child1");
      child2 = useRef("child2");
      count = 0;
      mounted() {
        expect(this.child1.comp).toBeDefined();
        expect(this.child2.comp).toBeNull();
      }
      willPatch() {
        if (this.count === 0) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeNull();
        }
        if (this.count === 1) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeDefined();
        }
      }
      patched() {
        if (this.count === 0) {
          expect(this.child1.comp).toBeDefined();
          expect(this.child2.comp).toBeDefined();
        }
        if (this.count === 1) {
          expect(this.child1.comp).toBeNull();
          expect(this.child2.comp).toBeDefined();
        }
        this.count++;
      }
    }

    const parent = await mount(Parent, fixture);
    parent.state.child2 = true;
    await nextTick();
    parent.state.child1 = false;
    await nextTick();
  });
});
