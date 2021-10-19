import { Component, mount, xml } from "../../src";
import { makeTestFixture, snapshotEverything } from "../helpers";

snapshotEverything();

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

// -----------------------------------------------------------------------------
// t-set
// -----------------------------------------------------------------------------

describe("t-set", () => {
  test("t-set outside modified in t-if", async () => {
    class Comp extends Component {
      static template = xml`
        <div>
          <t t-set="iter" t-value="0"/>
          <t t-set="flag" t-value="state.flag" />
          <t t-if="flag === 'if'">
            <t t-set="iter" t-value="2"/>
          </t>
          <t t-elif="flag === 'elif'">
            <t t-set="iter" t-value="3"/>
          </t>
          <t t-else="">
            <t t-set="iter" t-value="4"/>
          </t>
          <p><t t-esc="iter"/></p>
        </div>`;
      state = { flag: "if" };
    }
    const comp = await mount(Comp, fixture);

    expect(fixture.innerHTML).toBe("<div><p>2</p></div>");
    comp.state.flag = "elif";
    await comp.render();
    expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
    comp.state.flag = "false";
    await comp.render();
    expect(fixture.innerHTML).toBe("<div><p>4</p></div>");
  });

  test("t-set in t-if", async () => {
    // Weird that code block within 'if' leaks outside of it
    // Python does the same
    class Comp extends Component {
      static template = xml`
        <div>
          <t t-set="flag" t-value="state.flag" />
          <t t-if="flag === 'if'">
            <t t-set="iter" t-value="2"/>
          </t>
          <t t-elif="flag === 'elif'">
            <t t-set="iter" t-value="3"/>
          </t>
          <t t-else="">
            <t t-set="iter" t-value="4"/>
          </t>
          <p><t t-esc="iter"/></p>
        </div>`;
      state = { flag: "if" };
    }
    const comp = await mount(Comp, fixture);

    expect(fixture.innerHTML).toBe("<div><p>2</p></div>");
    comp.state.flag = "elif";
    await comp.render();
    expect(fixture.innerHTML).toBe("<div><p>3</p></div>");
    comp.state.flag = "false";
    await comp.render();
    expect(fixture.innerHTML).toBe("<div><p>4</p></div>");
  });

  test("t-set can't alter component even if key in component", async () => {
    class Comp extends Component {
      static template = xml`
        <div>
          <p><t t-esc="iter"/></p>
          <t t-set="iter" t-value="5"/>
          <p><t t-esc="iter"/></p>
        </div>`;
      iter = 1;
    }
    const comp = await mount(Comp, fixture);

    expect(fixture.innerHTML).toBe("<div><p>1</p><p>5</p></div>");
    expect(comp.iter).toBe(1);
  });

  test("t-set can't alter component if key not in component", async () => {
    class Comp extends Component {
      static template = xml`
        <div>
          <p><t t-esc="iter"/></p>
          <t t-set="iter" t-value="5"/>
          <p><t t-esc="iter"/></p>
        </div>`;
    }
    const comp = await mount(Comp, fixture);

    expect(fixture.innerHTML).toBe("<div><p></p><p>5</p></div>");
    expect((comp as any).iter).toBeUndefined();
  });

  test("slot setted value (with t-set) not accessible with t-esc", async () => {
    class Childcomp extends Component {
      static template = xml`<div><t t-esc="iter"/><t t-set="iter" t-value="'called'"/><t t-esc="iter"/></div>`;
    }
    class Comp extends Component {
      static components = { Childcomp };
      static template = xml`
        <div>
          <t t-set="iter" t-value="'source'"/>
          <p><t t-esc="iter"/></p>
          <Childcomp>
            <t t-set="iter" t-value="'inCall'"/>
          </Childcomp>
          <p><t t-esc="iter"/></p>
        </div>`;
    }
    await mount(Comp, fixture);

    expect(fixture.innerHTML).toBe("<div><p>source</p><div>called</div><p>source</p></div>");
  });

  test("t-set not altered by child comp", async () => {
    let child;
    class Childcomp extends Component {
      static template = xml`<div><t t-esc="iter"/><t t-set="iter" t-value="'called'"/><t t-esc="iter"/></div>`;
      iter = "child";
      setup() {
        super.setup();
        child = this;
      }
    }
    class Comp extends Component {
      static components = { Childcomp };
      static template = xml`
        <div>
          <t t-set="iter" t-value="'source'"/>
          <p><t t-esc="iter"/></p>
          <Childcomp/>
          <p><t t-esc="iter"/></p>
        </div>`;
    }
    await mount(Comp, fixture);

    expect(fixture.innerHTML).toBe("<div><p>source</p><div>childcalled</div><p>source</p></div>");
    expect((child as any).iter).toBe("child");
  });
});
