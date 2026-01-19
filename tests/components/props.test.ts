import { Component, mount, onWillUpdateProps, props, proxy, xml } from "../../src";
import { makeTestFixture, nextTick, snapshotEverything, steps, useLogLifecycle } from "../helpers";

let fixture: HTMLElement;

snapshotEverything();

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("basics", () => {
  test("explicit object prop", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.state.someval"/></span>`;
      props = props();
      state: any;
      setup() {
        this.state = proxy({ someval: this.props.value });
      }
    }

    class Parent extends Component {
      static template = xml`<div><Child value="this.state.val"/></div>`;
      static components = { Child };
      state = proxy({ val: 42 });
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>42</span></div>");
  });

  test("prop names can contain -", async () => {
    class Child extends Component {
      static template = xml`<div><t t-out="this.props['prop-name']"/></div>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`<Child prop-name="7"/>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>7</div>");
  });

  test("accept ES6-like syntax for props (with getters)", async () => {
    class Child extends Component {
      static template = xml`<span><t t-out="this.props.greetings"/></span>`;
      props = props();
    }

    class Parent extends Component {
      static template = xml`<div><Child greetings="this.greetings"/></div>`;
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
      static template = xml`<span><t t-out="this.props.val"/></span>`;
      props = props();
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
      static template = xml`<span t-out="this.props.val"/>`;
      props = props();
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
          <t t-out="this.props.val"/>
        </span>`;
      props = props();
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
    expect(fixture.innerHTML).toBe("<div><span><p>43</p></span></div>");
  });

  test("arrow functions as prop correctly capture their scope", async () => {
    class Child extends Component {
      static template = xml`<button t-on-click="this.props.onClick"/>`;
      props = props();
    }

    let onClickArgs: [number, MouseEvent] | null = null;
    class Parent extends Component {
      static template = xml`
        <t t-foreach="this.items" t-as="item" t-key="item.val">
          <Child onClick="(ev) => this.onClick(item.val, ev)"/>
        </t>
      `;
      static components = { Child };
      items = [{ val: 1 }, { val: 2 }, { val: 3 }, { val: 4 }];
      onClick(n: number, ev: MouseEvent) {
        onClickArgs = [n, ev];
      }
    }
    await mount(Parent, fixture);
    expect(onClickArgs).toBeNull();
    (<HTMLElement>fixture.querySelector("button")).click();
    expect(onClickArgs![0]).toBe(1);
    expect(onClickArgs![1]).toBeInstanceOf(MouseEvent);
  });

  test("support prop names that aren't valid bare object property names", async () => {
    expect.assertions(3);
    class Child extends Component {
      static template = xml`<button t-on-click="this.props.onClick"/>`;
      props = props();
      setup() {
        expect(this.props["some-dashed-prop"]).toBe(5);
      }
    }

    class Parent extends Component {
      static template = xml`<Child some-dashed-prop="5"/>`;
      static components = { Child };
    }
    await mount(Parent, fixture);
  });

  test("template string in prop", async () => {
    expect.assertions(3);
    class Child extends Component {
      static template = xml``;
      props = props();
      setup() {
        expect(this.props.propName).toBe("123");
      }
    }

    class Parent extends Component {
      static template = xml({ raw: ['<Child propName="`1${this.someVal}3`"/>'] });
      static components = { Child };
      someVal = 2;
    }
    await mount(Parent, fixture);
  });
});

test("can bind function prop with bind suffix", async () => {
  class Child extends Component {
    static template = xml`child`;
    props = props();
    setup() {
      this.props.doSomething(123);
    }
  }

  let boundedThing: any = null;

  class Parent extends Component {
    static template = xml`<Child doSomething.bind="this.doSomething"/>`;
    static components = { Child };

    doSomething(val: number) {
      expect(val).toBe(123);
      boundedThing = this;
    }
  }

  const parent = await mount(Parent, fixture);
  expect(boundedThing).toBe(parent);
  expect(fixture.innerHTML).toBe("child");
});

test("do not crash when binding anonymous function prop with bind suffix", async () => {
  class Child extends Component {
    static template = xml`child`;
    props = props();
    setup() {
      this.props.doSomething(123);
    }
  }

  let boundedThing: any = null;

  class Parent extends Component {
    static template = xml`<Child doSomething.bind="(val) => this.doSomething(val)"/>`;
    static components = { Child };

    doSomething(val: number) {
      expect(val).toBe(123);
      boundedThing = this;
    }
  }

  const parent = await mount(Parent, fixture);
  expect(boundedThing).toBe(parent);
  expect(fixture.innerHTML).toBe("child");
});

test("bound functions is not referentially equal after update", async () => {
  let isEqual = false;
  class Child extends Component {
    static template = xml`<t t-out="this.props.val"/>`;
    props = props();
    setup() {
      onWillUpdateProps((nextProps: any) => {
        isEqual = nextProps.fn === this.props.fn;
      });
    }
  }

  class Parent extends Component {
    static template = xml`<Child val="this.state.val" fn.bind="this.someFunction"/>`;
    static components = { Child };
    state = proxy({ val: 1 });
    someFunction() {}
  }

  const parent = await mount(Parent, fixture);
  parent.state.val = 3;
  await nextTick();
  expect(fixture.innerHTML).toBe("3");
  expect(isEqual).toBe(false);
});

test("bound functions are considered 'alike'", async () => {
  class Child extends Component {
    static template = xml`child`;
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
      <t t-out="this.state.val"/>
      <Child fn.bind="this.someFunction"/>`;
    static components = { Child };
    state = proxy({ val: 1 });
    setup() {
      useLogLifecycle();
    }
    someFunction() {}
  }

  const parent = await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("1child");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:mounted",
      "Parent:mounted",
    ]
  `);
  parent.state.val = 3;
  await nextTick();
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Parent:patched",
    ]
  `);
  expect(fixture.innerHTML).toBe("3child");
});

test("can use .translate suffix", async () => {
  class Child extends Component {
    static template = xml`<t t-out="this.props.message"/>`;
    props = props();
  }

  class Parent extends Component {
    static template = xml`<Child message.translate="some message"/>`;
    static components = { Child };
  }

  await mount(Parent, fixture);
  expect(fixture.innerHTML).toBe("some message");
});

test(".translate props are translated", async () => {
  class Child extends Component {
    static template = xml`<t t-out="this.props.message"/>`;
    props = props();
  }

  class Parent extends Component {
    static template = xml`<Child message.translate="some message"/>`;
    static components = { Child };
  }

  await mount(Parent, fixture, { translateFn: () => "translated message" });
  expect(fixture.innerHTML).toBe("translated message");
});

test("throw if prop uses an unknown suffix", async () => {
  class Child extends Component {
    static template = xml`<t t-out="this.props.val"/>`;
    props = props();
  }

  class Parent extends Component {
    static template = xml`<Child val.somesuffix="this.state.val"/>`;
    static components = { Child };
  }

  await expect(async () => {
    await mount(Parent, fixture);
  }).rejects.toThrowError("Invalid prop suffix: somesuffix");
});

test(".alike suffix in a simple case", async () => {
  class Child extends Component {
    static template = xml`<t t-out="this.props.fn()"/>`;
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
      <t t-out="this.state.counter"/>
      <Child fn.alike="() => 1"/>`;
    static components = { Child };
    state = proxy({ counter: 0 });
    setup() {
      useLogLifecycle();
    }
  }

  const parent = await mount(Parent, fixture);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Child:setup",
      "Child:willStart",
      "Child:mounted",
      "Parent:mounted",
    ]
  `);

  expect(fixture.innerHTML).toBe("01");
  parent.state.counter++;
  await nextTick();
  expect(fixture.innerHTML).toBe("11");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:willPatch",
      "Parent:patched",
    ]
  `);
});

test(".alike suffix in a list", async () => {
  class Todo extends Component {
    static template = xml`
      <button t-on-click="this.props.toggle">
        <t t-out="this.props.todo.id"/><t t-if="this.props.todo.isChecked">V</t>
      </button>`;
    props = props();
    setup() {
      useLogLifecycle();
    }
  }

  class Parent extends Component {
    static template = xml`
      <t t-foreach="this.state.elems" t-as="elem" t-key="elem.id">
        <Todo todo="elem" toggle.alike="() => this.toggle(elem.id)"/>
      </t>`;
    static components = { Todo };
    state = proxy({
      elems: [
        { id: 1, isChecked: false },
        { id: 2, isChecked: true },
      ],
    });
    setup() {
      useLogLifecycle();
    }
    toggle(id: number) {
      const todo = this.state.elems.find((el) => el.id === id)!;
      todo.isChecked = !todo.isChecked;
    }
  }

  await mount(Parent, fixture);
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Parent:setup",
      "Parent:willStart",
      "Todo:setup",
      "Todo:willStart",
      "Todo:setup",
      "Todo:willStart",
      "Todo:mounted",
      "Todo:mounted",
      "Parent:mounted",
    ]
  `);

  expect(fixture.innerHTML).toBe("<button>1</button><button>2V</button>");
  fixture.querySelector("button")?.click();
  await nextTick();
  expect(fixture.innerHTML).toBe("<button>1V</button><button>2V</button>");
  expect(steps.splice(0)).toMatchInlineSnapshot(`
    [
      "Todo:willPatch",
      "Todo:patched",
    ]
  `);
});
