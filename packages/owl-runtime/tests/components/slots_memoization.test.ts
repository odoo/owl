import { compile } from "@odoo/owl-compiler";
import { Component, mount, props, proxy, signal, xml } from "../../src";
import { makeTestFixture, nextTick, render, snapshotEverything } from "../helpers";

// Slot memoization: a component receiving slots is no longer re-rendered on
// every parent render. The compiler emits synthetic "\x01slots.*" props
// comparing what the slot content captures (enclosing template variables,
// slot params, forwarded slots), and falls back to always re-rendering
// (opaque slots) when the captures cannot be statically enumerated.

snapshotEverything();
let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

function compiledCode(template: string): string {
  return compile(template).toString();
}

describe("slot memoization: behavior", () => {
  test("child with static slot content is not re-rendered by parent renders", async () => {
    let childRenders = 0;
    class Child extends Component {
      static template = xml`<span><t t-out="this.track()"/><t t-call-slot="default"/></span>`;
      track() {
        childRenders++;
        return "";
      }
    }

    class Parent extends Component {
      static template = xml`<div><t t-out="this.tick()"/><Child>some text</Child></div>`;
      static components = { Child };
      tick = signal(0);
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>0<span>some text</span></div>");
    expect(childRenders).toBe(1);

    parent.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span>some text</span></div>");
    expect(childRenders).toBe(1);
  });

  test("siblings in a list are not re-rendered when one item is replaced", async () => {
    const renders: string[] = [];
    class Card extends Component {
      static template = xml`<div><t t-out="this.track()"/><t t-call-slot="default"/></div>`;
      props = props();
      track() {
        renders.push(this.props.id);
        return "";
      }
    }

    class Parent extends Component {
      static template = xml`
        <t t-foreach="this.items" t-as="item" t-key="item.id">
          <Card id="item.id"><t t-out="item.name"/></Card>
        </t>`;
      static components = { Card };
      items = proxy([
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ]);
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>A</div><div>B</div><div>C</div>");
    expect(renders.splice(0)).toEqual(["a", "b", "c"]);

    parent.items[1] = { id: "b", name: "B2" };
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>A</div><div>B2</div><div>C</div>");
    // only the card whose item identity changed re-rendered
    expect(renders.splice(0)).toEqual(["b"]);
  });

  test("child re-renders when a captured t-set value changes", async () => {
    let childRenders = 0;
    class Child extends Component {
      static template = xml`<span><t t-out="this.track()"/><t t-call-slot="default"/></span>`;
      track() {
        childRenders++;
        return "";
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-set="label" t-value="this.label()"/>
          <t t-out="this.tick()"/>
          <Child><t t-out="label"/></Child>
        </div>`;
      static components = { Child };
      tick = signal(0);
      label = signal("hello");
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>0<span>hello</span></div>");
    expect(childRenders).toBe(1);

    // unrelated parent render: capture is equal, child is skipped
    parent.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span>hello</span></div>");
    expect(childRenders).toBe(1);

    // captured value changes: child re-renders
    parent.label.set("world");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span>world</span></div>");
    expect(childRenders).toBe(2);
  });

  test("slot params are compared by value", async () => {
    let childRenders = 0;
    class Dialog extends Component {
      static template = xml`<div><t t-out="this.track()"/><t t-out="this.props.slots.header.param"/><t t-call-slot="header"/></div>`;
      props = props();
      track() {
        childRenders++;
        return "";
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-out="this.tick()"/>
          <Dialog><t t-set-slot="header" param="this.param()">content</t></Dialog>
        </div>`;
      static components = { Dialog };
      tick = signal(0);
      param = signal("p1");
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>0<div>p1content</div></div>");
    expect(childRenders).toBe(1);

    parent.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<div>p1content</div></div>");
    expect(childRenders).toBe(1);

    parent.param.set("p2");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<div>p2content</div></div>");
    expect(childRenders).toBe(2);
  });

  test("bound slot params keep memoization when the method is stable", async () => {
    let childRenders = 0;
    class Child extends Component {
      static template = xml`<span><t t-out="this.track()"/><t t-out="this.props.slots.default.cb()"/></span>`;
      props = props();
      track() {
        childRenders++;
        return "";
      }
    }

    class Parent extends Component {
      static template = xml`
        <div>
          <t t-out="this.tick()"/>
          <Child><t t-set-slot="default" cb.bind="this.getValue">x</t></Child>
        </div>`;
      static components = { Child };
      tick = signal(0);
      getValue() {
        return "v";
      }
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>0<span>v</span></div>");
    expect(childRenders).toBe(1);

    // the .bind wrapper is new on each render, but the underlying method is
    // stable: the child must not re-render
    parent.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span>v</span></div>");
    expect(childRenders).toBe(1);
  });

  test("forwarded slots are captured by identity through a wrapper", async () => {
    let leafRenders = 0;
    class Leaf extends Component {
      static template = xml`<p><t t-out="this.track()"/><t t-call-slot="default"/></p>`;
      props = props();
      track() {
        leafRenders++;
        return "";
      }
    }

    class Middle extends Component {
      static template = xml`<div><t t-out="this.tick()"/><Leaf><t t-call-slot="default"/></Leaf></div>`;
      static components = { Leaf };
      props = props();
      tick = signal(0);
    }

    class GrandParent extends Component {
      static template = xml`
        <t t-set="msg" t-value="this.msg()"/>
        <Middle><t t-out="msg"/></Middle>`;
      static components = { Middle };
      msg = signal("m1");
    }
    const gp = await mount(GrandParent, fixture);
    const middle = Object.values(gp.__owl__.children)[0].component as Middle;
    expect(fixture.innerHTML).toBe("<div>0<p>m1</p></div>");
    expect(leafRenders).toBe(1);

    // the wrapper re-renders on its own: its incoming slots are unchanged, so
    // the leaf is skipped
    middle.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<p>m1</p></div>");
    expect(leafRenders).toBe(1);

    // the grand-parent's slot content changes: the new slots object reaches
    // the wrapper, whose forward synthetic invalidates the leaf
    gp.msg.set("m2");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<p>m2</p></div>");
    expect(leafRenders).toBe(2);
  });

  test("t-call inside slot content disables memoization", async () => {
    const sub = xml`<span>sub</span>`;
    let childRenders = 0;
    class Child extends Component {
      static template = xml`<div><t t-out="this.track()"/><t t-call-slot="default"/></div>`;
      track() {
        childRenders++;
        return "";
      }
    }

    class Parent extends Component {
      static template = xml`<div><t t-out="this.tick()"/><Child><t t-call="${sub}"/></Child></div>`;
      static components = { Child };
      tick = signal(0);
    }
    const parent = await mount(Parent, fixture);
    expect(childRenders).toBe(1);

    parent.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<div><span>sub</span></div></div>");
    expect(childRenders).toBe(2);
  });

  test("non-reactive slot reads do not refresh on unrelated parent renders", async () => {
    // This pins the semantic change that slot memoization introduces: slot
    // content reading non-reactive values is no longer refreshed as a side
    // effect of unrelated parent renders. Render reads reactive state.
    class Child extends Component {
      static template = xml`<span><t t-call-slot="default"/></span>`;
    }

    class Parent extends Component {
      static template = xml`<div><t t-out="this.tick()"/><Child><t t-out="this.plain"/></Child></div>`;
      static components = { Child };
      tick = signal(0);
      plain = "old";
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div>0<span>old</span></div>");

    parent.plain = "new";
    parent.tick.set(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1<span>old</span></div>");
  });

  test("deep renders bypass slot memoization", async () => {
    class Child extends Component {
      static template = xml`<span><t t-call-slot="default"/></span>`;
    }

    class Parent extends Component {
      static template = xml`<div><Child><t t-out="this.plain"/></Child></div>`;
      static components = { Child };
      plain = "old";
    }
    const parent = await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>old</span></div>");

    parent.plain = "new";
    render(parent, true);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>new</span></div>");
  });
});

describe("slot memoization: compiled output", () => {
  test("loop variables read by slot content (incl. handlers) become captures", () => {
    const code = compiledCode(`
      <t t-foreach="this.items" t-as="item" t-key="item.id">
        <Card><button t-on-click="() => this.open(item)">open</button></Card>
      </t>`);
    expect(code).toContain(`"\x01slots.item": ctx['item']`);
    // analyzable slots: the opaque-slots flag is false
    expect(code).toContain("createComponent(app, `Card`, true, false, false,");
  });

  test("a t-set before the call site keeps the slot memoizable", () => {
    const code = compiledCode(`
      <t t-set="label" t-value="this.label"/>
      <Child><t t-out="label"/></Child>`);
    expect(code).toContain(`"\x01slots.label": ctx['label']`);
    expect(code).toContain("createComponent(app, `Child`, true, false, false,");
  });

  test("a t-set after the call site makes the slot opaque", () => {
    const code = compiledCode(`
      <Child><t t-out="label"/></Child>
      <t t-set="label" t-value="this.label"/>`);
    expect(code).toContain("createComponent(app, `Child`, true, true, false,");
  });

  test("a t-set reassignment in a loop makes the slot opaque", () => {
    const code = compiledCode(`
      <t t-set="acc" t-value="0"/>
      <t t-foreach="this.items" t-as="x" t-key="x">
        <t t-set="acc" t-value="acc + x"/>
        <Child><t t-out="acc"/></Child>
      </t>`);
    expect(code).toContain("createComponent(app, `Child`, true, true, false,");
  });

  test("t-out='0' inside slot content makes the slot opaque", () => {
    const code = compiledCode(`<Child><t t-out="0"/></Child>`);
    expect(code).toContain("createComponent(app, `Child`, true, true, false,");
  });

  test("a dynamic t-call-slot inside slot content makes the slot opaque", () => {
    const code = compiledCode(`<Child><t t-call-slot="{{this.name}}"/></Child>`);
    expect(code).toContain("createComponent(app, `Child`, true, true, false,");
  });

  test("a static t-call-slot inside slot content is captured as a forward", () => {
    const code = compiledCode(`<Child><t t-call-slot="default"/></Child>`);
    expect(code).toContain(`"\x01slots.__fwd.default": ctx.__owl__.props.slots?.['default']`);
    expect(code).toContain("createComponent(app, `Child`, true, false, false,");
  });

  test("the slot-scope variable of the slot itself is not a capture", () => {
    const code = compiledCode(`
      <Child><t t-set-slot="default" t-slot-scope="data"><t t-out="data.x"/></t></Child>`);
    expect(code).not.toContain(`"\x01slots.data"`);
    expect(code).toContain("createComponent(app, `Child`, true, false, false,");
  });
});
