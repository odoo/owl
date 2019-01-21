import QWeb, { EvalContext } from "../src/core/qweb_vdom";
import { init } from "../src/libs/snabbdom/src/snabbdom";
import sdAttributes from "../src/libs/snabbdom/src/modules/attributes";
import sdListeners from "../src/libs/snabbdom/src/modules/eventlisteners";

const patch = init([sdAttributes, sdListeners]);

function trim(str: string): string {
  return str.replace(/\s/g, "");
}

function renderToDOM(
  qweb: QWeb,
  template: string,
  context: EvalContext = {}
): HTMLElement | Text {
  const vnode = qweb.render(template, context);
  if (vnode.sel === undefined) {
    return document.createTextNode(vnode.text!);
  }
  const node = document.createElement(vnode.sel!);
  patch(node, vnode);
  return node;
}

function renderToString(
  qweb: QWeb,
  t: string,
  context: EvalContext = {}
): string {
  const node = renderToDOM(qweb, t, context);
  return node instanceof Text ? node.textContent! : node.outerHTML;
}

describe("static templates", () => {
  test("simple string", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<t>hello vdom</t>");
    expect(renderToString(qweb, "test")).toBe("hello vdom");
  });

  test("empty div", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<div></div>");
    expect(renderToString(qweb, "test")).toBe("<div></div>");
  });

  test("div with a text node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<div>word</div>");
    expect(renderToString(qweb, "test")).toBe("<div>word</div>");
  });

  test("div with a span child node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", "<div><span>word</span></div>");
    expect(renderToString(qweb, "test")).toBe("<div><span>word</span></div>");
  });
});

describe("error handling", () => {
  test("invalid xml", () => {
    const qweb = new QWeb();

    expect(() => qweb.addTemplate("test", "<div>")).toThrow(
      "Invalid XML in template"
    );
  });

  test("template with text node and tag", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<t>text<span>other node</span></t>`);

    expect(() => renderToString(qweb, "test")).toThrow(
      "A template should not have more than one root node"
    );
  });

  test("nice warning if no template with given name", () => {
    const qweb = new QWeb();
    expect(() => qweb.render("invalidname")).toThrow("does not exist");
  });
});

describe("t-esc", () => {
  test("literal", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span><t t-esc="'ok'"/></span>`);
    expect(renderToString(qweb, "test")).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span><t t-esc="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "ok" })).toBe("<span>ok</span>");
  });

  test.skip("escaping", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span><t t-esc="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "<ok>" })).toBe(
      "<span>&lt;ok&gt;</span>"
    );
  });

  test("escaping on a node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span t-esc="'ok'"/>`);
    expect(renderToString(qweb, "test")).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span t-esc="'ok'">nope</span>`);
    expect(renderToString(qweb, "test")).toBe("<span>ok</span>");
  });

  test("escaping on a node with a body, as a default", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span t-esc="var">nope</span>`);
    expect(renderToString(qweb, "test")).toBe("<span>nope</span>");
  });
});

describe("t-raw", () => {
  test("literal", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span><t t-raw="'ok'"/></span>`);
    expect(renderToString(qweb, "test")).toBe("<span>ok</span>");
  });

  test("variable", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span><t t-raw="var"/></span>`);
    expect(renderToString(qweb, "test", { var: "ok" })).toBe("<span>ok</span>");
  });

  test("not escaping", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div><t t-raw="var"/></div>`);
    expect(renderToString(qweb, "test", { var: "<ok></ok>" })).toBe(
      "<div><ok></ok></div>"
    );
  });
});

describe("t-set", () => {
  test("set from attribute literal", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-set="value" t-value="'ok'"/><t t-esc="value"/></div>`
    );
    expect(renderToString(qweb, "test")).toBe("<div>ok</div>");
  });

  test("set from body literal", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<t><t t-set="value">ok</t><t t-esc="value"/></t>`
    );
    expect(renderToString(qweb, "test")).toBe("ok");
  });

  test("set from attribute lookup", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-set="stuff" t-value="value"/><t t-esc="stuff"/></div>`
    );
    expect(renderToString(qweb, "test", { value: "ok" })).toBe("<div>ok</div>");
  });

  test("set from body lookup", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-set="stuff"><t t-esc="value"/></t><t t-esc="stuff"/></div>`
    );
    expect(renderToString(qweb, "test", { value: "ok" })).toBe("<div>ok</div>");
  });

  test("set from empty body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div><t t-set="stuff"/><t t-esc="stuff"/></div>`);
    expect(renderToString(qweb, "test")).toBe("<div></div>");
  });

  test("value priority", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-set="value" t-value="1">2</t><t t-esc="value"/></div>`
    );
    expect(renderToString(qweb, "test")).toBe("<div>1</div>");
  });

  test("evaluate value expression", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-set="value" t-value="1 + 2"/><t t-esc="value"/></div>`
    );
    expect(renderToString(qweb, "test")).toBe("<div>3</div>");
  });

  test("evaluate value expression, part 2", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-set="value" t-value="somevariable + 2"/><t t-esc="value"/></div>`
    );
    expect(renderToString(qweb, "test", { somevariable: 43 })).toBe(
      "<div>45</div>"
    );
  });
});

describe("t-if", () => {
  test("boolean value true condition", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div><t t-if="condition">ok</t></div>`);
    expect(renderToString(qweb, "test", { condition: true })).toBe(
      "<div>ok</div>"
    );
  });

  test("boolean value false condition", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div><t t-if="condition">ok</t></div>`);
    expect(renderToString(qweb, "test", { condition: false })).toBe(
      "<div></div>"
    );
  });

  test("boolean value condition missing", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<span><t t-if="condition">fail</t></span>`);
    expect(renderToString(qweb, "test")).toBe("<span></span>");
  });

  test("boolean value condition elif", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-if="color == 'black'">black pearl</t>
        <t t-elif="color == 'yellow'">yellow submarine</t>
        <t t-elif="color == 'red'">red is dead</t>
        <t t-else="">beer</t></div>
    `
    );
    expect(renderToString(qweb, "test", { color: "red" })).toBe(
      "<div>red is dead</div>"
    );
  });

  test("boolean value condition else", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div>
        <span>begin</span>
        <t t-if="condition">ok</t>
        <t t-else="">ok-else</t>
        <span>end</span>
      </div>
    `
    );
    const result = trim(renderToString(qweb, "test", { condition: true }));
    expect(result).toBe("<div><span>begin</span>ok<span>end</span></div>");
  });

  test("boolean value condition false else", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><span>begin</span><t t-if="condition">fail</t>
          <t t-else="">fail-else</t><span>end</span></div>
        `
    );
    const result = trim(renderToString(qweb, "test", { condition: false }));
    expect(result).toBe(
      "<div><span>begin</span>fail-else<span>end</span></div>"
    );
  });
});

describe("attributes", () => {
  test("static attributes", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div foo="a" bar="b" baz="c"/>`);
    const result = renderToString(qweb, "test");
    const expected = `<div foo="a" bar="b" baz="c"></div>`;
    expect(result).toBe(expected);
  });

  test("static attributes on void elements", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<img src="/test.jpg" alt="Test"/>`);
    const result = renderToString(qweb, "test");
    expect(result).toBe(`<img src="/test.jpg" alt="Test">`);
  });

  test("dynamic attributes", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-att-foo="'bar'"/>`);
    const result = renderToString(qweb, "test");
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("fixed variable", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-att-foo="value"/>`);
    const result = renderToString(qweb, "test", { value: "ok" });
    expect(result).toBe(`<div foo="ok"></div>`);
  });

  test("dynamic attribute falsy variable ", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-att-foo="value"/>`);
    const result = renderToString(qweb, "test", { value: false });
    expect(result).toBe(`<div></div>`);
  });

  test("tuple literal", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-att="['foo', 'bar']"/>`);
    const result = renderToString(qweb, "test");
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("tuple variable", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-att="value"/>`);
    const result = renderToString(qweb, "test", { value: ["foo", "bar"] });
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("object", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-att="value"/>`);
    const result = renderToString(qweb, "test", {
      value: { a: 1, b: 2, c: 3 }
    });
    expect(result).toBe(`<div a="1" b="2" c="3"></div>`);
  });

  test("format literal", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-attf-foo="bar"/>`);
    const result = renderToString(qweb, "test");
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("format value", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-attf-foo="b{{value}}r"/>`);
    const result = renderToString(qweb, "test", { value: "a" });
    expect(result).toBe(`<div foo="bar"></div>`);
  });

  test("format expression", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div t-attf-foo="{{value + 37}}"/>`);
    const result = renderToString(qweb, "test", { value: 5 });
    expect(result).toBe(`<div foo="42"></div>`);
  });

  test("format multiple", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div t-attf-foo="a {{value1}} is {{value2}} of {{value3}} ]"/>`
    );
    const result = renderToString(qweb, "test", {
      value1: 0,
      value2: 1,
      value3: 2
    });
    expect(result).toBe(`<div foo="a 0 is 1 of 2 ]"></div>`);
  });

  test.skip("various escapes", () => {
    // not needed??
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `
         <div foo="&lt;foo"
            t-att-bar="bar"
            t-attf-baz="&lt;{{baz}}&gt;"
            t-att="qux"/>
        `
    );
    const result = renderToString(qweb, "test", {
      bar: 0,
      baz: 1,
      qux: { qux: "<>" }
    });
    const expected = `<div foo="&lt;foo" bar="&lt;bar&gt;" baz="&lt;&quot;&lt;baz&gt;&quot;&gt;" qux="&lt;&gt;"></div>`;
    expect(result).toBe(expected);
  });
});

describe("t-call (template calling", () => {
  test("basic caller", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<div>ok</div>");
    qweb.addTemplate("caller", '<t t-call="_basic-callee"/>');
    const expected = "<div>ok</div>";
    expect(renderToString(qweb, "caller")).toBe(expected);
  });

  test("t-call not allowed on a non t node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<t>ok</t>");
    qweb.addTemplate("caller", '<div t-call="_basic-callee"/>');
    expect(() => renderToString(qweb, "caller")).toThrow("Invalid tag");
  });

  test("with unused body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<div>ok</div>");
    qweb.addTemplate("caller", '<t t-call="_basic-callee">WHEEE</t>');
    const expected = "<div>ok</div>";
    expect(renderToString(qweb, "caller")).toBe(expected);
  });

  test("with unused setbody", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_basic-callee", "<div>ok</div>");
    qweb.addTemplate(
      "caller",
      '<t t-call="_basic-callee"><t t-set="qux" t-value="3"/></t>'
    );
    const expected = "<div>ok</div>";
    expect(renderToString(qweb, "caller")).toBe(expected);
  });

  test("with used body", () => {
    const qweb = new QWeb();
    qweb.addTemplate("_callee-printsbody", '<h1><t t-esc="0"/></h1>');
    qweb.addTemplate("caller", '<t t-call="_callee-printsbody">ok</t>');
    const expected = "<h1>ok</h1>";
    expect(renderToString(qweb, "caller")).toBe(expected);
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
    expect(renderToString(qweb, "caller")).toBe(expected);
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
    expect(renderToString(qweb, "caller")).toBe(expected);
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
    expect(trim(renderToString(qweb, "caller"))).toBe(expected);
  });
});

describe("foreach", () => {
  test("iterate on items", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `
      <div>
        <t t-foreach="[3, 2, 1]" t-as="item">
          [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
        </t>
    </div>`
    );
    const result = trim(renderToString(qweb, "test"));
    const expected = `<div>[0:33][1:22][2:11]</div>`;
    expect(result).toBe(expected);
  });

  test("iterate on items (on a element node)", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `
      <div>
        <span t-foreach="[1, 2]" t-as="item"><t t-esc="item"/></span>
    </div>`
    );
    const result = trim(renderToString(qweb, "test"));
    const expected = `<div><span>1</span><span>2</span></div>`;
    expect(result).toBe(expected);
  });

  test("iterate, position", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `
      <div>
        <t t-foreach="5" t-as="elem">
          -<t t-if="elem_first"> first</t><t t-if="elem_last"> last</t> (<t t-esc="elem_parity"/>)
        </t>
      </div>`
    );
    const result = trim(renderToString(qweb, "test"));
    const expected = `<div>-first(even)-(odd)-(even)-(odd)-last(even)</div>`;
    expect(result).toBe(expected);
  });

  test("iterate, integer param", () => {
    const qweb = new QWeb();
    qweb.addTemplate(
      "test",
      `<div><t t-foreach="3" t-as="item">
        [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/>]
      </t></div>`
    );
    const result = trim(renderToString(qweb, "test"));
    const expected = `<div>[0:00][1:11][2:22]</div>`;
    expect(result).toBe(expected);
  });

  test("iterate, dict param", () => {
    const qweb = new QWeb();
    qweb.addTemplate('test',`
      <div>
        <t t-foreach="value" t-as="item">
          [<t t-esc="item_index"/>: <t t-esc="item"/> <t t-esc="item_value"/> - <t t-esc="item_parity"/>]
        </t>
      </div>`);
    const result = trim(renderToString(qweb, "test", { value: { a: 1, b: 2, c: 3 } }));
    const expected = `<div>[0:a1-even][1:b2-odd][2:c3-even]</div>`;
    expect(result).toBe(expected);
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
    const result = trim(renderToString(qweb, "caller"))
    const expected = trim(`
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
    `);
    expect(result).toBe(expected);
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
    (<HTMLElement>node).click();
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
    (<HTMLElement>node).click();
    expect(a).toBe(6);
  });
});


describe("t-ref", () => {
  test("can get a ref on a node", () => {
    const qweb = new QWeb();
    qweb.addTemplate("test", `<div><span t-ref="myspan"/></div>`);
    let refs: any = {};
    renderToDOM(qweb, "test", { refs});
    expect(refs.myspan.tagName).toBe('SPAN');
  });
});
