import { App, Component, mount, useState } from "../../src";
import { xml } from "../../src/tags";
import { makeTestFixture, nextTick, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("basic use", async () => {
    class Child extends Component {
      static template = xml`<span>child<t t-esc="props.p"/></span>`;
    }

    class Parent extends Component {
      static template = xml`<Child p="1"/>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>child1</span>");
  });

  test("sub widget is interactive", async () => {
    class Child extends Component {
      static template = xml`
            <span>
                <button t-on-click="inc">click</button>child<t t-esc="state.val"/>
            </span>`;
      state = useState({ val: 1 });
      inc() {
        this.state.val++;
      }
    }
    class Parent extends Component {
      static template = xml`<Child p="1"/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span><button>click</button>child1</span>");
    const button = fixture.querySelector("button")!;
    button.click();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span><button>click</button>child2</span>");
  });

  test("can select a sub widget ", async () => {
    class Child extends Component {
      static template = xml`<span>CHILD 1</span>`;
    }
    class OtherChild extends Component {
      static template = xml`<div>CHILD 2</div>`;
    }
    class Parent extends Component {
      static template = xml`
            <t>
              <t t-if="env.options.flag"><Child /></t>
              <t t-if="!env.options.flag"><OtherChild /></t>
            </t>
          `;
      static components = { Child, OtherChild };
    }
    const env = { options: { flag: true } };
    const parent = await new App(Parent).configure({ env }).mount(fixture);
    expect(fixture.innerHTML).toBe("<span>CHILD 1</span>");

    env.options.flag = false;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>CHILD 2</div>");
  });

  test("can select a sub widget, part 2", async () => {
    class Child extends Component {
      static template = xml`<span>CHILD 1</span>`;
    }
    class OtherChild extends Component {
      static template = xml`<div>CHILD 2</div>`;
    }
    class Parent extends Component {
      static template = xml`
            <t>
              <t t-if="state.flag"><Child /></t>
              <t t-if="!state.flag"><OtherChild /></t>
            </t>
          `;
      state = useState({ flag: true });
      static components = { Child, OtherChild };
    }
    let parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span>CHILD 1</span>");
    parent.state.flag = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>CHILD 2</div>");
  });

  test("top level sub widget with a parent", async () => {
    class ComponentC extends Component {
      static template = xml`<span>Hello</span>`;
    }
    class ComponentB extends Component {
      static template = xml`<ComponentC />`;
      static components = { ComponentC };
    }
    class ComponentA extends Component {
      static template = xml`<div><ComponentB/></div>`;
      static components = { ComponentB };
    }

    await mount(ComponentA, fixture);

    expect(fixture.innerHTML).toBe("<div><span>Hello</span></div>");
  });
});
