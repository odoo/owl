import { snapshotEverything, makeTestFixture, nextTick, elem } from "../helpers";
import { Component, mount, props, xml } from "../../src/index";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("t-key", () => {
  test("t-key on Component", async () => {
    let childInstance = null;
    class Child extends Component {
      static template = xml`<div t-esc="this.props.key"></div>`;
      props = props();

      setup() {
        childInstance = this;
      }
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<Child t-key="key" key="key" />`;

      key = 1;
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>1</div>");

    const oldChild = childInstance;
    parent.key = 2;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>2</div>");
    expect(oldChild === childInstance).toBeFalsy();
  });

  test("t-key on Component as a function", async () => {
    let childInstance = null;
    class Child extends Component {
      static template = xml`<div t-esc="this.props.key"></div>`;
      props = props();

      setup() {
        childInstance = this;
      }
    }

    let keyCalls = 0;
    let __key = 1;
    class Parent extends Component {
      static components = { Child };
      static template = xml`<span><Child t-key="key" key="key" /></span>`;

      get key() {
        keyCalls++;
        return __key;
      }
    }

    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<span><div>1</div></span>");
    expect(keyCalls).toBe(2); // one for t-key, the other for the props

    const oldChild = childInstance;
    __key = 2;
    parent.render();
    await nextTick();
    expect(fixture.innerHTML).toBe("<span><div>2</div></span>");
    expect(oldChild === childInstance).toBeFalsy();
    expect(keyCalls).toBe(4);
  });

  test("t-key on multiple Components", async () => {
    const childInstances = [];
    class Child extends Component {
      static template = xml`<div t-esc="this.props.key"></div>`;
      props = props();

      setup() {
        childInstances.push(this);
      }
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<span>
        <Child t-key="key1" key="key1" />
        <Child t-key="key2" key="key2" />
      </span>`;

      key1 = 1;
      key2 = 2;
    }

    const parent = await mount(Parent, fixture);
    expect(elem(parent).innerHTML).toBe("<div>1</div><div>2</div>");

    parent.key1 = 2;
    parent.key2 = 1;
    parent.render();
    await nextTick();
    expect(elem(parent).innerHTML).toBe("<div>2</div><div>1</div>");
    expect(childInstances.length).toBe(4);
  });

  test("t-key on multiple Components with t-call 1", async () => {
    const childInstances = [];
    class Child extends Component {
      static template = xml`<div t-esc="this.props.key"></div>`;
      props = props();

      setup() {
        childInstances.push(this);
      }
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<span>
        <t t-call="calledTemplate"><t t-set="key" t-value="key1" /></t>
        <t t-call="calledTemplate"><t t-set="key" t-value="key2" /></t>
      </span>`;

      key1 = 1;
      key2 = 2;
    }

    const parent = await mount(Parent, fixture, {
      templates: `
        <templates>
          <t t-name="calledTemplate">
            <Child t-key="key" key="key" />
          </t>
        </templates>`,
    });
    expect(elem(parent).innerHTML).toBe("<div>1</div><div>2</div>");

    parent.key1 = 2;
    parent.key2 = 1;
    parent.render();
    await nextTick();
    expect(elem(parent).innerHTML).toBe("<div>2</div><div>1</div>");
    expect(childInstances.length).toBe(4);
  });

  test("t-key on multiple Components with t-call 2", async () => {
    const childInstances = [];
    class Child extends Component {
      static template = xml`<div t-esc="this.props.key"></div>`;
      props = props();

      setup() {
        childInstances.push(this);
      }
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<span>
        <t t-call="calledTemplate" />
      </span>`;

      key1 = 1;
      key2 = 2;
    }

    const parent = await mount(Parent, fixture, {
      templates: `
        <templates>
          <t t-name="calledTemplate">
          <Child t-key="key1" key="key1" /><Child t-key="key2" key="key2" />
          </t>
        </templates>`,
    });
    expect(elem(parent).innerHTML).toBe("<div>1</div><div>2</div>");

    parent.key1 = 2;
    parent.key2 = 1;
    parent.render();
    await nextTick();
    expect(elem(parent).innerHTML).toBe("<div>2</div><div>1</div>");
    expect(childInstances.length).toBe(4);
  });

  test("t-foreach with t-key switch component position", async () => {
    const childInstances = [];
    class Child extends Component {
      static template = xml`<div t-esc="this.props.key"></div>`;
      props = props();
      setup() {
        childInstances.push(this);
      }
    }

    class Parent extends Component {
      static components = { Child };
      static template = xml`<span>
        <t t-foreach="clist" t-as="c" t-key="c">
          <Child key="c + key1" t-key="key1"/>
        </t>
      </span>`;

      key1 = "key1";
      clist = [1, 2];
    }

    const parent = await mount(Parent, fixture);
    expect(elem(parent).innerHTML).toBe("<div>1key1</div><div>2key1</div>");
    parent.clist = [2, 1];
    parent.render();
    await nextTick();
    expect(elem(parent).innerHTML).toBe("<div>2key1</div><div>1key1</div>");
    expect(childInstances.length).toBe(2);
    childInstances.length = 0;

    parent.clist = [1, 2];
    parent.key1 = "key2";
    parent.render();
    await nextTick();
    expect(elem(parent).innerHTML).toBe("<div>1key2</div><div>2key2</div>");
    expect(childInstances.length).toBe(2);
  });
});
