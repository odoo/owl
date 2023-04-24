import {
  renderToString,
  renderToBdom,
  snapshotEverything,
  TestContext,
  makeTestFixture,
} from "../helpers";
import { mount, patch } from "../../src/runtime/blockdom";
import { createBlock } from "../../src/runtime/blockdom/index";
import { markup } from "../../src/runtime/utils";

snapshotEverything();

// -----------------------------------------------------------------------------
// t-out
// -----------------------------------------------------------------------------

describe("t-out", () => {
  let fixture: HTMLElement;

  beforeEach(() => {
    fixture = makeTestFixture();
  });

  test("literal", () => {
    const template = `<span><t t-out="'ok'"/></span>`;
    expect(renderToString(template)).toBe("<span>ok</span>");
  });

  test("number literal", () => {
    const template = `<span><t t-out="1"/></span>`;
    expect(renderToString(template)).toBe("<span>1</span>");
  });

  test("literal, no outside html element", () => {
    const template = `<t t-out="'ok'"/>`;
    expect(renderToString(template)).toBe("ok");
  });

  test("variable", () => {
    const template = `<span><t t-out="var"/></span>`;
    expect(renderToString(template, { var: "ok" })).toBe("<span>ok</span>");
  });

  test("with a String class", () => {
    const template = `<span><t t-out="var"/></span>`;
    expect(renderToString(template, { var: new String("ok") })).toBe("<span>ok</span>");
  });

  test("t-out with the 0 number", () => {
    const template = `<t t-out="var"/>`;
    expect(renderToString(template, { var: 0 })).toBe("0");
  });

  test("t-out with the 0 number, in a p", () => {
    const template = `<p><t t-out="var"/></p>`;
    expect(renderToString(template, { var: 0 })).toBe("<p>0</p>");
  });

  test("top level t-out with undefined", () => {
    const template = `<t t-out="var"/>`;
    expect(renderToString(template, { var: undefined })).toBe("");
  });

  test("top level t-out with null", () => {
    const template = `<t t-out="var"/>`;
    expect(renderToString(template, { var: null })).toBe("");
  });

  test("with an extended String class", () => {
    class LoveString extends String {
      valueOf(): string {
        return `<3 ${super.valueOf()} <3`;
      }
      toString(): string {
        return this.valueOf();
      }
    }
    const template = `<span><t t-out="var"/></span>`;
    expect(renderToString(template, { var: new LoveString("ok") })).toBe(
      "<span>&lt;3 ok &lt;3</span>"
    );
  });

  test("not escaping", () => {
    const template = `<div><t t-out="var"/></div>`;
    expect(renderToString(template, { var: markup("<ok></ok>") })).toBe("<div><ok></ok></div>");
  });

  test("t-out and another sibling node", () => {
    const template = `<span><span>hello</span><t t-out="var"/></span>`;
    expect(renderToString(template, { var: markup("<ok>world</ok>") })).toBe(
      "<span><span>hello</span><ok>world</ok></span>"
    );
  });

  test("t-out with comment", () => {
    const template = `<span><t t-out="var"/></span>`;
    expect(renderToString(template, { var: markup("<p>text<!-- top secret --></p>") })).toBe(
      "<span><p>text<!-- top secret --></p></span>"
    );
  });

  test("t-out on a node with a body, as a default", () => {
    const template = `<span t-out="var">nope</span>`;
    expect(renderToString(template)).toBe("<span>nope</span>");
  });

  test("t-out with a <t/> in body", () => {
    const template = `<t t-out="var"><t></t></t>`;
    expect(renderToString(template, { var: "coucou" })).toBe("coucou");
  });

  test("t-out with just a t-set t-value in body", () => {
    const template = `<t t-out="var"><t t-set="a" t-value="1" /></t>`;
    expect(renderToString(template, { var: "coucou" })).toBe("coucou");
  });

  test("t-out on a node with a dom node in body, as a default", () => {
    const template = `<span t-out="var"><div>nope</div></span>`;
    expect(renderToString(template)).toBe("<span><div>nope</div></span>");
  });

  test("multiple calls to t-out", () => {
    const context = new TestContext();
    const sub = `
        <div>
          <t t-out="0"/>
          <div>Greeter</div>
          <t t-out="0"/>
        </div>`;

    const main = `
        <div>
          <t t-call="sub">
            <span>coucou</span>
          </t>
        </div>`;

    context.addTemplate("sub", sub);
    context.addTemplate("main", main);
    const expected =
      "<div><div><span>coucou</span><div>Greeter</div><span>coucou</span></div></div>";
    expect(context.renderToString("main")).toBe(expected);
  });

  test("t-out escaped", () => {
    const template = `<span t-out="var" />`;
    expect(renderToString(template, { var: "<div>nope</div>" })).toBe(
      "<span>&lt;div&gt;nope&lt;/div&gt;</span>"
    );
  });

  test("t-out markedup", () => {
    const template = `<span t-out="var" />`;
    expect(renderToString(template, { var: markup("<div>nope</div>") })).toBe(
      "<span><div>nope</div></span>"
    );
  });

  test("t-out switch escaped", () => {
    const template = `<span t-out="var" />`;
    const node = renderToBdom(template, { var: "<div>nope</div>" });
    mount(node, fixture);

    expect(fixture.innerHTML).toBe("<span>&lt;div&gt;nope&lt;/div&gt;</span>");
    patch(node, renderToBdom(template, { var: "<li>yep</li>" }));

    expect(fixture.innerHTML).toBe("<span>&lt;li&gt;yep&lt;/li&gt;</span>");
  });

  test("t-out switch markup", () => {
    const template = `<span t-out="var" />`;
    const node = renderToBdom(template, { var: markup("<div>nope</div>") });
    mount(node, fixture);

    expect(fixture.innerHTML).toBe("<span><div>nope</div></span>");
    patch(node, renderToBdom(template, { var: markup("<li>yep</li>") }));

    expect(fixture.innerHTML).toBe("<span><li>yep</li></span>");
  });

  test("t-out switch markup on escaped", () => {
    const template = `<span t-out="var" />`;
    const node = renderToBdom(template, { var: "<div>nope</div>" });
    mount(node, fixture);

    expect(fixture.innerHTML).toBe("<span>&lt;div&gt;nope&lt;/div&gt;</span>");
    patch(node, renderToBdom(template, { var: markup("<li>yep</li>") }));

    expect(fixture.innerHTML).toBe("<span><li>yep</li></span>");
  });

  test("t-out switch escaped on markup", () => {
    const template = `<span t-out="var" />`;
    const node = renderToBdom(template, { var: markup("<div>nope</div>") });
    mount(node, fixture);

    expect(fixture.innerHTML).toBe("<span><div>nope</div></span>");
    patch(node, renderToBdom(template, { var: "<li>yep</li>" }));

    expect(fixture.innerHTML).toBe("<span>&lt;li&gt;yep&lt;/li&gt;</span>");
  });

  test("t-out block", () => {
    const block = createBlock("<div>block</div>");
    const template = `<span t-out="bdom"/>`;
    expect(renderToString(template, { bdom: block() })).toBe("<span><div>block</div></span>");
  });

  test("t-out bdom", () => {
    const template = `<div><t t-set="var"><ol>set</ol></t><span t-out="var" /></div>`;
    expect(renderToString(template)).toBe("<div><span><ol>set</ol></span></div>");
  });

  test("t-out switch markup on bdom", () => {
    const template = `<div>
      <t t-set="bdom"><ol>set</ol></t>
      <t t-if="hasBdom">
        <span t-out="bdom" />
      </t>
      <t t-else="">
        <span t-out="var" />
      </t>
    </div>`;

    const node = renderToBdom(template, { hasBdom: true, var: markup("<li>yep</li>") });
    mount(node, fixture);

    expect(fixture.innerHTML).toBe("<div><span><ol>set</ol></span></div>");
    patch(node, renderToBdom(template, { hasBdom: false, var: markup("<li>yep</li>") }));

    expect(fixture.innerHTML).toBe("<div><span><li>yep</li></span></div>");
  });

  test("t-out 0", () => {
    const context = new TestContext();
    context.addTemplate("_basic-callee", `<div><t t-out="0" /></div>`);
    context.addTemplate("caller", `<div><t t-call="_basic-callee"><div>zero</div></t></div>`);
    const node = context.getTemplate("caller")({}, null, "");
    mount(node, fixture);
    expect(fixture.innerHTML).toBe("<div><div><div>zero</div></div></div>");
  });

  test("t-out with arbitrary object", () => {
    const template = `<div t-out="var" />`;
    const node = renderToBdom(template, { var: { someKey: "someValue" } });
    expect(() => mount(node, fixture)).toThrow();
  });

  test("t-out with arbitrary object 2", () => {
    const template = `<div t-out="var" />`;
    const node = renderToBdom(template, { var: ["someValue"] });
    expect(() => mount(node, fixture)).toThrow();
  });
});

describe("t-raw is deprecated", () => {
  test("should warn", () => {
    const template = `<div t-raw="var" />`;
    const warn = console.warn;
    const steps: string[] = [];
    console.warn = (msg: any) => steps.push(msg);

    expect(renderToString(template, { var: "<div>escaped</div>" })).toBe(
      "<div>&lt;div&gt;escaped&lt;/div&gt;</div>"
    );
    expect(steps).toEqual([
      't-raw has been deprecated in favor of t-out. If the value to render is not wrapped by the "markup" function, it will be escaped',
    ]);
    console.warn = warn;
  });

  test("t-out is actually called in t-raw's place", () => {
    const template = `<div t-raw="var" />`;
    const warn = console.warn;
    console.warn = (msg: any) => msg;

    expect(renderToString(template, { var: markup("<div>raw</div>") })).toBe(
      "<div><div>raw</div></div>"
    );
    console.warn = warn;
  });
});
