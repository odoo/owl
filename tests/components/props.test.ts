import { Component, mount, useState } from "../../src";
import { xml } from "../../src/tags";
import { makeTestFixture, snapshotEverything } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("explicit object prop", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="state.someval"/></span>`;
      state: any;
      setup() {
        this.state = useState({ someval: this.props.value });
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child value="state.val"/></div>`;
      static components = { Child };
      state = useState({ val: 42 });
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("accept ES6-like syntax for props (with getters)", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.greetings"/></span>`;
    }

    class Parent extends Component {
      static template = xml`<div><Child greetings="greetings"/></div>`;
      static components = { Child };
      get greetings() {
        const name = "aaron";
        return `hello ${name}`;
      }
    }
    await mount(Parent, fixture);

    expect(fixture.innerHTML).toBe("<div><span>hello aaron</span></div>");
  });

  test("t-set works ", async () => {
    class Child extends Component {
      static template = xml`<span><t t-esc="props.val"/></span>`;
    }

    class Parent extends Component {
      static template = xml`
            <div>
                <t t-set="val" t-value="42"/>
                <Child val="val"/>
            </div>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("t-set with a body expression can be used as textual prop", async () => {
    class Child extends Component {
      static template = xml`<span t-esc="props.val"/>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          <t t-set="abc">42</t>
          <Child val="abc"/>
        </div>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("t-set with a body expression can be passed in props, and then t-out", async () => {
    class Child extends Component {
      static template = xml`
        <span>
          <t t-esc="props.val"/>
          <t t-out="props.val"/>
        </span>`;
    }
    class Parent extends Component {
      static components = { Child };
      static template = xml`
        <div>
          <t t-set="abc"><p>43</p></t>
          <Child val="abc"/>
        </div>`;
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>&lt;p&gt;43&lt;/p&gt;<p>43</p></span></div>");
  });
});
