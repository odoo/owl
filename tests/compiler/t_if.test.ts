import { makeTestFixture, renderToBdom, renderToString, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// t-if
// -----------------------------------------------------------------------------

describe("t-if", () => {
  test("t-if in a div", () => {
    const template = `<div><t t-if="condition">ok</t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("<div>ok</div>");
    expect(renderToString(template, { condition: false })).toBe("<div></div>");
    expect(renderToString(template, {})).toBe("<div></div>");
  });

  test("just a t-if", () => {
    const template = `<t t-if="condition">ok</t>`;
    expect(renderToString(template, { condition: true })).toBe("ok");
    expect(renderToString(template, { condition: false })).toBe("");
    snapshotTemplateCode(template);
  });

  test("a t-if with two inner nodes", () => {
    const template = `<t t-if="condition"><span>yip</span><div>yip</div></t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("<span>yip</span><div>yip</div>");
    expect(renderToString(template, { condition: false })).toBe("");
  });

  test("div containing a t-if with two inner nodes", () => {
    const template = `<div><t t-if="condition"><span>yip</span><div>yip</div></t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe(
      "<div><span>yip</span><div>yip</div></div>"
    );
    expect(renderToString(template, { condition: false })).toBe("<div></div>");
  });

  test("two consecutive t-if", () => {
    const template = `<t t-if="cond1">1</t><t t-if="cond2">2</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe("12");
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("2");
  });

  test("a t-if next to a div", () => {
    const template = `<div>foo</div><t t-if="cond">1</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond: true })).toBe("<div>foo</div>1");
    expect(renderToString(template, { cond: false })).toBe("<div>foo</div>");
  });

  test("two consecutive t-if in a div", () => {
    const template = `<div><t t-if="cond1">1</t><t t-if="cond2">2</t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe("<div>12</div>");
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("<div>2</div>");
  });

  test("simple t-if/t-else", () => {
    const template = `<t t-if="condition">1</t><t t-else="">2</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("1");
    expect(renderToString(template, { condition: false })).toBe("2");
  });

  test("simple t-if/t-else in a div", () => {
    const template = `<div><t t-if="condition">1</t><t t-else="">2</t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("<div>1</div>");
    expect(renderToString(template, { condition: false })).toBe("<div>2</div>");
  });

  test("t-if/t-else with more content", () => {
    const template = `<t t-if="condition"><t t-if="condition">asf</t></t><t t-else="">coucou</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("asf");
    expect(renderToString(template, { condition: false })).toBe("coucou");
  });

  test("boolean value condition elif", () => {
    const template = `
        <div>
          <t t-if="color == 'black'">black pearl</t>
          <t t-elif="color == 'yellow'">yellow submarine</t>
          <t t-elif="color == 'red'">red is dead</t>
          <t t-else="">beer</t>
        </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { color: "red" })).toBe("<div>red is dead</div>");
  });

  test("boolean value condition elif (no outside node)", () => {
    const template = `
          <t t-if="color == 'black'">black pearl</t>
          <t t-elif="color == 'yellow'">yellow submarine</t>
          <t t-elif="color == 'red'">red is dead</t>
          <t t-else="">beer</t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { color: "red" })).toBe("red is dead");
  });

  test("boolean value condition else", () => {
    const template = `
        <div>
          <span>begin</span>
          <t t-if="condition">ok</t>
          <t t-else="">ok-else</t>
          <span>end</span>
        </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe(
      "<div><span>begin</span>ok<span>end</span></div>"
    );
  });

  test("boolean value condition false else", () => {
    const template = `
        <div><span>begin</span><t t-if="condition">fail</t>
        <t t-else="">fail-else</t><span>end</span></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: false })).toBe(
      "<div><span>begin</span>fail-else<span>end</span></div>"
    );
  });

  test("can use some boolean operators in expressions", () => {
    const template = `
        <div>
          <t t-if="cond1 and cond2">and</t>
          <t t-if="cond1 and cond3">nope</t>
          <t t-if="cond1 or cond3">or</t>
          <t t-if="cond3 or cond4">nope</t>
          <t t-if="m gt 3">mgt</t>
          <t t-if="n gt 3">ngt</t>
          <t t-if="m lt 3">mlt</t>
          <t t-if="n lt 3">nlt</t>
        </div>`;
    snapshotTemplateCode(template);
    const context = {
      cond1: true,
      cond2: true,
      cond3: false,
      cond4: false,
      m: 5,
      n: 2,
    };
    expect(renderToString(template, context)).toBe("<div>andormgtnlt</div>");
  });

  test("t-esc with t-if", () => {
    const template = `<div><t t-if="true" t-esc="'x'"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>x</div>");
  });

  test("t-esc with t-elif", () => {
    const template = `<div><t t-if="false">abc</t><t t-else="" t-esc="'x'"/></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>x</div>");
  });

  test("t-set, then t-if", () => {
    const template = `
        <div>
          <t t-set="title" t-value="'test'"/>
          <t t-if="title"><t t-esc="title"/></t>
        </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div>test</div>");
  });

  test("t-set, then t-if, part 2", () => {
    const template = `
        <div>
            <t t-set="y" t-value="true"/>
            <t t-set="x" t-value="y"/>
            <span t-if="x">COUCOU</span>
        </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div><span>COUCOU</span></div>");
  });

  test("t-set, then t-if, part 3", () => {
    const template = `
        <div>
          <t t-set="y" t-value="false"/>
          <t t-set="x" t-value="y"/>
          <span t-if="x">AAA</span>
          <span t-elif="!x">BBB</span>
        </div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template)).toBe("<div><span>BBB</span></div>");
  });

  test("t-if in a t-if", () => {
    const template = `<div><t t-if="cond1"><span>1<t t-if="cond2">2</t></span></t></div>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { cond1: true, cond2: true })).toBe(
      "<div><span>12</span></div>"
    );
    expect(renderToString(template, { cond1: true, cond2: false })).toBe(
      "<div><span>1</span></div>"
    );
    expect(renderToString(template, { cond1: false, cond2: true })).toBe("<div></div>");
    expect(renderToString(template, { cond1: false, cond2: false })).toBe("<div></div>");
  });

  test("t-if and t-else with two nodes", () => {
    const template = `<t t-if="condition">1</t><t t-else=""><span>a</span><span>b</span></t>`;
    snapshotTemplateCode(template);
    expect(renderToString(template, { condition: true })).toBe("1");
    expect(renderToString(template, { condition: false })).toBe("<span>a</span><span>b</span>");
  });

  test("dynamic content after t-if with two children nodes", () => {
    const template = `<div><t t-if="condition"><p>1</p><p>2</p></t><t t-esc="text"/></div>`;
    snapshotTemplateCode(template);

    // need to do it with bdom to go through the update path
    const bdom = renderToBdom(template, { condition: true, text: "owl" });
    const fixture = makeTestFixture();
    bdom.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><p>1</p><p>2</p>owl</div>");
    const bdom2 = renderToBdom(template, { condition: false, text: "halloween" });
    bdom.patch(bdom2);
    expect(fixture.innerHTML).toBe("<div>halloween</div>");
  });

  test("two t-ifs next to each other", () => {
    const template = `<div><span t-if="condition"><t t-esc="text"/></span><t t-if="condition"><p>1</p><p>2</p></t></div>`;
    snapshotTemplateCode(template);

    // need to do it with bdom to go through the update path
    const bdom = renderToBdom(template, { condition: true, text: "owl" });
    const fixture = makeTestFixture();
    bdom.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>owl</span><p>1</p><p>2</p></div>");
    const bdom2 = renderToBdom(template, { condition: false, text: "halloween" });
    bdom.patch(bdom2);
    expect(fixture.innerHTML).toBe("<div></div>");
  });
});
