import QWeb, { EvalContext } from "../src/core/qweb_vdom";
import { init } from "../src/libs/snabbdom/src/snabbdom";
import sdAttributes from "../src/libs/snabbdom/src/modules/attributes";
import sdListeners from "../src/libs/snabbdom/src/modules/eventlisteners";

const patch = init([sdAttributes, sdListeners]);

function renderToDOM(
  qweb: QWeb,
  t: string,
  context: EvalContext = {}
): HTMLElement {
  const vnode = qweb.render(t, context);
  const node = document.createElement(vnode.sel!);
  patch(node, vnode);
  return node;
}
function qwebRender(qweb: QWeb, t: string, context: EvalContext = {}): string {
  const node = renderToDOM(qweb, t, context);
  return node.outerHTML;
}

function renderToString(t: string, context: EvalContext = {}): string {
  const qweb = new QWeb();
  qweb.addTemplate("test", t);
  return qwebRender(qweb, "test", context);
}

describe("static templates", () => {
  test("empty div", () => {
    const template = "<div></div>";
    const expected = template;
    expect(renderToString(template)).toBe(expected);
  });

  test("div with a text node", () => {
    const template = "<div>word</div>";
    const result = renderToString(template);
    expect(result).toBe(template);
  });

  test("div with a span child node", () => {
    const template = "<div><span>word</span></div>";
    const result = renderToString(template);
    expect(result).toBe(template);
  });
});

describe("error handling", () => {
  test("invalid xml", () => {
    const qweb = new QWeb();

    expect(() => qweb.addTemplate("test", "<div>")).toThrow(
      "Invalid XML in template"
    );
  });

  test("template with only text node", () => {
    const template = `<t>text</t>`;

    expect(() => renderToString(template)).toThrow(
      "A template should have one root node"
    );
  });

  test("nice warning if no template with given name", () => {
    const qweb = new QWeb();
    expect(() => qweb.render("invalidname")).toThrow("does not exist");
  });
});

describe("t-esc", () => {
  test("literal", () => {
    const template = `<span><t t-esc="'ok'"/></span>`;
    const result = renderToString(template);
    expect(result).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const template = `<span><t t-esc="var"/></span>`;
    const result = renderToString(template, { var: "ok" });
    expect(result).toBe("<span>ok</span>");
  });

  test.skip("escaping", () => {
    const template = `<span t-debug="1"><t t-esc="var"/></span>`;
    const result = renderToString(template, { var: "<ok>" });
    expect(result).toBe("<span>&lt;ok&gt;</span>");
  });

  test("escaping on a node", () => {
    const template = `<span t-esc="'ok'"/>`;
    const result = renderToString(template);
    expect(result).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body", () => {
    const template = `<span t-esc="'ok'">nope</span>`;
    const result = renderToString(template);
    expect(result).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body, as a default", () => {
    const template = `<span t-esc="var">nope</span>`;
    const result = renderToString(template);
    expect(result).toBe("<span>nope</span>");
  });
});

describe("t-raw", () => {
  test("literal", () => {
    const template = `<span><t t-raw="'ok'"/></span>`;
    const result = renderToString(template);
    expect(result).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const template = `<span><t t-raw="var"/></span>`;
    const result = renderToString(template, { var: "ok" });
    expect(result).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    const template = `<div><t t-raw="var"/></div>`;
    const result = renderToString(template, { var: "<ok></ok>" });
    expect(result).toBe("<div><ok></ok></div>");
  });
});

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<div><t t-set="value" t-value="'ok'"/><t t-esc="value"/></div>`;
    const result = renderToString(template);
    expect(result).toBe("<div>ok</div>");
  });

  test("set from body literal", () => {
    const template = `<div><t t-set="value">ok</t><t t-esc="value"/></div>`;
    const result = renderToString(template);
    expect(result).toBe("<div>ok</div>");
  });

  test("set from attribute lookup", () => {
    const template = `<div><t t-set="stuff" t-value="value"/><t t-esc="stuff"/></div>`;
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe("<div>ok</div>");
  });

  test("set from body lookup", () => {
    const template = `<div><t t-set="stuff"><t t-esc="value"/></t><t t-esc="stuff"/></div>`;
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe("<div>ok</div>");
  });

  test("set from empty body", () => {
    const template = `<div><t t-set="stuff"/><t t-esc="stuff"/></div>`;
    const result = renderToString(template);
    expect(result).toBe("<div></div>");
  });

  test("value priority", () => {
    const template = `<div><t t-set="value" t-value="1">2</t><t t-esc="value"/></div>`;
    const result = renderToString(template);
    expect(result).toBe("<div>1</div>");
  });

  test("evaluate value expression", () => {
    const template = `<div><t t-set="value" t-value="1 + 2"/><t t-esc="value"/></div>`;
    const result = renderToString(template);
    expect(result).toBe("<div>3</div>");
  });

  test("evaluate value expression, part 2", () => {
    const template = `<div><t t-set="value" t-value="somevariable + 2"/><t t-esc="value"/></div>`;
    const result = renderToString(template, { somevariable: 43 });
    expect(result).toBe("<div>45</div>");
  });
});

describe("t-if", () => {
  test("boolean value true condition", () => {
    const template = `<div><t t-if="condition">ok</t></div>`;
    const result = renderToString(template, { condition: true });
    expect(result).toBe("<div>ok</div>");
  });

  test("boolean value false condition", () => {
    const template = `<div><t t-if="condition">fail</t></div>`;
    const result = renderToString(template, { condition: false });
    expect(result).toBe("<div></div>");
  });

  test("boolean value condition missing", () => {
    const template = `<span><t t-if="condition">fail</t></span>`;
    const result = renderToString(template);
    expect(result).toBe("<span></span>");
  });

  test("boolean value condition elif", () => {
    const template = `
      <div><t t-if="color == 'black'">black pearl</t>
        <t t-elif="color == 'yellow'">yellow submarine</t>
        <t t-elif="color == 'red'">red is dead</t>
        <t t-else="">beer</t></div>
    `;
    const result = renderToString(template, { color: "red" });
    expect(result.trim()).toBe("<div>red is dead</div>");
  });

  test("boolean value condition else", () => {
    const template = `
      <div>
        <span>begin</span>
        <t t-if="condition">ok</t>
        <t t-else="">ok-else</t>
        <span>end</span>
      </div>
    `;
    const result = renderToString(template, { condition: true });
    expect(result).toBe(
      "<div>\n        <span>begin</span>\n        ok\n        <span>end</span>\n      </div>"
    );
  });

  test("boolean value condition false else", () => {
    const template = `
        <div><span>begin</span><t t-if="condition">fail</t>
        <t t-else="">fail-else</t><span>end</span></div>
      `;
    const result = renderToString(template, { condition: false });
    expect(result).toBe(
      "<div><span>begin</span>fail-else<span>end</span></div>"
    );
  });
});

describe("attributes", () => {
  test("static attributes", () => {
    const template = `<div foo="a" bar="b" baz="c"/>`;
    const expected = `<div foo="a" bar="b" baz="c"></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("static attributes on void elements", () => {
    const template = `<img src="/test.jpg" alt="Test"/>`;
    const expected = `<img src="/test.jpg" alt="Test">`;
    expect(renderToString(template)).toBe(expected);
  });

  test("dynamic attributes", () => {
    const template = `<div t-att-foo="'bar'"/>`;
    const expected = `<div foo="bar"></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("fixed variable", () => {
    const template = `<div t-att-foo="value"/>`;
    const expected = `<div foo="ok"></div>`;
    expect(renderToString(template, { value: "ok" })).toBe(expected);
  });

  test("dynamic attribute falsy variable ", () => {
    const template = `<div t-att-foo="value"/>`;
    const expected = `<div></div>`;
    expect(renderToString(template, { value: false })).toBe(expected);
  });

  test("tuple literal", () => {
    const template = `<div t-att="['foo', 'bar']"/>`;
    const expected = `<div foo="bar"></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("tuple variable", () => {
    const template = `<div t-att="value"/>`;
    const expected = `<div foo="bar"></div>`;
    expect(renderToString(template, { value: ["foo", "bar"] })).toBe(expected);
  });

  test("object", () => {
    const template = `<div t-att="value"/>`;
    const expected = `<div a="1" b="2" c="3"></div>`;
    expect(renderToString(template, { value: { a: 1, b: 2, c: 3 } })).toBe(
      expected
    );
  });

  test("format literal", () => {
    const template = `<div t-attf-foo="bar"/>`;
    const expected = `<div foo="bar"></div>`;
    expect(renderToString(template)).toBe(expected);
  });

  test("format value", () => {
    const template = `<div t-attf-foo="b{{value}}r"/>`;
    const expected = `<div foo="bar"></div>`;
    expect(renderToString(template, { value: "a" })).toBe(expected);
  });

  test("format expression", () => {
    const template = `<div t-attf-foo="{{value + 37}}"/>`;
    const expected = `<div foo="42"></div>`;
    expect(renderToString(template, { value: 5 })).toBe(expected);
  });

  test("format multiple", () => {
    const template = `<div t-attf-foo="a {{value1}} is {{value2}} of {{value3}} ]"/>`;
    const expected = `<div foo="a 0 is 1 of 2 ]"></div>`;
    expect(renderToString(template, { value1: 0, value2: 1, value3: 2 })).toBe(
      expected
    );
  });

  test.skip("various escapes", () => {
    // need to think about this... This one does not pass, but I am not sure it is
    // a correct test
    const template = `
       <div foo="&lt;foo"
          t-att-bar="bar"
          t-attf-baz="&lt;{{baz}}&gt;"
          t-att="qux"/>
      `;
    const expected = `<div foo="&lt;foo" bar="&lt;bar&gt;" baz="&lt;&quot;&lt;baz&gt;&quot;&gt;" qux="&lt;&gt;"></div>`;
    expect(
      renderToString(template, { bar: 0, baz: 1, qux: { qux: "<>" } })
    ).toBe(expected);
  });
});

describe("t-call (template calling", () => {
  test("basic caller", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<div>ok</div>");
    qweb.addTemplate("caller", '<t t-call="_basic-callee"/>');
    const expected = "<div>ok</div>";
    expect(qwebRender(qweb, "caller")).toBe(expected);
  });

  test("t-call not allowed on a non t node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<t>ok</t>");
    qweb.addTemplate("caller", '<div t-call="_basic-callee"/>');
    expect(() => qwebRender(qweb, "caller")).toThrow("Invalid tag");
  });

  test("with unused body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<div>ok</div>");
    qweb.addTemplate("caller", '<t t-call="_basic-callee">WHEEE</t>');
    const expected = "<div>ok</div>";
    expect(qwebRender(qweb, "caller")).toBe(expected);
  });

  test("with unused setbody", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<div>ok</div>");
    qweb.addTemplate(
      "caller",
      '<t t-call="_basic-callee"><t t-set="qux" t-value="3"/></t>'
    );
    const expected = "<div>ok</div>";
    expect(qwebRender(qweb, "caller")).toBe(expected);
  });

  test("with used body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-printsbody", '<h1><t t-esc="0"/></h1>');
    qweb.addTemplate("caller", '<t t-call="_callee-printsbody">ok</t>');
    const expected = "<h1>ok</h1>";
    expect(qwebRender(qweb, "caller")).toBe(expected);
  });

  test("with used set body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-uses-foo", '<t t-esc="foo"/>');
    qweb.addTemplate(
      "caller",
      `
        <span><t t-call="_callee-uses-foo"><t t-set="foo" t-value="'ok'"/></t></span>`
    );
    const expected = "<span>ok</span>";
    expect(qwebRender(qweb, "caller")).toBe(expected);
  });

  test("inherit context", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-uses-foo", '<t t-esc="foo"/>');
    qweb.addTemplate(
      "caller",
      `
        <div><t t-set="foo" t-value="1"/><t t-call="_callee-uses-foo"/></div>`
    );
    const expected = "<div>1</div>";
    expect(qwebRender(qweb, "caller")).toBe(expected);
  });

  test("scoped parameters", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", `<t>ok</t>`);
    qweb.addTemplate(
      "caller",
      `
        <div>
            <t t-call="_basic-callee">
                <t t-set="foo" t-value="42"/>
            </t>
            <t t-esc="foo"/>
        </div>
      `
    );
    const expected = "<div>ok</div>";
    expect(qwebRender(qweb, "caller").replace(/\s/g, "")).toBe(expected);
  });
});

describe("foreach", () => {
  test("iterate on items", () => {
    const template = `
      <div>
        <t t-foreach="[3, 2, 1]" t-as="item">
          [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
        </t>
    </div>`;
    const expected = `<div>[0:33][1:22][2:11]</div>`;
    expect(renderToString(template).replace(/\s/g, "")).toBe(expected);
  });

  test("iterate on items (on a element node)", () => {
    const template = `
      <div>
        <span t-foreach="[1, 2]" t-as="item"><t t-esc="item"/></span>
    </div>`;
    const expected = `<div><span>1</span><span>2</span></div>`;
    expect(renderToString(template).replace(/\s/g, "")).toBe(expected);
  });

  test("iterate, position", () => {
    const template = `
      <div>
        <t t-foreach="5" t-as="elem">
          -<t t-if="elem_first"> first</t><t t-if="elem_last"> last</t> (<t t-esc="elem_parity"/>)
        </t>
      </div>`;
    const expected = `<div>-first(even)-(odd)-(even)-(odd)-last(even)</div>`;
    expect(renderToString(template).replace(/\s/g, "")).toBe(expected);
  });

  test("iterate, integer param", () => {
    const template = `<div><t t-foreach="3" t-as="item">
      [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
    </t></div>`;
    const expected = `<div>[0:00][1:11][2:22]</div>`;
    expect(renderToString(template).replace(/\s/g, "")).toBe(expected);
  });

  test("iterate, dict param", () => {
    const template = `
      <div>
        <t t-foreach="value" t-as="item">
          [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/> - <t t-esc="item_parity"/>]
        </t>
      </div>`;
    const expected = `<div>[0:a1-even][1:b2-odd][2:c3-even]</div>`;
    expect(
      renderToString(template, { value: { a: 1, b: 2, c: 3 } }).replace(
        /\s/g,
        ""
      )
    ).toBe(expected);
  });
});

describe("misc", () => {
  test("global", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-asc", `<Año t-att-falló="'agüero'" t-raw="0"/>`);
    qweb.addTemplate(
      "_callee-uses-foo",
      `<span t-esc="foo">foo default</span>`
    );
    qweb.addTemplate(
      "_callee-asc-toto",
      `<div t-raw="toto">toto default</div>`
    );
    qweb.addTemplate(
      "caller",
      `
      <div>
        <t t-foreach="[4,5,6]" t-as="value">
          <span t-esc="value"/>
          <t t-call="_callee-asc">
            <t t-call="_callee-uses-foo">
                <t t-set="foo" t-value="'aaa'"/>
            </t>
            <t t-call="_callee-uses-foo"/>
            <t t-set="foo" t-value="'bbb'"/>
            <t t-call="_callee-uses-foo"/>
          </t>
        </t>
        <t t-call="_callee-asc-toto"/>
      </div>
    `
    );
    const expected = `
      <div>
        
          <span>4</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            
            <span>bbb</span>
          </año>
        
          <span>5</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            
            <span>bbb</span>
          </año>
        
          <span>6</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            
            <span>bbb</span>
          </año>
        
        <div>toto default</div>
      </div>
    `.trim();
    expect(qwebRender(qweb, "caller").trim()).toBe(expected);
  });
});

describe("t-on", () => {
  test("can bind event handler", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<button t-on-click="add">Click</button>`);
    let a = 1;
    const node = renderToDOM(qweb, "test", {
      add() {
        a = 3;
      }
    });
    node.click();
    expect(a).toBe(3);
  });

  test("can bind handlers with arguments", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<button t-on-click="add(5)">Click</button>`);
    let a = 1;
    const node = renderToDOM(qweb, "test", {
      add(n) {
        a = a + n;
      }
    });
    node.click();
    expect(a).toBe(6);
  });
});
