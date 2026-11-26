import {
  Component,
  mount,
  onMounted,
  onWillDestroy,
  onWillStart,
  onWillUnmount,
  proxy,
  signal,
  t,
  useProps,
  xml,
} from "../../src";
import { makeDeferred, makeTestFixture, nextTick } from "../helpers";

// -----------------------------------------------------------------------------
// render once: templates are instantiated once, render effects update the dom
// -----------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("render once", () => {
  test("an update changes the existing dom", async () => {
    class Root extends Component {
      static template = xml`<div class="root"><span t-out="this.count()"/></div>`;
      count = signal(0);
    }
    const root = await mount(Root, fixture);
    const div = fixture.firstElementChild!;
    const span = div.firstElementChild!;

    root.count.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe('<div class="root"><span>1</span></div>');
    expect(fixture.firstElementChild).toBe(div);
    expect(div.firstElementChild).toBe(span);
  });

  test("updates are applied in the next microtask", async () => {
    class Root extends Component {
      static template = xml`<span t-out="this.count()"/>`;
      count = signal(0);
    }
    const root = await mount(Root, fixture);
    root.count.set(1);
    expect(fixture.innerHTML).toBe("<span>0</span>");
    await Promise.resolve();
    expect(fixture.innerHTML).toBe("<span>1</span>");
  });

  test("a change only re-runs the blocks that read it", async () => {
    let aReads = 0;
    let bReads = 0;
    class Root extends Component {
      static template = xml`<p t-att-title="this.readA()"/><p t-att-title="this.readB()"/>`;
      a = signal("a");
      b = signal("b");
      readA() {
        aReads++;
        return this.a();
      }
      readB() {
        bReads++;
        return this.b();
      }
    }
    const root = await mount(Root, fixture);
    expect([aReads, bReads]).toEqual([1, 1]);

    root.a.set("A");
    await nextTick();
    expect(fixture.innerHTML).toBe('<p title="A"></p><p title="b"></p>');
    expect([aReads, bReads]).toEqual([2, 1]);
  });

  test("a prop change updates the child in place", async () => {
    const steps: string[] = [];
    class Child extends Component {
      static template = xml`<span t-out="this.props.value"/>`;
      props = useProps({ value: t.number() });
      setup() {
        steps.push("setup");
        onMounted(() => steps.push("mounted"));
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child value="this.value()"/></div>`;
      static components = { Child };
      value = signal(1);
    }
    const parent = await mount(Parent, fixture);
    const span = fixture.querySelector("span");

    parent.value.set(2);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>2</span></div>");
    expect(fixture.querySelector("span")).toBe(span);
    expect(steps).toEqual(["setup", "mounted"]);
  });

  test("a t-if runs before what it contains", async () => {
    // the span reads `user().name`: if it updated before the t-if discards it,
    // it would read the name of null
    class Root extends Component {
      static template = xml`<t t-if="this.user() and this.visible()"><span t-out="this.user().name"/></t>`;
      user = signal<{ name: string } | null>({ name: "Alice" });
      visible = signal(1);
    }
    const root = await mount(Root, fixture);
    expect(fixture.innerHTML).toBe("<span>Alice</span>");

    // the t-if re-runs and keeps its branch: it now subscribes to `user` after
    // the span, so the order in which they are notified no longer helps
    root.visible.set(2);
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Alice</span>");

    root.user.set(null);
    await nextTick();
    expect(fixture.innerHTML).toBe("");

    root.user.set({ name: "Bob" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<span>Bob</span>");
  });

  test("toggling a t-if creates and destroys the component", async () => {
    const steps: string[] = [];
    let id = 0;
    class Child extends Component {
      static template = xml`<b>child</b>`;
      id = ++id;
      setup() {
        steps.push(`setup ${this.id}`);
        onMounted(() => steps.push(`mounted ${this.id}`));
        onWillUnmount(() => steps.push(`willUnmount ${this.id}`));
        onWillDestroy(() => steps.push(`willDestroy ${this.id}`));
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="this.show()"/></div>`;
      static components = { Child };
      show = signal(true);
    }
    const parent = await mount(Parent, fixture);
    expect(steps.splice(0)).toEqual(["setup 1", "mounted 1"]);

    parent.show.set(false);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps.splice(0)).toEqual(["willUnmount 1", "willDestroy 1"]);

    parent.show.set(true);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><b>child</b></div>");
    expect(steps.splice(0)).toEqual(["setup 2", "mounted 2"]);
  });

  test("a keyed t-foreach moves the existing rows", async () => {
    class Root extends Component {
      static template = xml`
        <ul>
          <t t-foreach="this.items" t-as="item" t-key="item.id">
            <li t-out="item.text"/>
          </t>
        </ul>`;
      items = proxy([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
      ]);
    }
    const root = await mount(Root, fixture);
    const [a, b, c] = fixture.querySelectorAll("li");

    root.items.reverse();
    await nextTick();
    expect(fixture.innerHTML).toBe("<ul><li>c</li><li>b</li><li>a</li></ul>");
    let lis = fixture.querySelectorAll("li");
    expect(lis[0]).toBe(c);
    expect(lis[1]).toBe(b);
    expect(lis[2]).toBe(a);

    root.items.splice(1, 1);
    await nextTick();
    lis = fixture.querySelectorAll("li");
    expect(lis.length).toBe(2);
    expect(lis[0]).toBe(c);
    expect(lis[1]).toBe(a);

    root.items[0].text = "C";
    await nextTick();
    expect(fixture.innerHTML).toBe("<ul><li>C</li><li>a</li></ul>");
    expect(fixture.querySelector("li")).toBe(c);
  });

  test("a kept row reads the new item of its key", async () => {
    class Root extends Component {
      static template = xml`
        <ul>
          <t t-foreach="this.items()" t-as="item" t-key="item.id">
            <li t-out="item.text + item_index"/>
          </t>
        </ul>`;
      items = signal([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
      ]);
    }
    const root = await mount(Root, fixture);
    const [first, second] = fixture.querySelectorAll("li");

    root.items.set([
      { id: 2, text: "B" },
      { id: 1, text: "A" },
    ]);
    await nextTick();
    expect(fixture.innerHTML).toBe("<ul><li>B0</li><li>A1</li></ul>");
    const lis = fixture.querySelectorAll("li");
    expect(lis[0]).toBe(second);
    expect(lis[1]).toBe(first);
  });

  test("a write made while a region creates its content is not lost", async () => {
    // the child is created by the t-if's render effect, and its setup writes
    // the signal that effect just read
    class Child extends Component {
      static template = xml`child`;
      props = useProps({ onReady: t.function() });
      setup() {
        this.props.onReady();
      }
    }
    class Parent extends Component {
      static template = xml`
        <t t-if="!this.ready()"><Child onReady="() => this.ready.set(true)"/></t>
        <t t-else="">ready</t>`;
      static components = { Child };
      ready = signal(false);
    }
    await mount(Parent, fixture);
    await nextTick();
    expect(fixture.innerHTML).toBe("ready");
  });
});

describe("onWillStart", () => {
  test("the initial mount waits for the whole tree", async () => {
    const def = makeDeferred();
    class Child extends Component {
      static template = xml`<b>child</b>`;
      setup() {
        onWillStart(() => def);
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child/></div>`;
      static components = { Child };
    }
    const promise = mount(Parent, fixture);
    await nextTick();
    expect(fixture.innerHTML).toBe("");

    def.resolve();
    await promise;
    expect(fixture.innerHTML).toBe("<div><b>child</b></div>");
  });

  test("a later component shows a placeholder until it resolves", async () => {
    const steps: string[] = [];
    const def = makeDeferred();
    class Child extends Component {
      static template = xml`<b>child</b>`;
      setup() {
        onWillStart(() => def);
        onMounted(() => steps.push("child mounted"));
      }
    }
    class Parent extends Component {
      static template = xml`<div>a<Child t-if="this.show()"/>b</div>`;
      static components = { Child };
      show = signal(false);
    }
    const parent = await mount(Parent, fixture);
    parent.show.set(true);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>ab</div>");
    expect(steps).toEqual([]);

    def.resolve();
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>a<b>child</b>b</div>");
    expect(steps).toEqual(["child mounted"]);
  });

  test("a component destroyed while waiting does not block the initial mount", async () => {
    class Child extends Component {
      static template = xml`<b>child</b>`;
      setup() {
        onWillStart(() => makeDeferred());
      }
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="this.show()"/></div>`;
      static components = { Child };
      show = signal(true);
      setup() {
        parent = this;
      }
    }
    let parent: Parent;
    const promise = mount(Parent, fixture);
    await nextTick();
    parent!.show.set(false);
    await promise;
    expect(fixture.innerHTML).toBe("<div></div>");
  });
});
