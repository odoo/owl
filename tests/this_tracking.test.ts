import { App, Component, mount, useState, xml } from "../src";
import {
  enableThisTracking,
  disableThisTracking,
  clearThisTracking,
  getThisTrackingReport,
  setTemplateTrackingAlias,
  setExprLocation,
  createTrackedCtx,
} from "../src/runtime/this_tracking";
import { makeTestFixture, nextTick } from "./helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
  enableThisTracking();
  clearThisTracking();
});

afterEach(() => {
  disableThisTracking();
  clearThisTracking();
});

// ---------------------------------------------------------------------------
// Template property access tracking
// ---------------------------------------------------------------------------

describe("this tracking - template accesses", () => {
  test("tracks component property access via prototype chain (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="value"/></div>`;
      value = 42;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // 'value' is on the component (inherited via prototype), so source = 'component'
    const access = accesses.find((a) => a.property === "value");
    expect(access).toBeDefined();
    expect(access!.source).toBe("component");
    expect(access!.expression).toBe("value");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(20);
  });

  test("tracks explicit this.property access (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="this.value"/></div>`;
      value = 99;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>99</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // ctx['this'] returns the component proxy (not recorded), then .value is recorded
    const access = accesses.find((a) => a.property === "value");
    expect(access).toBeDefined();
    expect(access!.source).toBe("component");
    expect(access!.expression).toBe("this.value");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(25);
  });

  test("tracks reactive state access (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="state.count"/></div>`;
      state = useState({ count: 5 });
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>5</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // 'state' is on the component via prototype
    const access = accesses.find((a) => a.property === "state");
    expect(access).toBeDefined();
    expect(access!.source).toBe("component");
    expect(access!.expression).toBe("state.count");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(26);
  });

  test("tracks props access (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="props.name"/></div>`;
    }

    const app = new App(MyComp, { props: { name: "world" } });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>world</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    const access = accesses.find((a) => a.property === "props");
    expect(access).toBeDefined();
    expect(access!.source).toBe("component");
    expect(access!.expression).toBe("props.name");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(25);
  });

  test("tracks component property accessed inside t-foreach (source: component)", async () => {
    // Note: t-foreach creates a new ctx layer via Object.create(ctx). Properties
    // set directly on that layer (like the loop variable 'item') are not intercepted
    // by the proxy. However, properties inherited from the component (like 'items')
    // ARE tracked because they go through the proxy via the prototype chain.
    class MyComp extends Component {
      static template = xml`
        <div>
          <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
          </t>
        </div>`;
      items = ["a", "b"];
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div><span>a</span><span>b</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // Only 'items' is tracked (component property via prototype chain).
    // Loop variables (item, item_first, etc.) are own on the loop ctx layer — not proxied.
    const access = accesses.find((a) => a.property === "items");
    expect(access).toBeDefined();
    expect(access!.source).toBe("component");
    expect(access!.expression).toBe("items");
    expect(access!.line).toBe(3);
    expect(access!.col).toBe(24);
    expect(access!.endCol).toBe(29);
  });

  test("tracks template name correctly", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="value"/>`;
      value = 1;
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    expect(accesses[0].templateName).toMatch(/__template__/);
  });

  test("two accesses to same property at different locations are separate entries", async () => {
    class MyComp extends Component {
      static template = xml`
        <div>
          <span t-esc="val"/>
          <span t-esc="this.val"/>
        </div>`;
      val = 10;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div><span>10</span><span>10</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // Both accesses to 'val' are at different lines, so they are separate entries
    const valAccesses = accesses.filter((a) => a.property === "val");
    expect(valAccesses.length).toBe(2);
    // First access: ctx['val'] → inherited from component → source: 'component'
    expect(valAccesses[0].source).toBe("component");
    expect(valAccesses[0].expression).toBe("val");
    expect(valAccesses[0].line).toBe(3);
    expect(valAccesses[0].col).toBe(23);
    expect(valAccesses[0].endCol).toBe(26);
    // Second access: ctx['this'].val → component proxy → source: 'component'
    expect(valAccesses[1].source).toBe("component");
    expect(valAccesses[1].expression).toBe("this.val");
    expect(valAccesses[1].line).toBe(4);
    expect(valAccesses[1].col).toBe(23);
    expect(valAccesses[1].endCol).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// Getter tracking
// ---------------------------------------------------------------------------

describe("this tracking - getter accesses", () => {
  test("tracks property accesses inside a getter (via ctx)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="fullName"/></div>`;
      firstName = "John";
      lastName = "Doe";

      get fullName() {
        return this.firstName + " " + this.lastName;
      }
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>John Doe</div>");

    const report = getThisTrackingReport();

    // The getter 'fullName' was accessed at template level
    const accesses = Object.values(report.accesses);
    const access = accesses.find((a) => a.property === "fullName");
    expect(access).toBeDefined();
    expect(access!.expression).toBe("fullName");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(23);

    // Inside the getter, firstName and lastName were accessed
    const gas = Object.values(report.getterAccesses);
    expect(gas.length).toBe(2);
    const gaFirst = gas.find((g) => g.property === "firstName");
    const gaLast = gas.find((g) => g.property === "lastName");
    expect(gaFirst).toBeDefined();
    expect(gaFirst!.getterName).toBe("fullName");
    expect(gaFirst!.source).toBe("ctx");
    expect(gaLast).toBeDefined();
    expect(gaLast!.getterName).toBe("fullName");
    expect(gaLast!.source).toBe("ctx");
  });

  test("tracks getter accessed via explicit this (thisResolvedTo: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="this.fullName"/></div>`;
      firstName = "Jane";
      lastName = "Smith";

      get fullName() {
        return this.firstName + " " + this.lastName;
      }
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>Jane Smith</div>");

    const report = getThisTrackingReport();

    // The getter 'fullName' was accessed at template level
    const accesses = Object.values(report.accesses);
    const access = accesses.find((a) => a.property === "fullName");
    expect(access).toBeDefined();
    expect(access!.expression).toBe("this.fullName");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(28);

    // Inside the getter, this resolved to the component (accessed via this.fullName)
    const gas = Object.values(report.getterAccesses);
    expect(gas.length).toBe(2);
    const gaFirst = gas.find((g) => g.property === "firstName");
    const gaLast = gas.find((g) => g.property === "lastName");
    expect(gaFirst).toBeDefined();
    expect(gaFirst!.getterName).toBe("fullName");
    expect(gaFirst!.source).toBe("component");
    expect(gaLast).toBeDefined();
    expect(gaLast!.getterName).toBe("fullName");
    expect(gaLast!.source).toBe("component");
  });

  test("getter accessing reactive state", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="doubled"/></div>`;
      state = useState({ count: 7 });

      get doubled() {
        return this.state.count * 2;
      }
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>14</div>");

    const report = getThisTrackingReport();

    // The getter 'doubled' was accessed at template level
    const accesses = Object.values(report.accesses);
    const access = accesses.find((a) => a.property === "doubled");
    expect(access).toBeDefined();
    expect(access!.expression).toBe("doubled");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(15);
    expect(access!.endCol).toBe(22);

    const gas = Object.values(report.getterAccesses);
    expect(gas.length).toBe(1);
    expect(gas[0].property).toBe("state");
    expect(gas[0].getterName).toBe("doubled");
    expect(gas[0].source).toBe("ctx");
  });
});

// ---------------------------------------------------------------------------
// Enable / disable / clear
// ---------------------------------------------------------------------------

describe("this tracking - lifecycle", () => {
  test("no tracking when disabled", async () => {
    disableThisTracking();

    class MyComp extends Component {
      static template = xml`<div t-esc="value"/>`;
      value = 1;
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    expect(Object.keys(report.accesses).length).toBe(0);
    expect(Object.keys(report.getterAccesses).length).toBe(0);
  });

  test("clearThisTracking resets accumulated data", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="value"/>`;
      value = 1;
    }

    await mount(MyComp, fixture);
    let report = getThisTrackingReport();
    expect(Object.keys(report.accesses).length).toBe(1);

    clearThisTracking();
    report = getThisTrackingReport();
    expect(Object.keys(report.accesses).length).toBe(0);
  });

  test("can enable tracking after initial render, tracks re-render", async () => {
    disableThisTracking();

    class MyComp extends Component {
      static template = xml`<div t-esc="state.count"/>`;
      state = useState({ count: 0 });
    }

    // Note: tracking must be enabled BEFORE the component is created
    // so the proxy is set up on ctx. Enable tracking before mount.
    enableThisTracking();
    const comp = await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>0</div>");

    clearThisTracking();

    // Trigger re-render (ctx proxy is already in place from mount)
    comp.state.count = 5;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>5</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const access = accesses.find((a) => a.property === "state");
    expect(access).toBeDefined();
    expect(access!.expression).toBe("state.count");
    expect(access!.line).toBe(1);
    expect(access!.col).toBe(12);
    expect(access!.endCol).toBe(23);
  });
});

// ---------------------------------------------------------------------------
// t-if conditional tracking
// ---------------------------------------------------------------------------

describe("this tracking - conditionals", () => {
  test("tracks accesses in t-if conditions and branches", async () => {
    class MyComp extends Component {
      static template = xml`
        <div>
          <t t-if="showA">
            <span t-esc="a"/>
          </t>
          <t t-else="">
            <span t-esc="b"/>
          </t>
        </div>`;
      showA = true;
      a = "A";
      b = "B";
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div><span>A</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // 'showA' and 'a' should be tracked; 'b' should not since branch was not taken
    const showA = accesses.find((a) => a.property === "showA");
    expect(showA).toBeDefined();
    expect(showA!.expression).toBe("showA");
    expect(showA!.line).toBe(3);
    expect(showA!.col).toBe(19);
    expect(showA!.endCol).toBe(24);
    const a = accesses.find((a) => a.property === "a");
    expect(a).toBeDefined();
    expect(a!.expression).toBe("a");
    expect(a!.line).toBe(4);
    expect(a!.col).toBe(25);
    expect(a!.endCol).toBe(26);
  });
});

// ---------------------------------------------------------------------------
// Multiple components
// ---------------------------------------------------------------------------

describe("this tracking - multiple components", () => {
  test("tracks accesses in parent and child components separately", async () => {
    class Child extends Component {
      static template = xml`<span t-esc="props.msg"/>`;
    }

    class Parent extends Component {
      static template = xml`<div><Child msg="message"/></div>`;
      static components = { Child };
      message = "hello";
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const templateNames = new Set(accesses.map((a) => a.templateName));

    // Should have two templates tracked (parent + child)
    expect(templateNames.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// t-call tracking
// ---------------------------------------------------------------------------

describe("this tracking - t-call", () => {
  test("static t-call: accesses in called template attributed to correct template name", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-call="sub"/></div>`;
      value = "hello";
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="sub"><span t-esc="value"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");

    const report = getThisTrackingReport();

    // The "sub" template should have its own report
    const subAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "sub"
    );
    expect(subAccesses.length).toBe(1);
    expect(subAccesses[0].property).toBe("value");
    expect(subAccesses[0].source).toBe("component");
    // outerHTML: <t t-name="sub"><span t-esc="value"/></t>
    expect(subAccesses[0].line).toBe(1);
    expect(subAccesses[0].col).toBe(29);
    expect(subAccesses[0].endCol).toBe(34);
  });

  test("dynamic t-call: accesses attributed to called template", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-call="{{subName}}"/></div>`;
      subName = "dynamic_sub";
      greeting = "world";
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="dynamic_sub"><span t-esc="greeting"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>world</span></div>");

    const report = getThisTrackingReport();

    const subAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "dynamic_sub"
    );
    expect(subAccesses.length).toBe(1);
    expect(subAccesses[0].property).toBe("greeting");
    // outerHTML: <t t-name="dynamic_sub"><span t-esc="greeting"/></t>
    expect(subAccesses[0].line).toBe(1);
    expect(subAccesses[0].col).toBe(37);
    expect(subAccesses[0].endCol).toBe(45);
  });

  test("t-call with body: body content tracked under called template", async () => {
    class MyComp extends Component {
      static template = xml`
        <div>
          <t t-call="wrapper">
            <span t-esc="innerValue"/>
          </t>
        </div>`;
      innerValue = "inside";
      outerValue = "outside";
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="wrapper">
            <div class="wrap"><t t-esc="outerValue"/><t t-out="0"/></div>
          </t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div><div class="wrap">outside<span>inside</span></div></div>'
    );

    const report = getThisTrackingReport();

    // 'outerValue' accessed inside "wrapper" template
    const wrapperAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "wrapper"
    );
    expect(wrapperAccesses.length).toBe(1);
    expect(wrapperAccesses[0].property).toBe("outerValue");
    // outerHTML is multiline: <t t-name="wrapper">\n            <div class="wrap">...
    expect(wrapperAccesses[0].line).toBe(2);
    expect(wrapperAccesses[0].col).toBe(40);
    expect(wrapperAccesses[0].endCol).toBe(50);
  });

  test("nested t-call: each level attributed to its own template", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-call="level1"/></div>`;
      a = "A";
      b = "B";
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="level1"><span t-esc="a"/><t t-call="level2"/></t>
          <t t-name="level2"><span t-esc="b"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>A</span><span>B</span></div>");

    const report = getThisTrackingReport();

    // 'a' accessed in level1
    const l1Accesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "level1"
    );
    expect(l1Accesses.length).toBe(1);
    expect(l1Accesses[0].property).toBe("a");
    // outerHTML: <t t-name="level1"><span t-esc="a"/>...
    expect(l1Accesses[0].line).toBe(1);
    expect(l1Accesses[0].col).toBe(32);
    expect(l1Accesses[0].endCol).toBe(33);

    // 'b' accessed in level2
    const l2Accesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "level2"
    );
    expect(l2Accesses.length).toBe(1);
    expect(l2Accesses[0].property).toBe("b");
    // outerHTML: <t t-name="level2"><span t-esc="b"/></t>
    expect(l2Accesses[0].line).toBe(1);
    expect(l2Accesses[0].col).toBe(32);
    expect(l2Accesses[0].endCol).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// t-slot tracking
// ---------------------------------------------------------------------------

describe("this tracking - t-slot", () => {
  test("slot content attributed to parent template (where slot was defined)", async () => {
    class Child extends Component {
      static template = xml`<div><t t-slot="default"/></div>`;
    }

    const parentTpl = xml`
      <Child>
        <span t-esc="parentValue"/>
      </Child>`;

    class Parent extends Component {
      static template = parentTpl;
      static components = { Child };
      parentValue = "from parent";
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>from parent</span></div>");

    const report = getThisTrackingReport();

    // parentValue should be attributed to the parent's template.
    // The slot proxy fires through the parent's tracked proxy. Due to aggregation,
    // duplicate accesses at the same location are merged into one entry.
    const parentAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === parentTpl
    );
    const pvAccess = parentAccesses.find((a) => a.property === "parentValue");
    expect(pvAccess).toBeDefined();
    expect(pvAccess!.line).toBe(3);
    expect(pvAccess!.col).toBe(21);
    expect(pvAccess!.endCol).toBe(32);
  });

  test("slot default content attributed to child template", async () => {
    class Child extends Component {
      static template = xml`<div><t t-slot="default"><span t-esc="props.fallback"/></t></div>`;
    }

    class Parent extends Component {
      static template = xml`<Child fallback="'default text'"/>`;
      static components = { Child };
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><span>default text</span></div>");

    const report = getThisTrackingReport();
    // The default content runs within the child's template
    const childAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === Child.template
    );
    expect(childAccesses.length).toBeGreaterThan(0);
  });

  test("named slot content attributed to parent template", async () => {
    class Child extends Component {
      static template = xml`<div><t t-slot="header"/><t t-slot="footer"/></div>`;
    }

    const parentTpl = xml`
      <Child>
        <t t-set-slot="header"><h1 t-esc="title"/></t>
        <t t-set-slot="footer"><p t-esc="footerText"/></t>
      </Child>`;

    class Parent extends Component {
      static template = parentTpl;
      static components = { Child };
      title = "Header";
      footerText = "Footer";
    }

    await mount(Parent, fixture);
    expect(fixture.innerHTML).toBe("<div><h1>Header</h1><p>Footer</p></div>");

    const report = getThisTrackingReport();
    const parentAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === parentTpl
    );

    // capture(ctx) accesses have no line/col → excluded from the new report.
    // Only the actual slot rendering accesses with line/col are included.
    const titleAccess = parentAccesses.find((a) => a.property === "title");
    expect(titleAccess).toBeDefined();
    expect(titleAccess!.line).toBe(3);
    expect(titleAccess!.col).toBe(42);
    expect(titleAccess!.endCol).toBe(47);
    const footerAccess = parentAccesses.find((a) => a.property === "footerText");
    expect(footerAccess).toBeDefined();
    expect(footerAccess!.line).toBe(4);
    expect(footerAccess!.col).toBe(41);
    expect(footerAccess!.endCol).toBe(51);
  });
});

// ---------------------------------------------------------------------------
// t-name templates
// ---------------------------------------------------------------------------

describe("this tracking - t-name templates", () => {
  test("named templates registered via addTemplates are tracked", async () => {
    class MyComp extends Component {
      static template = "my-component";
      value = 42;
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="my-component"><div t-esc="value"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "my-component"
    );
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("value");
    // outerHTML: <t t-name="my-component"><div t-esc="value"/></t>
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(37);
    expect(accesses[0].endCol).toBe(42);
  });

  test("named template called via t-call has correct template name", async () => {
    class MyComp extends Component {
      static template = "main";
      mainVal = "main-value";
      subVal = "sub-value";
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="main"><div t-esc="mainVal"/><t t-call="helper"/></t>
          <t t-name="helper"><span t-esc="subVal"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>main-value</div><span>sub-value</span>");

    const report = getThisTrackingReport();

    // mainVal should be in "main"
    const mainAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "main"
    );
    expect(mainAccesses.length).toBe(1);
    expect(mainAccesses[0].property).toBe("mainVal");
    // outerHTML: <t t-name="main"><div t-esc="mainVal"/>...
    expect(mainAccesses[0].line).toBe(1);
    expect(mainAccesses[0].col).toBe(29);
    expect(mainAccesses[0].endCol).toBe(36);

    // subVal should be in "helper"
    const helperAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "helper"
    );
    expect(helperAccesses.length).toBe(1);
    expect(helperAccesses[0].property).toBe("subVal");
    // outerHTML: <t t-name="helper"><span t-esc="subVal"/></t>
    expect(helperAccesses[0].line).toBe(1);
    expect(helperAccesses[0].col).toBe(32);
    expect(helperAccesses[0].endCol).toBe(38);
  });

  test("getter tracking works with named templates", async () => {
    class MyComp extends Component {
      static template = "getter-test";
      firstName = "John";
      lastName = "Doe";

      get fullName() {
        return this.firstName + " " + this.lastName;
      }
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="getter-test"><div t-esc="fullName"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>John Doe</div>");

    const report = getThisTrackingReport();

    const accesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "getter-test"
    );
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("fullName");
    // outerHTML: <t t-name="getter-test"><div t-esc="fullName"/></t>
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(36);
    expect(accesses[0].endCol).toBe(44);

    // Getter internal accesses
    const gas = Object.values(report.getterAccesses);
    expect(gas.length).toBe(2);
    const gaFirst = gas.find((g) => g.property === "firstName");
    const gaLast = gas.find((g) => g.property === "lastName");
    expect(gaFirst).toBeDefined();
    expect(gaFirst!.getterName).toBe("fullName");
    expect(gaLast).toBeDefined();
    expect(gaLast!.getterName).toBe("fullName");
  });

  test("templates from Record config are tracked with correct names", async () => {
    class MyComp extends Component {
      static template = "record-template";
      msg = "hello";
    }

    const app = new App(MyComp, {
      templates: {
        "record-template": `<div t-esc="msg"/>`,
      },
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>hello</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "record-template"
    );
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("msg");
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(12);
    expect(accesses[0].endCol).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Expression line and char range tracking
// ---------------------------------------------------------------------------

describe("this tracking - expression locations", () => {
  test("reports line and col for t-esc expression", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="value"/>`;
      value = 42;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    // For template `<div t-esc="value"/>`:
    //   line 1, "value" starts at col 12 (after `<div t-esc="`), ends at 17
    expect(accesses[0].property).toBe("value");
    expect(accesses[0].expression).toBe("value");
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(12);
    expect(accesses[0].endCol).toBe(17);
  });

  test("reports line and col for multiline template", async () => {
    const tpl = xml`<div>
  <span t-esc="name"/>
</div>`;

    class MyComp extends Component {
      static template = tpl;
      name = "hello";
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("name");
    expect(accesses[0].expression).toBe("name");
    // Line 2 (1-based): `  <span t-esc="name"/>`
    expect(accesses[0].line).toBe(2);
    expect(accesses[0].col).toBe(15);
    expect(accesses[0].endCol).toBe(19);
  });

  test("reports full original expression for dotted access", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="state.count"/>`;
      state = { count: 5 };
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>5</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    // Full original expression is preserved
    expect(accesses[0].property).toBe("state");
    expect(accesses[0].expression).toBe("state.count");
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(12);
    expect(accesses[0].endCol).toBe(23);
  });

  test("reports full original expression for this.prop access", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="this.value"/>`;
      value = 99;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>99</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("value");
    expect(accesses[0].expression).toBe("this.value");
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(12);
    expect(accesses[0].endCol).toBe(22);
  });

  test("reports line/col for t-if condition", async () => {
    const tpl = xml`<div>
  <span t-if="showIt" t-esc="msg"/>
</div>`;

    class MyComp extends Component {
      static template = tpl;
      showIt = true;
      msg = "yes";
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    expect(accesses.length).toBe(2);
    const showIt = accesses.find((a) => a.property === "showIt");
    expect(showIt).toBeDefined();
    expect(showIt!.expression).toBe("showIt");
    expect(showIt!.line).toBe(2);
    expect(showIt!.col).toBe(14);
    expect(showIt!.endCol).toBe(20);
    const msg = accesses.find((a) => a.property === "msg");
    expect(msg).toBeDefined();
    expect(msg!.expression).toBe("msg");
    expect(msg!.line).toBe(2);
    expect(msg!.col).toBe(29);
    expect(msg!.endCol).toBe(32);
  });

  test("reports line/col for t-foreach collection", async () => {
    const tpl = xml`<div>
  <t t-foreach="items" t-as="item" t-key="item">
    <span t-esc="item"/>
  </t>
</div>`;

    class MyComp extends Component {
      static template = tpl;
      items = ["a", "b"];
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    // Only the collection 'items' goes through the proxy
    const access = accesses.find((a) => a.property === "items");
    expect(access).toBeDefined();
    expect(access!.expression).toBe("items");
    expect(access!.line).toBe(2);
    expect(access!.col).toBe(16);
    expect(access!.endCol).toBe(21);
  });

  test("reports line/col for named template expressions", async () => {
    class MyComp extends Component {
      static template = "loc-test";
      value = 42;
    }

    const app = new App(MyComp, {
      templates: {
        "loc-test": `<div t-esc="value"/>`,
      },
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "loc-test"
    );
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("value");
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(12);
    expect(accesses[0].endCol).toBe(17);
  });

  test("reports different locations for multiple expressions", async () => {
    const tpl = xml`<div>
  <span t-esc="first"/>
  <span t-esc="second"/>
</div>`;

    class MyComp extends Component {
      static template = tpl;
      first = "a";
      second = "b";
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);

    expect(accesses.length).toBe(2);
    const first = accesses.find((a) => a.property === "first");
    expect(first).toBeDefined();
    expect(first!.line).toBe(2);
    expect(first!.col).toBe(15);
    expect(first!.endCol).toBe(20);
    const second = accesses.find((a) => a.property === "second");
    expect(second).toBeDefined();
    expect(second!.line).toBe(3);
    expect(second!.col).toBe(15);
    expect(second!.endCol).toBe(21);
  });

  test("reports line/col for t-att dynamic attribute", async () => {
    class MyComp extends Component {
      static template = xml`<div t-att-class="cls"/>`;
      cls = "active";
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe('<div class="active"></div>');

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    expect(accesses[0].property).toBe("cls");
    expect(accesses[0].expression).toBe("cls");
    expect(accesses[0].line).toBe(1);
    expect(accesses[0].col).toBe(18);
    expect(accesses[0].endCol).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// Source file tracking via t-source-file
// ---------------------------------------------------------------------------

describe("this tracking - source file", () => {
  test("t-source-file attribute sets file in report", async () => {
    class MyComp extends Component {
      static template = xml`<div t-source-file="/web/static/src/views/button.xml"><t t-esc="value"/></div>`;
      value = 42;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const access = accesses.find((a) => a.property === "value");
    expect(access).toBeDefined();
    expect(access!.filename).toBe("/web/static/src/views/button.xml");
  });

  test("different elements can have different t-source-file values", async () => {
    class MyComp extends Component {
      static template = xml`
        <div>
          <span t-source-file="/web/base.xml" t-esc="first"/>
          <span t-source-file="/account/extension.xml" t-esc="second"/>
        </div>`;
      first = 1;
      second = 2;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span><span>2</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const firstAccess = accesses.find((a) => a.property === "first");
    expect(firstAccess).toBeDefined();
    expect(firstAccess!.filename).toBe("/web/base.xml");
    const secondAccess = accesses.find((a) => a.property === "second");
    expect(secondAccess).toBeDefined();
    expect(secondAccess!.filename).toBe("/account/extension.xml");
  });

  test("nested t-source-file overrides parent", async () => {
    class MyComp extends Component {
      static template = xml`
        <div t-source-file="/web/base.xml">
          <t t-esc="outer"/>
          <span t-source-file="/account/override.xml" t-esc="inner"/>
        </div>`;
      outer = "a";
      inner = "b";
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>a<span>b</span></div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const outerAccess = accesses.find((a) => a.property === "outer");
    expect(outerAccess).toBeDefined();
    expect(outerAccess!.filename).toBe("/web/base.xml");
    const innerAccess = accesses.find((a) => a.property === "inner");
    expect(innerAccess).toBeDefined();
    expect(innerAccess!.filename).toBe("/account/override.xml");
  });

  test("accesses without t-source-file have empty filename", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="value"/></div>`;
      value = 1;
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    expect(accesses.length).toBe(1);
    expect(accesses[0].filename).toBe("");
  });

  test("setTemplateTrackingAlias causes report to use alias instead of raw template key", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="value"/></div>`;
      value = 42;
    }

    // Simulate what the transpiler would do: set ___filename on the class
    (MyComp as any).___filename = "@web/views/button";

    // Register alias for the auto-generated template name
    setTemplateTrackingAlias(MyComp.template, `@web/views/button:MyComp`);

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>42</div>");

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    // The report should use the alias as the template name
    const access = accesses.find((a) => a.property === "value");
    expect(access).toBeDefined();
    expect(access!.templateName).toBe("@web/views/button:MyComp");
    // The raw template key should NOT appear in any entry
    const rawAccesses = accesses.filter(
      (a) => a.templateName === MyComp.template
    );
    expect(rawAccesses.length).toBe(0);
  });

  test("t-source-file works with t-call", async () => {
    class MyComp extends Component {
      static template = "main";
      val = "hello";
    }

    const app = new App(MyComp, {
      templates: `
        <templates>
          <t t-name="main"><div t-source-file="/web/main.xml"><t t-call="sub"/></div></t>
          <t t-name="sub"><span t-esc="val"/></t>
        </templates>`,
    });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");

    const report = getThisTrackingReport();
    // The t-call renders sub template; val is accessed in "sub" context
    const subAccesses = Object.values(report.accesses).filter(
      (a) => a.templateName === "sub"
    );
    expect(subAccesses.length).toBe(1);
    expect(subAccesses[0].property).toBe("val");
  });
});

// ---------------------------------------------------------------------------
// Aggregated "both" source detection
// ---------------------------------------------------------------------------

describe("this tracking - source aggregation", () => {
  test("same key with different sources produces 'both'", () => {
    // Directly exercise the aggregation: access the same property at the same
    // location once as "component" and once as "ctx", then verify the report
    // merges them into "both".
    const component = { foo: "bar" } as any;
    const ctx = Object.create(component);
    const trackedCtx = createTrackedCtx(ctx, component, "test-tmpl");

    // First access: foo is inherited from component → "component"
    setExprLocation("foo", 1, 0, 3);
    void trackedCtx.foo;

    // Make foo own on the ctx target
    ctx.foo = "baz";

    // Second access at SAME location: foo is now own → "ctx"
    setExprLocation("foo", 1, 0, 3);
    void trackedCtx.foo;

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const fooAccess = accesses.find((a) => a.property === "foo");
    expect(fooAccess).toBeDefined();
    expect(fooAccess!.source).toBe("both");
  });

  test("same property at different locations → separate entries", () => {
    const component = { foo: "bar" } as any;
    const ctx = Object.create(component);
    const trackedCtx = createTrackedCtx(ctx, component, "test-tmpl");

    // Access foo at line 1 → "component"
    setExprLocation("foo", 1, 0, 3);
    void trackedCtx.foo;

    // Make foo own on ctx
    ctx.foo = "baz";

    // Access foo at line 2 (different location) → "ctx"
    setExprLocation("foo", 2, 0, 3);
    void trackedCtx.foo;

    const report = getThisTrackingReport();
    const accesses = Object.values(report.accesses);
    const fooAccesses = accesses.filter((a) => a.property === "foo");

    // Two different locations → two separate entries
    expect(fooAccesses.length).toBe(2);
    expect(fooAccesses[0].source).toBe("component");
    expect(fooAccesses[0].line).toBe(1);
    expect(fooAccesses[1].source).toBe("ctx");
    expect(fooAccesses[1].line).toBe(2);
  });
});
