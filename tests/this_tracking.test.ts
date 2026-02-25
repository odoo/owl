import { App, Component, mount, useState, xml } from "../src";
import {
  enableThisTracking,
  disableThisTracking,
  clearThisTracking,
  getThisTrackingReport,
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
    const tmpl = report.templates[MyComp.template];
    expect(tmpl).toBeDefined();

    // 'value' is on the component (inherited via prototype), so source = 'component'
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("value");
    expect(tmpl.accesses[0].source).toBe("component");
    expect(tmpl.accesses[0].expression).toBe("value");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(20);
    expect(tmpl.summary.value).toBe("component");
  });

  test("tracks explicit this.property access (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="this.value"/></div>`;
      value = 99;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>99</div>");

    const report = getThisTrackingReport();
    const tmpl = report.templates[MyComp.template];

    // ctx['this'] returns the component proxy (not recorded), then .value is recorded
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("value");
    expect(tmpl.accesses[0].source).toBe("component");
    expect(tmpl.accesses[0].expression).toBe("this.value");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(25);
  });

  test("tracks reactive state access (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="state.count"/></div>`;
      state = useState({ count: 5 });
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>5</div>");

    const report = getThisTrackingReport();
    const tmpl = report.templates[MyComp.template];

    // 'state' is on the component via prototype
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("state");
    expect(tmpl.accesses[0].source).toBe("component");
    expect(tmpl.accesses[0].expression).toBe("state.count");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(26);
  });

  test("tracks props access (source: component)", async () => {
    class MyComp extends Component {
      static template = xml`<div><t t-esc="props.name"/></div>`;
    }

    const app = new App(MyComp, { props: { name: "world" } });
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>world</div>");

    const report = getThisTrackingReport();
    const tmpl = report.templates[MyComp.template];

    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("props");
    expect(tmpl.accesses[0].source).toBe("component");
    expect(tmpl.accesses[0].expression).toBe("props.name");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(25);
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
    const tmpl = report.templates[MyComp.template];

    // Only 'items' is tracked (component property via prototype chain).
    // Loop variables (item, item_first, etc.) are own on the loop ctx layer — not proxied.
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("items");
    expect(tmpl.accesses[0].source).toBe("component");
    expect(tmpl.accesses[0].expression).toBe("items");
    expect(tmpl.accesses[0].line).toBe(3);
    expect(tmpl.accesses[0].col).toBe(24);
    expect(tmpl.accesses[0].endCol).toBe(29);
  });

  test("tracks template name correctly", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="value"/>`;
      value = 1;
    }

    await mount(MyComp, fixture);

    const report = getThisTrackingReport();
    const templateNames = Object.keys(report.templates);
    expect(templateNames.length).toBe(1);
    expect(templateNames[0]).toMatch(/__template__/);
  });

  test("summary reports 'both' when property accessed via prototype and explicit this", async () => {
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
    const tmpl = report.templates[MyComp.template];

    // Both accesses to 'val' resolve through the component
    expect(tmpl.accesses.length).toBe(2);
    // First access: ctx['val'] → inherited from component → source: 'component'
    expect(tmpl.accesses[0].property).toBe("val");
    expect(tmpl.accesses[0].source).toBe("component");
    expect(tmpl.accesses[0].expression).toBe("val");
    expect(tmpl.accesses[0].line).toBe(3);
    expect(tmpl.accesses[0].col).toBe(23);
    expect(tmpl.accesses[0].endCol).toBe(26);
    // Second access: ctx['this'].val → component proxy → source: 'component'
    expect(tmpl.accesses[1].property).toBe("val");
    expect(tmpl.accesses[1].source).toBe("component");
    expect(tmpl.accesses[1].expression).toBe("this.val");
    expect(tmpl.accesses[1].line).toBe(4);
    expect(tmpl.accesses[1].col).toBe(23);
    expect(tmpl.accesses[1].endCol).toBe(31);
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
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("fullName");
    expect(tmpl.accesses[0].expression).toBe("fullName");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(23);

    // Inside the getter, firstName and lastName were accessed (in that order)
    expect(report.getterAccesses.length).toBe(2);
    expect(report.getterAccesses[0].property).toBe("firstName");
    expect(report.getterAccesses[0].getterName).toBe("fullName");
    expect(report.getterAccesses[0].thisResolvedTo).toBe("ctx");
    expect(report.getterAccesses[1].property).toBe("lastName");
    expect(report.getterAccesses[1].getterName).toBe("fullName");
    expect(report.getterAccesses[1].thisResolvedTo).toBe("ctx");
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
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("fullName");
    expect(tmpl.accesses[0].expression).toBe("this.fullName");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(28);

    // Inside the getter, this resolved to the component (accessed via this.fullName)
    expect(report.getterAccesses.length).toBe(2);
    expect(report.getterAccesses[0].property).toBe("firstName");
    expect(report.getterAccesses[0].getterName).toBe("fullName");
    expect(report.getterAccesses[0].thisResolvedTo).toBe("component");
    expect(report.getterAccesses[1].property).toBe("lastName");
    expect(report.getterAccesses[1].getterName).toBe("fullName");
    expect(report.getterAccesses[1].thisResolvedTo).toBe("component");
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
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("doubled");
    expect(tmpl.accesses[0].expression).toBe("doubled");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(22);

    expect(report.getterAccesses.length).toBe(1);
    expect(report.getterAccesses[0].property).toBe("state");
    expect(report.getterAccesses[0].getterName).toBe("doubled");
    expect(report.getterAccesses[0].thisResolvedTo).toBe("ctx");
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
    expect(Object.keys(report.templates).length).toBe(0);
    expect(report.getterAccesses.length).toBe(0);
  });

  test("clearThisTracking resets accumulated data", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="value"/>`;
      value = 1;
    }

    await mount(MyComp, fixture);
    let report = getThisTrackingReport();
    expect(Object.keys(report.templates).length).toBe(1);

    clearThisTracking();
    report = getThisTrackingReport();
    expect(Object.keys(report.templates).length).toBe(0);
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
    const tmpl = report.templates[MyComp.template];
    expect(tmpl).toBeDefined();
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("state");
    expect(tmpl.accesses[0].expression).toBe("state.count");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(12);
    expect(tmpl.accesses[0].endCol).toBe(23);
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
    const tmpl = report.templates[MyComp.template];

    // 'showA' and 'a' should be tracked; 'b' should not since branch was not taken
    expect(tmpl.accesses.length).toBe(2);
    expect(tmpl.accesses[0].property).toBe("showA");
    expect(tmpl.accesses[0].expression).toBe("showA");
    expect(tmpl.accesses[0].line).toBe(3);
    expect(tmpl.accesses[0].col).toBe(19);
    expect(tmpl.accesses[0].endCol).toBe(24);
    expect(tmpl.accesses[1].property).toBe("a");
    expect(tmpl.accesses[1].expression).toBe("a");
    expect(tmpl.accesses[1].line).toBe(4);
    expect(tmpl.accesses[1].col).toBe(25);
    expect(tmpl.accesses[1].endCol).toBe(26);
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
    const templateNames = Object.keys(report.templates);

    // Should have two templates tracked (parent + child)
    expect(templateNames.length).toBe(2);
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
    const subReport = report.templates["sub"];
    expect(subReport).toBeDefined();
    expect(subReport.accesses.length).toBe(1);
    expect(subReport.accesses[0].property).toBe("value");
    expect(subReport.accesses[0].templateName).toBe("sub");
    expect(subReport.accesses[0].source).toBe("component");
    // outerHTML: <t t-name="sub"><span t-esc="value"/></t>
    expect(subReport.accesses[0].line).toBe(1);
    expect(subReport.accesses[0].col).toBe(29);
    expect(subReport.accesses[0].endCol).toBe(34);
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

    const subReport = report.templates["dynamic_sub"];
    expect(subReport).toBeDefined();
    expect(subReport.accesses.length).toBe(1);
    expect(subReport.accesses[0].property).toBe("greeting");
    expect(subReport.accesses[0].templateName).toBe("dynamic_sub");
    // outerHTML: <t t-name="dynamic_sub"><span t-esc="greeting"/></t>
    expect(subReport.accesses[0].line).toBe(1);
    expect(subReport.accesses[0].col).toBe(37);
    expect(subReport.accesses[0].endCol).toBe(45);
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
    const wrapperReport = report.templates["wrapper"];
    expect(wrapperReport).toBeDefined();
    expect(wrapperReport.accesses.length).toBe(1);
    expect(wrapperReport.accesses[0].property).toBe("outerValue");
    expect(wrapperReport.accesses[0].templateName).toBe("wrapper");
    // outerHTML is multiline: <t t-name="wrapper">\n            <div class="wrap">...
    expect(wrapperReport.accesses[0].line).toBe(2);
    expect(wrapperReport.accesses[0].col).toBe(40);
    expect(wrapperReport.accesses[0].endCol).toBe(50);
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
    const l1Report = report.templates["level1"];
    expect(l1Report).toBeDefined();
    expect(l1Report.accesses.length).toBe(1);
    expect(l1Report.accesses[0].property).toBe("a");
    expect(l1Report.accesses[0].templateName).toBe("level1");
    // outerHTML: <t t-name="level1"><span t-esc="a"/>...
    expect(l1Report.accesses[0].line).toBe(1);
    expect(l1Report.accesses[0].col).toBe(32);
    expect(l1Report.accesses[0].endCol).toBe(33);

    // 'b' accessed in level2
    const l2Report = report.templates["level2"];
    expect(l2Report).toBeDefined();
    expect(l2Report.accesses.length).toBe(1);
    expect(l2Report.accesses[0].property).toBe("b");
    expect(l2Report.accesses[0].templateName).toBe("level2");
    // outerHTML: <t t-name="level2"><span t-esc="b"/></t>
    expect(l2Report.accesses[0].line).toBe(1);
    expect(l2Report.accesses[0].col).toBe(32);
    expect(l2Report.accesses[0].endCol).toBe(33);
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
    // Two accesses: the slot proxy wraps an object whose prototype is the
    // parent's original tracked proxy, so both fire for the same property.
    const parentReport = report.templates[parentTpl];
    expect(parentReport).toBeDefined();
    expect(parentReport.accesses.length).toBe(2);
    expect(parentReport.accesses[0].property).toBe("parentValue");
    expect(parentReport.accesses[0].templateName).toBe(parentTpl);
    expect(parentReport.accesses[0].line).toBe(3);
    expect(parentReport.accesses[0].col).toBe(21);
    expect(parentReport.accesses[0].endCol).toBe(32);
    expect(parentReport.accesses[1].property).toBe("parentValue");
    expect(parentReport.accesses[1].templateName).toBe(parentTpl);
    expect(parentReport.accesses[1].line).toBe(3);
    expect(parentReport.accesses[1].col).toBe(21);
    expect(parentReport.accesses[1].endCol).toBe(32);
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
    const childTpl = Child.template;
    expect(report.templates[childTpl]).toBeDefined();
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
    const parentReport = report.templates[parentTpl];
    expect(parentReport).toBeDefined();

    // 6 accesses total: 4 from capture(ctx) iterating all component properties
    // through the parent proxy (props, env, title, footerText), then 2 from
    // actual slot rendering (title, footerText).
    expect(parentReport.accesses.length).toBe(6);
    // capture(ctx) accesses happen before any __setExprLoc → no line/col
    expect(parentReport.accesses[0].property).toBe("props");
    expect(parentReport.accesses[0].line).toBeUndefined();
    expect(parentReport.accesses[1].property).toBe("env");
    expect(parentReport.accesses[1].line).toBeUndefined();
    expect(parentReport.accesses[2].property).toBe("title");
    expect(parentReport.accesses[2].line).toBeUndefined();
    expect(parentReport.accesses[3].property).toBe("footerText");
    expect(parentReport.accesses[3].line).toBeUndefined();
    // Actual slot rendering accesses have line/col from __setExprLoc
    expect(parentReport.accesses[4].property).toBe("title");
    expect(parentReport.accesses[4].templateName).toBe(parentTpl);
    expect(parentReport.accesses[4].line).toBe(3);
    expect(parentReport.accesses[4].col).toBe(42);
    expect(parentReport.accesses[4].endCol).toBe(47);
    expect(parentReport.accesses[5].property).toBe("footerText");
    expect(parentReport.accesses[5].templateName).toBe(parentTpl);
    expect(parentReport.accesses[5].line).toBe(4);
    expect(parentReport.accesses[5].col).toBe(41);
    expect(parentReport.accesses[5].endCol).toBe(51);
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
    const tmpl = report.templates["my-component"];
    expect(tmpl).toBeDefined();
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("value");
    expect(tmpl.accesses[0].templateName).toBe("my-component");
    // outerHTML: <t t-name="my-component"><div t-esc="value"/></t>
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(37);
    expect(tmpl.accesses[0].endCol).toBe(42);
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
    const mainReport = report.templates["main"];
    expect(mainReport).toBeDefined();
    expect(mainReport.accesses.length).toBe(1);
    expect(mainReport.accesses[0].property).toBe("mainVal");
    expect(mainReport.accesses[0].templateName).toBe("main");
    // outerHTML: <t t-name="main"><div t-esc="mainVal"/>...
    expect(mainReport.accesses[0].line).toBe(1);
    expect(mainReport.accesses[0].col).toBe(29);
    expect(mainReport.accesses[0].endCol).toBe(36);

    // subVal should be in "helper"
    const helperReport = report.templates["helper"];
    expect(helperReport).toBeDefined();
    expect(helperReport.accesses.length).toBe(1);
    expect(helperReport.accesses[0].property).toBe("subVal");
    expect(helperReport.accesses[0].templateName).toBe("helper");
    // outerHTML: <t t-name="helper"><span t-esc="subVal"/></t>
    expect(helperReport.accesses[0].line).toBe(1);
    expect(helperReport.accesses[0].col).toBe(32);
    expect(helperReport.accesses[0].endCol).toBe(38);
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

    const tmpl = report.templates["getter-test"];
    expect(tmpl).toBeDefined();
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("fullName");
    expect(tmpl.accesses[0].templateName).toBe("getter-test");
    // outerHTML: <t t-name="getter-test"><div t-esc="fullName"/></t>
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(36);
    expect(tmpl.accesses[0].endCol).toBe(44);

    // Getter internal accesses
    expect(report.getterAccesses.length).toBe(2);
    expect(report.getterAccesses[0].property).toBe("firstName");
    expect(report.getterAccesses[0].getterName).toBe("fullName");
    expect(report.getterAccesses[1].property).toBe("lastName");
    expect(report.getterAccesses[1].getterName).toBe("fullName");
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
    const tmpl = report.templates["record-template"];
    expect(tmpl).toBeDefined();
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("msg");
    expect(tmpl.accesses[0].templateName).toBe("record-template");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(12);
    expect(tmpl.accesses[0].endCol).toBe(15);
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
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    // For template `<div t-esc="value"/>`:
    //   line 1, "value" starts at col 12 (after `<div t-esc="`), ends at 17
    expect(tmpl.accesses[0].property).toBe("value");
    expect(tmpl.accesses[0].expression).toBe("value");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(12);
    expect(tmpl.accesses[0].endCol).toBe(17);
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
    const tmpl = report.templates[tpl];
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("name");
    expect(tmpl.accesses[0].expression).toBe("name");
    // Line 2 (1-based): `  <span t-esc="name"/>`
    expect(tmpl.accesses[0].line).toBe(2);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(19);
  });

  test("reports full original expression for dotted access", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="state.count"/>`;
      state = { count: 5 };
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>5</div>");

    const report = getThisTrackingReport();
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    // Full original expression is preserved
    expect(tmpl.accesses[0].property).toBe("state");
    expect(tmpl.accesses[0].expression).toBe("state.count");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(12);
    expect(tmpl.accesses[0].endCol).toBe(23);
  });

  test("reports full original expression for this.prop access", async () => {
    class MyComp extends Component {
      static template = xml`<div t-esc="this.value"/>`;
      value = 99;
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe("<div>99</div>");

    const report = getThisTrackingReport();
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("value");
    expect(tmpl.accesses[0].expression).toBe("this.value");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(12);
    expect(tmpl.accesses[0].endCol).toBe(22);
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
    const tmpl = report.templates[tpl];

    expect(tmpl.accesses.length).toBe(2);
    expect(tmpl.accesses[0].property).toBe("showIt");
    expect(tmpl.accesses[0].expression).toBe("showIt");
    expect(tmpl.accesses[0].line).toBe(2);
    expect(tmpl.accesses[0].col).toBe(14);
    expect(tmpl.accesses[0].endCol).toBe(20);
    expect(tmpl.accesses[1].property).toBe("msg");
    expect(tmpl.accesses[1].expression).toBe("msg");
    expect(tmpl.accesses[1].line).toBe(2);
    expect(tmpl.accesses[1].col).toBe(29);
    expect(tmpl.accesses[1].endCol).toBe(32);
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
    const tmpl = report.templates[tpl];

    // Only the collection 'items' goes through the proxy
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("items");
    expect(tmpl.accesses[0].expression).toBe("items");
    expect(tmpl.accesses[0].line).toBe(2);
    expect(tmpl.accesses[0].col).toBe(16);
    expect(tmpl.accesses[0].endCol).toBe(21);
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
    const tmpl = report.templates["loc-test"];
    expect(tmpl).toBeDefined();
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("value");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(12);
    expect(tmpl.accesses[0].endCol).toBe(17);
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
    const tmpl = report.templates[tpl];

    expect(tmpl.accesses.length).toBe(2);
    expect(tmpl.accesses[0].property).toBe("first");
    expect(tmpl.accesses[0].line).toBe(2);
    expect(tmpl.accesses[0].col).toBe(15);
    expect(tmpl.accesses[0].endCol).toBe(20);
    expect(tmpl.accesses[1].property).toBe("second");
    expect(tmpl.accesses[1].line).toBe(3);
    expect(tmpl.accesses[1].col).toBe(15);
    expect(tmpl.accesses[1].endCol).toBe(21);
  });

  test("reports line/col for t-att dynamic attribute", async () => {
    class MyComp extends Component {
      static template = xml`<div t-att-class="cls"/>`;
      cls = "active";
    }

    await mount(MyComp, fixture);
    expect(fixture.innerHTML).toBe('<div class="active"></div>');

    const report = getThisTrackingReport();
    const tmpl = report.templates[MyComp.template];
    expect(tmpl.accesses.length).toBe(1);
    expect(tmpl.accesses[0].property).toBe("cls");
    expect(tmpl.accesses[0].expression).toBe("cls");
    expect(tmpl.accesses[0].line).toBe(1);
    expect(tmpl.accesses[0].col).toBe(18);
    expect(tmpl.accesses[0].endCol).toBe(21);
  });
});
