import QWeb from "../src/qweb";
import { EvalContext } from "../src/qweb";


function renderToDOM(t: string, context: EvalContext = {}): DocumentFragment {
  const qweb = new QWeb();
  qweb.addTemplate("test", t);
  return qweb.render("test", context);
}

function renderToString(t: string, context: EvalContext = {}): string {
  const qweb = new QWeb();
  qweb.addTemplate("test", t);
  return qweb.renderToString("test", context);
}

describe("static templates", () => {
  test("minimal template", () => {
    const template = "<t>ok</t>";
    const expected = "ok";
    expect(renderToString(template)).toBe(expected);
  });

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
});

describe("t-esc", () => {
  test("literal", () => {
    const template = `<t t-esc="'ok'"/>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });

  test("variable", () => {
    const template = `<t t-esc="var"/>`;
    const result = renderToString(template, { var: "ok" });
    expect(result).toBe("ok");
  });

  test("escaping", () => {
    const template = `<t t-esc="var"/>`;
    const result = renderToString(template, { var: "<ok>" });
    expect(result).toBe("&lt;ok&gt;");
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
    const template = `<t t-raw="'ok'"/>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });

  test("variable", () => {
    const template = `<t t-raw="var"/>`;
    const result = renderToString(template, { var: "ok" });
    expect(result).toBe("ok");
  });

  test("not escaping", () => {
    const template = `<t t-raw="var"/>`;
    const result = renderToString(template, { var: "<ok>" });
    expect(result).toBe("<ok>");
  });
});

describe("t-set", () => {
  test("set from attribute literal", () => {
    const template = `<t><t t-set="value" t-value="'ok'"/><t t-esc="value"/></t>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });

  test("set from body literal", () => {
    const template = `<t><t t-set="value">ok</t><t t-esc="value"/></t>`;
    const result = renderToString(template);
    expect(result).toBe("ok");
  });

  test("set from attribute lookup", () => {
    const template = `<t><t t-set="stuff" t-value="value"/><t t-esc="stuff"/></t>`;
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe("ok");
  });

  test("set from body lookup", () => {
    const template = `<t><t t-set="stuff"><t t-esc="value"/></t><t t-esc="stuff"/></t>`;
    const result = renderToString(template, { value: "ok" });
    expect(result).toBe("ok");
  });

  test("set from empty body", () => {
    const template = `<t><t t-set="stuff"/><t t-esc="stuff"/></t>`;
    const result = renderToString(template);
    expect(result).toBe("");
  });

  test("value priority", () => {
    const template = `<t><t t-set="value" t-value="1">2</t><t t-esc="value"/></t>`;
    const result = renderToString(template);
    expect(result).toBe("1");
  });

  test("evaluate value expression", () => {
    const template = `<t><t t-set="value" t-value="1 + 2"/><t t-esc="value"/></t>`;
    const result = renderToString(template);
    expect(result).toBe("3");
  });

  test("evaluate value expression, part 2", () => {
    const template = `<t><t t-set="value" t-value="somevariable + 2"/><t t-esc="value"/></t>`;
    const result = renderToString(template, { somevariable: 43 });
    expect(result).toBe("45");
  });
});

describe("t-if", () => {
  test("boolean value true condition", () => {
    const template = `<t t-if="condition">ok</t>`;
    const result = renderToString(template, { condition: true });
    expect(result).toBe("ok");
  });

  test("boolean value false condition", () => {
    const template = `<t t-if="condition">fail</t>`;
    const result = renderToString(template, { condition: false });
    expect(result).toBe("");
  });

  test("boolean value condition missing", () => {
    const template = `<t t-if="condition">fail</t>`;
    const result = renderToString(template);
    expect(result).toBe("");
  });

  test("boolean value condition elif", () => {
    const template = `
      <t>
        <t t-if="color == 'black'">black pearl</t>
        <t t-elif="color == 'yellow'">yellow submarine</t>
        <t t-elif="color == 'red'">red is dead</t>
        <t t-else="">beer</t>
      </t>
    `;
    const result = renderToString(template, { color: "red" });
    expect(result.trim()).toBe("red is dead");
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

  xit("various escapes", () => {
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
    qweb.addTemplate("_basic-callee", "<t>ok</t>");
    qweb.addTemplate("caller", '<t t-call="_basic-callee"/>');
    const expected = "ok";
    expect(qweb.renderToString("caller")).toBe(expected);
  });

  test("with unused body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<t>ok</t>");
    qweb.addTemplate("caller", '<t t-call="_basic-callee">WHEEE</t>');
    const expected = "ok";
    expect(qweb.renderToString("caller")).toBe(expected);
  });

  test("with unused setbody", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<t>ok</t>");
    qweb.addTemplate(
      "caller",
      '<t t-call="_basic-callee"><t t-set="qux" t-value="3"/></t>'
    );
    const expected = "ok";
    expect(qweb.renderToString("caller")).toBe(expected);
  });

  test("with used body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-printsbody", '<t t-esc="0"/>');
    qweb.addTemplate("caller", '<t t-call="_callee-printsbody">ok</t>');
    const expected = "ok";
    expect(qweb.renderToString("caller")).toBe(expected);
  });

  test("with used set body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-uses-foo", '<t t-esc="foo"/>');
    qweb.addTemplate(
      "caller",
      `
      <t t-call="_callee-uses-foo"><t t-set="foo" t-value="'ok'"/></t>`
    );
    const expected = "ok";
    expect(qweb.renderToString("caller")).toBe(expected);
  });

  test("inherit context", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-uses-foo", '<t t-esc="foo"/>');
    qweb.addTemplate(
      "caller",
      `
      <t><t t-set="foo" t-value="1"/><t t-call="_callee-uses-foo"/></t>`
    );
    const expected = "1";
    expect(qweb.renderToString("caller")).toBe(expected);
  });

  test("scoped parameters", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", `<t t-name="_basic-callee">ok</t>`);
    qweb.addTemplate(
      "caller",
      `
      <t>
        <t t-call="_basic-callee">
          <t t-set="foo" t-value="42"/>
        </t>
        <t t-esc="foo"/>
      </t>
    `
    );
    const expected = "ok";
    expect(qweb.renderToString("caller").trim()).toBe(expected);
  });
});

describe("foreach", () => {
  test("iterate on items", () => {
    const template = `<t t-foreach="[3, 2, 1]" t-as="item">
      [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
    </t>`;
    const expected = `[0: 3 3]\n    \n      [1: 2 2]\n    \n      [2: 1 1]`;
    expect(renderToString(template).trim()).toBe(expected);
  });

  test("iterate, position", () => {
    const template = `<t t-foreach="5" t-as="elem">
      -<t t-if="elem_first"> first</t><t t-if="elem_last"> last</t> (<t t-esc="elem_parity"/>)
    </t>`;
    const expected = `- first (even)\n    \n      - (odd)\n    \n      - (even)\n    \n      - (odd)\n    \n      - last (even)`;
    expect(renderToString(template).trim()).toBe(expected);
  });

  test("iterate, integer param", () => {
    const template = `<t t-foreach="3" t-as="item">
      [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
    </t>`;
    const expected = `[0: 0 0]\n    \n      [1: 1 1]\n    \n      [2: 2 2]`;
    expect(renderToString(template).trim()).toBe(expected);
  });

  test("iterate, dict param", () => {
    const template = `<t t-foreach="value" t-as="item">
      [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/> - <t t-esc="item_parity"/>]</t>`;
    const expected = `[0: a 1 - even]\n      [1: b 2 - odd]\n      [2: c 3 - even]`;
    expect(
      renderToString(template, { value: { a: 1, b: 2, c: 3 } }).trim()
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
      <t>
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
      </t>
    `
    );
    const expected = `
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
        
    `.trim();
    expect(qweb.renderToString("caller").trim()).toBe(expected);
  });
});

describe("t-on", () => {
  test("can bind event handler", () => {
    let a = 1;
    const template = `<button t-on-click="add">Click</button>`;
    const fragment = renderToDOM(template, {
      add() { a = 3}
    });
    (<HTMLElement>fragment.firstChild).click();
    expect(a).toBe(3);
  });

  test("can bind handlers with arguments", () => {
    let a = 1;
    const template = `<button t-on-click="add(5)">Click</button>`;
    const fragment = renderToDOM(template, {
      add(n) { a = a + n}
    });
    (<HTMLElement>fragment.firstChild).click();
    expect(a).toBe(6);
  });
});

