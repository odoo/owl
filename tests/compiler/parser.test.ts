import { ASTType, parse } from "../../src/compiler/parser";

describe("qweb parser", () => {
  // ---------------------------------------------------------------------------
  // texts and basic stuff
  // ---------------------------------------------------------------------------

  test("simple text node", async () => {
    expect(parse("foo")).toEqual({
      type: ASTType.Text,
      value: "foo",
    });
  });

  test("text in t tag", async () => {
    expect(parse("<t>foo</t>")).toEqual({
      type: ASTType.Text,
      value: "foo",
    });
  });

  test("empty string", async () => {
    expect(parse("")).toEqual({
      type: ASTType.Text,
      value: "",
    });
  });

  test("white spaces are maintained", async () => {
    expect(parse("   ")).toEqual({
      type: ASTType.Text,
      value: "   ",
    });
  });

  test("white spaces only text nodes with newlines are removed", async () => {
    const template = `
      <div>  
      </div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      content: [],
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
    });
  });

  test("empty string in t tag", async () => {
    expect(parse("<t></t>")).toEqual({
      type: ASTType.Text,
      value: "",
    });
  });

  test("simple comment node", async () => {
    expect(parse("<!-- comment -->")).toEqual({
      type: ASTType.Comment,
      value: " comment ",
    });
  });

  test("empty div", async () => {
    expect(parse("<div></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      content: [],
      ns: null,
    });
  });

  test("div with some text", async () => {
    expect(parse("<div>some text</div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      content: [{ type: ASTType.Text, value: "some text" }],
      ns: null,
    });
  });

  test("div with some more content", async () => {
    expect(parse("<div>some text<span>inside</span></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        { type: ASTType.Text, value: "some text" },
        {
          type: ASTType.DomNode,
          tag: "span",
          dynamicTag: null,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          model: null,
          ns: null,
          content: [{ type: ASTType.Text, value: "inside" }],
        },
      ],
    });
  });

  test("multiple root dom nodes", async () => {
    expect(parse("<div></div><span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        {
          type: ASTType.DomNode,
          tag: "div",
          dynamicTag: null,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          model: null,
          ns: null,
          content: [],
        },
        {
          type: ASTType.DomNode,
          tag: "span",
          dynamicTag: null,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          model: null,
          ns: null,
          content: [],
        },
      ],
    });
  });

  test("dom node with t multi inside", async () => {
    const template = `<div><t>Loading<t t-out="abc"/></t></div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        { type: ASTType.Text, value: "Loading" },
        { type: ASTType.TOut, expr: "abc", body: null },
      ],
    });
  });

  test("dom node with multiple t multi inside", async () => {
    const template = `
      <div>
        <t t-out="a"/>
        <t>
          <t t-out="b"/>
          <t>Loading<t t-out="c"/></t>
        </t>
      </div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        { type: ASTType.TOut, expr: "a", body: null },
        { type: ASTType.TOut, expr: "b", body: null },
        { type: ASTType.Text, value: "Loading" },
        { type: ASTType.TOut, expr: "c", body: null },
      ],
    });
  });

  test("dom node with t multi inside", async () => {
    const template = `<div><t><t>Loading<t t-out="abc"/></t></t></div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        { type: ASTType.Text, value: "Loading" },
        { type: ASTType.TOut, expr: "abc", body: null },
      ],
    });
  });

  test("dom node with two t multi inside", async () => {
    const template = `
      <div>
        <t><t t-out="a"/><t t-out="b"/></t>
        <t><t t-out="c"/><t t-out="d"/></t>
      </div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        { type: ASTType.TOut, expr: "a", body: null },
        { type: ASTType.TOut, expr: "b", body: null },
        { type: ASTType.TOut, expr: "c", body: null },
        { type: ASTType.TOut, expr: "d", body: null },
      ],
    });
  });

  test("dom node next to text node", async () => {
    expect(parse("some text<span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.Text, value: "some text" },
        {
          type: ASTType.DomNode,
          tag: "span",
          dynamicTag: null,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          model: null,
          ns: null,
          content: [],
        },
      ],
    });
  });

  test("dom node with class attribute", async () => {
    expect(parse(`<div class="abc">foo</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: { class: "abc" },
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [{ type: ASTType.Text, value: "foo" }],
    });
  });

  test("svg dom node", async () => {
    expect(
      parse(
        `<svg width="100px" height="90px"><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/></svg>`
      )
    ).toEqual({
      attrs: {
        height: "90px",
        width: "100px",
      },
      attrsTranslationCtx: null,
      content: [
        {
          attrs: {
            cx: "50",
            cy: "50",
            fill: "yellow",
            r: "4",
            stroke: "green",
            "stroke-width": "1",
          },
          attrsTranslationCtx: null,
          content: [],
          dynamicTag: null,
          model: null,
          ns: null,
          on: null,
          ref: null,
          tag: "circle",
          type: 2,
        },
      ],
      dynamicTag: null,
      model: null,
      ns: "http://www.w3.org/2000/svg",
      on: null,
      ref: null,
      tag: "svg",
      type: 2,
    });
    expect(
      parse(`<g><circle cx="50" cy="50" r="4" stroke="green" stroke-width="1" fill="yellow"/></g>`)
    ).toEqual({
      attrs: null,
      attrsTranslationCtx: null,
      content: [
        {
          attrs: {
            cx: "50",
            cy: "50",
            fill: "yellow",
            r: "4",
            stroke: "green",
            "stroke-width": "1",
          },
          attrsTranslationCtx: null,
          content: [],
          dynamicTag: null,
          model: null,
          ns: null,
          on: null,
          ref: null,
          tag: "circle",
          type: 2,
        },
      ],
      dynamicTag: null,
      model: null,
      ns: "http://www.w3.org/2000/svg",
      on: null,
      ref: null,
      tag: "g",
      type: 2,
    });
  });

  test("pre dom node with new line", async () => {
    expect(parse(`<div><pre />\n</div>`)).toEqual({
      type: 2,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      content: [
        {
          type: 2,
          tag: "pre",
          dynamicTag: null,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          content: [],
          model: null,
          ns: null,
        },
      ],
      model: null,
      ns: null,
    });
  });

  // ---------------------------------------------------------------------------
  // t-out
  // ---------------------------------------------------------------------------

  test("t-esc node (deprecated)", async () => {
    const warn = console.warn;
    const steps: string[] = [];
    console.warn = (msg: any) => steps.push(msg);
    expect(parse(`<t t-esc="text"/>`)).toEqual({
      type: ASTType.TOut,
      expr: "text",
      body: null,
    });

    expect(steps).toEqual([
      't-esc has been deprecated in favor of t-out. If the value to render is not wrapped by the "markup" function, it will be escaped',
    ]);
    console.warn = warn;
  });

  test("t-out node", async () => {
    expect(parse(`<t t-out="text"/>`)).toEqual({
      type: ASTType.TOut,
      expr: "text",
      body: null,
    });
  });

  test("t-out node on a dom node", async () => {
    expect(parse(`<div t-out="text"/>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [{ type: ASTType.TOut, expr: "text", body: null }],
    });
  });

  test("t-out node with body", async () => {
    expect(parse(`<div t-out="text">body</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        { type: ASTType.TOut, expr: "text", body: [{ type: ASTType.Text, value: "body" }] },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // t-if
  // ---------------------------------------------------------------------------

  test("t-if", async () => {
    expect(parse(`<div><t t-if="condition">hey</t></div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        {
          type: ASTType.TIf,
          condition: "condition",
          content: {
            type: ASTType.Text,
            value: "hey",
          },
          tElif: null,
          tElse: null,
        },
      ],
    });
  });

  test("t-if with empty content", async () => {
    expect(parse(`<t t-if="condition"></t>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.Text,
        value: "",
      },
      tElif: null,
      tElse: null,
    });
  });

  test("t-if (on dom node", async () => {
    expect(parse(`<div t-if="condition">hey</div>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.DomNode,
        tag: "div",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [{ type: ASTType.Text, value: "hey" }],
      },
      tElif: null,
      tElse: null,
    });
  });

  test("t-if and t else", async () => {
    expect(parse(`<t t-if="condition">hey</t><t t-else="">else</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.Text,
        value: "hey",
      },
      tElif: null,
      tElse: {
        type: ASTType.Text,
        value: "else",
      },
    });
  });

  test("t-if and t elif", async () => {
    expect(parse(`<t t-if="condition">hey</t><t t-elif="cond2">elif</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.Text,
        value: "hey",
      },
      tElif: [
        {
          condition: "cond2",
          content: { type: ASTType.Text, value: "elif" },
        },
      ],
      tElse: null,
    });
  });

  test("t-if, t-elif and t-else", async () => {
    expect(parse(`<t t-if="c1">hey</t><t t-elif="c2">elif</t><t t-else="">else</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "c1",
      content: {
        type: ASTType.Text,
        value: "hey",
      },
      tElif: [
        {
          condition: "c2",
          content: { type: ASTType.Text, value: "elif" },
        },
      ],
      tElse: {
        type: ASTType.Text,
        value: "else",
      },
    });
  });

  test("t-if, t-elif and t-else on a node", async () => {
    expect(
      parse(`<div t-if="c1">hey</div><h1 t-elif="c2">elif</h1><h2 t-else="">else</h2>`)
    ).toEqual({
      type: ASTType.TIf,
      condition: "c1",
      content: {
        type: ASTType.DomNode,
        tag: "div",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [
          {
            type: ASTType.Text,
            value: "hey",
          },
        ],
      },
      tElif: [
        {
          condition: "c2",
          content: {
            type: ASTType.DomNode,
            tag: "h1",
            dynamicTag: null,
            attrs: null,
            attrsTranslationCtx: null,
            on: null,
            ref: null,
            model: null,
            ns: null,
            content: [{ type: ASTType.Text, value: "elif" }],
          },
        },
      ],
      tElse: {
        type: ASTType.DomNode,
        tag: "h2",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [
          {
            type: ASTType.Text,
            value: "else",
          },
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-set
  // ---------------------------------------------------------------------------

  test("simple t-set expression", async () => {
    expect(parse(`<t t-set="key" t-value="value" />`)).toEqual({
      type: ASTType.TSet,
      name: "key",
      value: "value",
      defaultValue: null,
      body: null,
      hasNoRepresentation: true,
    });
  });

  test("t-set expression with body", async () => {
    expect(parse(`<t t-set="key">ok</t>`)).toEqual({
      type: ASTType.TSet,
      name: "key",
      defaultValue: "ok",
      value: null,
      body: null,
      hasNoRepresentation: true,
    });

    expect(parse(`<t t-set="v"><div>ok</div></t>`)).toEqual({
      type: ASTType.TSet,
      name: "v",
      defaultValue: null,
      value: null,
      body: [
        {
          type: ASTType.DomNode,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          tag: "div",
          dynamicTag: null,
          ref: null,
          model: null,
          ns: null,
          content: [{ type: ASTType.Text, value: "ok" }],
        },
      ],
      hasNoRepresentation: true,
    });

    expect(parse(`<t t-set="v"><div>ok</div>abc</t>`)).toEqual({
      type: ASTType.TSet,
      name: "v",
      defaultValue: null,
      value: null,
      body: [
        {
          type: ASTType.DomNode,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          tag: "div",
          dynamicTag: null,
          ref: null,
          model: null,
          ns: null,
          content: [{ type: ASTType.Text, value: "ok" }],
        },
        { type: ASTType.Text, value: "abc" },
      ],
      hasNoRepresentation: true,
    });
  });

  test("t-if and t-set expression with body", async () => {
    expect(parse(`<t t-if="flag" t-set="key">ok</t>`)).toEqual({
      type: ASTType.TIf,
      condition: "flag",
      content: {
        type: ASTType.TSet,
        name: "key",
        defaultValue: "ok",
        value: null,
        body: null,
        hasNoRepresentation: true,
      },
      tElif: null,
      tElse: null,
    });
  });

  test("t-if, t-else and t-set", async () => {
    expect(
      parse(`<div><t t-if="flag">1</t><t t-else="" t-set="ourvar" t-value="0"></t></div>`)
    ).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        {
          type: ASTType.TIf,
          condition: "flag",
          content: { type: ASTType.Text, value: "1" },
          tElif: null,
          tElse: {
            type: ASTType.TSet,
            name: "ourvar",
            value: "0",
            defaultValue: null,
            body: null,
            hasNoRepresentation: true,
          },
        },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // t-foreach
  // ---------------------------------------------------------------------------

  test("simple t-foreach expression, t-key mandatory", async () => {
    expect(() =>
      parse(`<t t-foreach="list" t-as="item"><t t-out="item"/></t>`)
    ).toThrowErrorMatchingSnapshot();
  });

  test("simple t-foreach expression", async () => {
    expect(
      parse(`<t t-foreach="list" t-as="item" t-key="item_index"><t t-out="item"/></t>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: { type: ASTType.TOut, expr: "item", body: null },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression with t-out", async () => {
    expect(parse(`<t t-foreach="list" t-as="item" t-out="item" t-key="item_index"/>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: { type: ASTType.TOut, expr: "item", body: null },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach on a div expression with t-out", async () => {
    expect(parse(`<div t-foreach="list" t-as="item" t-out="item" t-key="item_index"/>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: {
        type: ASTType.DomNode,
        tag: "div",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [{ type: ASTType.TOut, expr: "item", body: null }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("simple keyed t-foreach expression", async () => {
    expect(parse(`<t t-foreach="list" t-as="item" t-key="item.id"><t t-out="item"/></t>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item.id",
      body: { type: ASTType.TOut, expr: "item", body: null },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression on a span", async () => {
    expect(
      parse(`<span t-foreach="list" t-as="item" t-key="item_index"><t t-out="item"/></span>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: {
        type: ASTType.DomNode,
        tag: "span",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [{ type: ASTType.TOut, expr: "item", body: null }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression on a span", async () => {
    expect(
      parse(
        `<span t-foreach="list" t-if="condition" t-as="item" t-key="item_index"><t t-out="item"/></span>`
      )
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: {
        type: ASTType.TIf,
        condition: "condition",
        tElif: null,
        tElse: null,
        content: {
          type: ASTType.DomNode,
          tag: "span",
          dynamicTag: null,
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          model: null,
          ns: null,
          content: [{ type: ASTType.TOut, expr: "item", body: null }],
        },
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("more complex t-foreach expression on an option", async () => {
    expect(
      parse(
        `<option t-foreach="categories" t-as="category" t-att-value="category.id" t-out="category.name" t-att-selected="category.id==options.active_category_id" t-key="category_index"/>`
      )
    ).toEqual({
      type: ASTType.TForEach,
      collection: "categories",
      elem: "category",
      key: "category_index",
      body: {
        type: ASTType.DomNode,
        tag: "option",
        dynamicTag: null,
        attrs: {
          "t-att-selected": "category.id==options.active_category_id",
          "t-att-value": "category.id",
        },
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [{ type: ASTType.TOut, expr: "category.name", body: null }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach in a div", async () => {
    expect(
      parse(`<div><t t-foreach="list" t-as="item" t-key="item_index"><t t-out="item"/></t></div>`)
    ).toEqual({
      type: ASTType.DomNode,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      tag: "div",
      dynamicTag: null,
      ns: null,
      content: [
        {
          type: ASTType.TForEach,
          collection: "list",
          elem: "item",
          key: "item_index",
          body: { type: ASTType.TOut, expr: "item", body: null },
          memo: "",
          hasNoFirst: true,
          hasNoIndex: false,
          hasNoLast: true,
          hasNoValue: true,
        },
      ],
    });
  });

  test("simple t-key expression", async () => {
    expect(parse(`<t t-key="k">abc</t>`)).toEqual({
      type: ASTType.TKey,
      expr: "k",
      content: { type: ASTType.Text, value: "abc" },
    });
  });

  test("t-foreach expression on a span with a t-key", async () => {
    expect(
      parse(`<span t-foreach="list" t-as="item" t-key="item_index"><t t-out="item"/></span>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: {
        type: ASTType.DomNode,
        tag: "span",
        dynamicTag: null,
        on: null,
        ref: null,
        model: null,
        attrs: null,
        attrsTranslationCtx: null,
        ns: null,
        content: [{ type: ASTType.TOut, expr: "item", body: null }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression with a component inside", async () => {
    expect(parse(`<Comp t-foreach="list" t-as="item" t-key="item_index" />`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: {
        type: ASTType.TComponent,
        isDynamic: false,
        name: "Comp",
        dynamicProps: null,
        props: null,
        propsTranslationCtx: null,
        slots: null,
        on: null,
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression with a t-call inside", async () => {
    expect(
      parse(`<t t-foreach="list" t-as="item" t-key="item_index"><t t-call="blap"/></t>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: {
        type: ASTType.TCall,
        name: "blap",
        body: null,
        context: null,
      },
      memo: "",
      hasNoFirst: false,
      hasNoIndex: false,
      hasNoLast: false,
      hasNoValue: false,
    });
  });

  test("t-foreach expression with t-memo", async () => {
    expect(
      parse(
        `<t t-foreach="list" t-as="item" t-memo="[row.x]" t-key="item_index"><t t-out="item"/></t>`
      )
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      body: { type: ASTType.TOut, expr: "item", body: null },
      memo: "[row.x]",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  // ---------------------------------------------------------------------------
  // t-call
  // ---------------------------------------------------------------------------

  test("simple t-call expression", async () => {
    expect(parse(`<t t-call="blabla" />`)).toEqual({
      type: ASTType.TCall,
      name: "blabla",
      body: null,
      context: null,
    });
  });

  test("t-call with body", async () => {
    expect(parse(`<t t-call="sub">ok</t>`)).toEqual({
      type: ASTType.TCall,
      name: "sub",
      context: null,
      body: [{ type: ASTType.Text, value: "ok" }],
    });
  });

  test("t-call expression with t-call-context", async () => {
    expect(parse(`<t t-call="blabla" t-call-context="someContext"/>`)).toEqual({
      type: ASTType.TCall,
      name: "blabla",
      body: null,
      context: "someContext",
    });
  });

  test("t-call on a div node", async () => {
    expect(parse(`<div t-call="blabla" />`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      model: null,
      ns: null,
      content: [
        {
          type: ASTType.TCall,
          name: "blabla",
          body: null,
          context: null,
        },
      ],
    });
  });

  test("t-call with t-if", async () => {
    expect(parse(`<t t-call="blabla" t-if="condition" />`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      tElif: null,
      tElse: null,
      content: {
        type: ASTType.TCall,
        name: "blabla",
        body: null,
        context: null,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-on
  // ---------------------------------------------------------------------------

  test("simple t-on expression", async () => {
    expect(parse(`<button t-on-click="add">Click</button>`)).toEqual({
      type: ASTType.DomNode,
      tag: "button",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: { click: "add" },
      ref: null,
      model: null,
      ns: null,
      content: [{ type: ASTType.Text, value: "Click" }],
    });
  });

  test("t-onclick without dash", async () => {
    expect(() => parse(`<button t-onclick="add">Click</button>`)).toThrowError(
      "Unknown QWeb directive: 't-onclick'"
    );
  });

  test("t-on without event", async () => {
    expect(() => parse(`<button t-on="add">Click</button>`)).toThrowError(
      "Missing event name with t-on directive"
    );
  });

  test("t-on- without event", async () => {
    expect(() => parse(`<button t-on-="add">Click</button>`)).toThrowError(
      "Missing event name with t-on directive"
    );
  });

  // ---------------------------------------------------------------------------
  // t-model
  // ---------------------------------------------------------------------------

  test("t-model select", async () => {
    expect(parse(`<select t-model="state.model"><option value="1" /></select>`)).toEqual({
      type: 2,
      tag: "select",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      content: [
        {
          type: 2,
          tag: "option",
          dynamicTag: null,
          attrs: { value: "1" },
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          content: [],
          model: null,
          ns: null,
        },
      ],
      model: {
        expr: "state.model",
        targetAttr: "value",
        hasDynamicChildren: false,
        specialInitTargetAttr: null,
        eventType: "change",
        shouldTrim: false,
        shouldNumberize: false,
      },
      ns: null,
    });
  });

  test("t-model select dynamic options", async () => {
    expect(
      parse(`<select t-model="state.model"><option t-att-value="valueVar" /></select>`)
    ).toEqual({
      type: 2,
      tag: "select",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: null,
      content: [
        {
          type: 2,
          tag: "option",
          dynamicTag: null,
          attrs: { "t-att-value": "valueVar" },
          attrsTranslationCtx: null,
          on: null,
          ref: null,
          content: [],
          model: null,
          ns: null,
        },
      ],
      model: {
        expr: "state.model",
        targetAttr: "value",
        specialInitTargetAttr: null,
        eventType: "change",
        shouldTrim: false,
        shouldNumberize: false,
        hasDynamicChildren: true,
      },
      ns: null,
    });
  });

  // ---------------------------------------------------------------------------
  // t-component
  // ---------------------------------------------------------------------------

  test("just a plain component", async () => {
    expect(parse(`<MyComponent />`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      on: null,
      slots: null,
      isDynamic: false,
    });
  });

  test("component with props", async () => {
    expect(parse(`<MyComponent a="1" b="'b'"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: { a: "1", b: "'b'" },
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: null,
    });
  });

  test("component with t-props", async () => {
    expect(parse(`<MyComponent t-props="state" a="1"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: "state",
      props: { a: "1" },
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: null,
    });
  });

  test("component with event handler", async () => {
    expect(parse(`<MyComponent t-on-click="someMethod"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: { click: "someMethod" },
      slots: null,
    });
  });

  test("component with event handler", async () => {
    expect(() => parse(`<MyComponent t-onclick="someMethod"/>`)).toThrowError(
      "unsupported directive on Component: t-onclick"
    );
  });

  test("component with t-ref", async () => {
    expect(() => parse(`<MyComponent t-ref="something"/>`)).toThrow(
      "t-ref is no longer supported on components. Consider exposing only the public part of the component's API through a callback prop."
    );
  });

  test("component with t-att", async () => {
    expect(() => parse(`<MyComponent t-att="something"/>`)).toThrow(
      "t-att makes no sense on component: props are already treated as expressions"
    );
  });

  test("component with t-attf", async () => {
    expect(() => parse(`<MyComponent t-attf="something"/>`)).toThrow(
      "t-attf is not supported on components: use template strings for string interpolation in props"
    );
  });

  test("component with other unsupported directive", async () => {
    expect(() => parse(`<MyComponent t-something="5"/>`)).toThrow(
      "unsupported directive on Component: t-something"
    );
  });

  test("a component with a default slot", async () => {
    expect(parse(`<MyComponent>foo</MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        default: {
          content: { type: ASTType.Text, value: "foo" },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("a component with a default slot with attributes", async () => {
    expect(
      parse(`<MyComponent><t t-set-slot="default" param="param">foo</t></MyComponent>`)
    ).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        default: {
          content: { type: ASTType.Text, value: "foo" },
          attrs: { param: "param" },
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("a component with a default multi root slot", async () => {
    expect(parse(`<MyComponent><span/><div/></MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      isDynamic: false,
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      on: null,
      slots: {
        default: {
          content: {
            type: ASTType.Multi,
            content: [
              {
                type: ASTType.DomNode,
                tag: "span",
                dynamicTag: null,
                attrs: null,
                attrsTranslationCtx: null,
                content: [],
                ref: null,
                model: null,
                on: null,
                ns: null,
              },
              {
                type: ASTType.DomNode,
                tag: "div",
                dynamicTag: null,
                attrs: null,
                attrsTranslationCtx: null,
                content: [],
                ref: null,
                model: null,
                on: null,
                ns: null,
              },
            ],
          },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("a component with an empty named slot", async () => {
    expect(parse(`<MyComponent><t t-set-slot="mySlot"></t></MyComponent>`)).toEqual({
      dynamicProps: null,
      isDynamic: false,
      name: "MyComponent",
      on: null,
      props: null,
      propsTranslationCtx: null,
      slots: {
        mySlot: {
          attrs: null,
          attrsTranslationCtx: null,
          content: null,
          on: null,
          scope: null,
        },
      },
      type: ASTType.TComponent,
    });
  });

  test("a component with a named slot", async () => {
    expect(parse(`<MyComponent><t t-set-slot="name">foo</t></MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      isDynamic: false,
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      on: null,
      slots: {
        name: {
          content: { type: ASTType.Text, value: "foo" },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("a component with a named slot with attributes", async () => {
    expect(parse(`<MyComponent><t t-set-slot="name" param="param">foo</t></MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      isDynamic: false,
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      on: null,
      slots: {
        name: {
          content: { type: ASTType.Text, value: "foo" },
          attrs: { param: "param" },
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("a component with a named slot with t-on", async () => {
    expect(
      parse(`<MyComponent><t t-set-slot="name" t-on-click="doStuff">foo</t></MyComponent>`)
    ).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      isDynamic: false,
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      on: null,
      slots: {
        name: {
          content: { type: ASTType.Text, value: "foo" },
          on: { click: "doStuff" },
          attrs: null,
          attrsTranslationCtx: null,
          scope: null,
        },
      },
    });
  });

  test("a component with a named slot with div tag", async () => {
    expect(() =>
      parse(`<MyComponent><div t-set-slot="name">foo</div></MyComponent>`)
    ).toThrowError();
  });

  test("a component with a named slot and some white space", async () => {
    expect(parse(`<MyComponent><t t-set-slot="name">foo</t> </MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        default: {
          content: { type: ASTType.Text, value: " " },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
        name: {
          content: { type: ASTType.Text, value: "foo" },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("a component with two named slot and some white space", async () => {
    const template = `
      <MyComponent>
        <t t-set-slot="a">foo</t>
        <t t-set-slot="b">bar</t>
      </MyComponent>`;
    expect(parse(template)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        a: {
          content: { type: ASTType.Text, value: "foo" },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
        b: {
          content: { type: ASTType.Text, value: "bar" },
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
        },
      },
    });
  });

  test("dynamic t-component", async () => {
    expect(parse(`<t t-component="myComponent" />`)).toEqual({
      type: ASTType.TComponent,
      name: "myComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: true,
      on: null,
      slots: null,
    });
  });

  test("dynamic component with props", async () => {
    expect(parse(`<t t-component="mycomponent" a="1" b="'b'"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "mycomponent",
      dynamicProps: null,
      props: { a: "1", b: "'b'" },
      propsTranslationCtx: null,
      isDynamic: true,
      on: null,
      slots: null,
    });
  });

  test("dynamic component with t-props", async () => {
    expect(parse(`<t t-component="mycomponent" t-props="state" a="1"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "mycomponent",
      dynamicProps: "state",
      props: { a: "1" },
      propsTranslationCtx: null,
      isDynamic: true,
      on: null,
      slots: null,
    });
  });

  test("component with t-out", async () => {
    expect(parse(`<MyComponent t-out="someValue"/>`)).toEqual(
      parse(`<MyComponent><t t-out="someValue"/></MyComponent>`)
    );
  });

  test("component with t-out and content", async () => {
    expect(() => parse(`<MyComponent t-out="someValue">Some content</MyComponent>`)).toThrow(
      "Cannot have t-out on a component that already has content"
    );
  });

  test("component with t-call", async () => {
    expect(parse(`<MyComponent t-call="subTemplate"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        default: {
          content: { body: null, name: "subTemplate", type: ASTType.TCall, context: null },
          attrs: null,
          attrsTranslationCtx: null,
          scope: null,
          on: null,
        },
      },
    });
  });

  test("component with t-set-slot inside component", async () => {
    const template = `
      <MyComponent>
        <Child>
          <t t-set-slot="brol">coucou</t>
        </Child>
      </MyComponent>
    `;
    expect(parse(template)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        default: {
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
          content: {
            type: ASTType.TComponent,
            isDynamic: false,
            name: "Child",
            dynamicProps: null,
            props: null,
            propsTranslationCtx: null,
            on: null,
            slots: {
              brol: {
                content: { type: ASTType.Text, value: "coucou" },
                attrs: null,
                attrsTranslationCtx: null,
                scope: null,
                on: null,
              },
            },
          },
        },
      },
    });
  });

  test("component with t-set-slot inside component, with an extra <t>", async () => {
    const template = `
      <MyComponent>
        <Child>
          <t t-set-slot="brol">coucou</t>
        </Child>
      </MyComponent>
    `;
    expect(parse(template)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      dynamicProps: null,
      props: null,
      propsTranslationCtx: null,
      isDynamic: false,
      on: null,
      slots: {
        default: {
          attrs: null,
          attrsTranslationCtx: null,
          on: null,
          scope: null,
          content: {
            type: ASTType.TComponent,
            isDynamic: false,
            name: "Child",
            dynamicProps: null,
            props: null,
            propsTranslationCtx: null,
            on: null,
            slots: {
              brol: {
                content: { type: ASTType.Text, value: "coucou" },
                attrs: null,
                attrsTranslationCtx: null,
                on: null,
                scope: null,
              },
            },
          },
        },
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-call-slot
  // ---------------------------------------------------------------------------

  test("a simple t-call-slot", async () => {
    expect(parse(`<t t-call-slot="default"/>`)).toEqual({
      type: ASTType.TCallSlot,
      name: "default",
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      defaultContent: null,
    });
  });

  test("a t-call-slot with default content", async () => {
    expect(parse(`<t t-call-slot="header">default content</t>`)).toEqual({
      type: ASTType.TCallSlot,
      name: "header",
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      defaultContent: { type: ASTType.Text, value: "default content" },
    });
  });

  test("t-call-slot with t-on-", async () => {
    expect(parse(`<t t-call-slot="default" t-on-click.prevent="doSomething"/>`)).toEqual({
      type: ASTType.TCallSlot,
      name: "default",
      attrs: null,
      attrsTranslationCtx: null,
      on: { "click.prevent": "doSomething" },
      defaultContent: null,
    });
  });

  // ---------------------------------------------------------------------------
  // t-debug
  // ---------------------------------------------------------------------------

  test("a t-debug on a dom node", async () => {
    expect(parse(`<div t-debug="">hey</div>`)).toEqual({
      type: ASTType.TDebug,
      content: {
        type: ASTType.DomNode,
        tag: "div",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [{ type: ASTType.Text, value: "hey" }],
      },
    });
  });

  test("a t-log on a dom node", async () => {
    expect(parse(`<div t-log="bla">hey</div>`)).toEqual({
      type: ASTType.TLog,
      expr: "bla",
      content: {
        type: ASTType.DomNode,
        tag: "div",
        dynamicTag: null,
        attrs: null,
        attrsTranslationCtx: null,
        on: null,
        ref: null,
        model: null,
        ns: null,
        content: [{ type: ASTType.Text, value: "hey" }],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-ref
  // ---------------------------------------------------------------------------

  test("a t-ref on a dom node", async () => {
    expect(parse(`<div t-ref="name">hey</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: "name",
      model: null,
      ns: null,
      content: [{ type: ASTType.Text, value: "hey" }],
    });
  });

  test("node with t-ref and t-out", async () => {
    expect(parse(`<div t-out="text" t-ref="name">body</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      dynamicTag: null,
      attrs: null,
      attrsTranslationCtx: null,
      on: null,
      ref: "name",
      model: null,
      ns: null,
      content: [
        { type: ASTType.TOut, expr: "text", body: [{ type: ASTType.Text, value: "body" }] },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // t-call-block
  // ---------------------------------------------------------------------------
  test("simple t-call-block", async () => {
    expect(parse(`<t t-call-block="myBlock" />`)).toEqual({
      type: ASTType.TCallBlock,
      name: "myBlock",
    });
  });

  // ---------------------------------------------------------------------------
  // t-translation
  // ---------------------------------------------------------------------------
  test('t-translation="off"', async () => {
    expect(parse(`<t t-translation="off">word</t>`)).toEqual({
      type: ASTType.TTranslation,
      content: {
        type: ASTType.Text,
        value: "word",
      },
    });

    expect(
      parse(`<div t-foreach="list" t-translation="off" t-as="item" t-key="item_index">word</div>`)
    ).toEqual({
      body: {
        content: {
          attrs: null,
          attrsTranslationCtx: null,
          content: [
            {
              type: ASTType.Text,
              value: "word",
            },
          ],
          on: null,
          ref: null,
          model: null,
          tag: "div",
          dynamicTag: null,
          type: ASTType.DomNode,
          ns: null,
        },
        type: ASTType.TTranslation,
      },
      collection: "list",
      elem: "item",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
      key: "item_index",
      memo: "",
      type: ASTType.TForEach,
    });
  });

  test('t-translation="off": interaction with t-out', async () => {
    expect(parse(`<span t-out="a" t-translation="off"/>`)).toEqual({
      type: ASTType.TTranslation,
      content: {
        attrs: null,
        attrsTranslationCtx: null,
        content: [
          {
            body: null,
            expr: "a",
            type: ASTType.TOut,
          },
        ],
        dynamicTag: null,
        model: null,
        ns: null,
        on: null,
        ref: null,
        tag: "span",
        type: ASTType.DomNode,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-translation-context
  // ---------------------------------------------------------------------------

  test('t-translation-context="fr"', async () => {
    expect(parse(`<t t-translation-context="fr">word</t>`)).toEqual({
      type: ASTType.TTranslationContext,
      content: {
        type: ASTType.Text,
        value: "word",
      },
      translationCtx: "fr",
    });

    expect(parse(`<div t-translation-context="fr">word</div>`)).toEqual({
      content: {
        attrs: null,
        attrsTranslationCtx: null,
        content: [
          {
            type: 0,
            value: "word",
          },
        ],
        dynamicTag: null,
        model: null,
        ns: null,
        on: null,
        ref: null,
        tag: "div",
        type: ASTType.DomNode,
      },
      translationCtx: "fr",
      type: ASTType.TTranslationContext,
    });
  });

  test("t-translation-context: interaction with t-out", async () => {
    expect(parse(`<span t-out="a" t-translation-context="fr"/>`)).toEqual({
      type: ASTType.TTranslationContext,
      content: {
        attrs: null,
        attrsTranslationCtx: null,
        content: [
          {
            body: null,
            expr: "a",
            type: ASTType.TOut,
          },
        ],
        dynamicTag: null,
        model: null,
        ns: null,
        on: null,
        ref: null,
        tag: "span",
        type: ASTType.DomNode,
      },
      translationCtx: "fr",
    });
  });

  // ---------------------------------------------------------------------------
  // t-translation-context-attr
  // ---------------------------------------------------------------------------

  test('t-translation-context="fr" and t-translation-context-title="pt" for a div attr title', async () => {
    expect(
      parse(
        `<div t-translation-context="fr" title="hello" t-translation-context-title="pt">word</div>`
      )
    ).toEqual({
      content: {
        attrs: { title: "hello" },
        attrsTranslationCtx: { title: "pt" },
        content: [
          {
            type: 0,
            value: "word",
          },
        ],
        dynamicTag: null,
        model: null,
        ns: null,
        on: null,
        ref: null,
        tag: "div",
        type: ASTType.DomNode,
      },
      translationCtx: "fr",
      type: ASTType.TTranslationContext,
    });
  });

  test('t-translation-context-title="fr" for component prop title', async () => {
    expect(parse(`<Comp title="hello" t-translation-context-title="fr" />`)).toEqual({
      dynamicProps: null,
      isDynamic: false,
      name: "Comp",
      on: null,
      props: {
        title: "hello",
      },
      propsTranslationCtx: {
        title: "fr",
      },
      slots: null,
      type: ASTType.TComponent,
    });
  });

  // ---------------------------------------------------------------------------
  // t-model
  // ---------------------------------------------------------------------------
  test("t-model", async () => {
    expect(parse(`<input t-model="state.stuff" />`)).toEqual({
      type: ASTType.DomNode,
      attrs: null,
      attrsTranslationCtx: null,
      content: [],
      on: null,
      ref: null,
      tag: "input",
      dynamicTag: null,
      ns: null,
      model: {
        expr: "state.stuff",
        eventType: "input",
        shouldNumberize: false,
        shouldTrim: false,
        hasDynamicChildren: false,
        targetAttr: "value",
        specialInitTargetAttr: null,
      },
    });
    expect(parse(`<input t-model="state['stuff']" />`)).toEqual({
      type: ASTType.DomNode,
      attrs: null,
      attrsTranslationCtx: null,
      content: [],
      on: null,
      ref: null,
      tag: "input",
      dynamicTag: null,
      ns: null,
      model: {
        expr: "state['stuff']",
        eventType: "input",
        shouldNumberize: false,
        shouldTrim: false,
        targetAttr: "value",
        specialInitTargetAttr: null,
        hasDynamicChildren: false,
      },
    });
    expect(parse(`<input t-model.lazy.trim.number="state.stuff" />`)).toEqual({
      type: ASTType.DomNode,
      attrs: null,
      attrsTranslationCtx: null,
      content: [],
      on: null,
      ref: null,
      tag: "input",
      dynamicTag: null,
      ns: null,
      model: {
        expr: "state.stuff",
        eventType: "change",
        shouldNumberize: true,
        shouldTrim: true,
        targetAttr: "value",
        hasDynamicChildren: false,
        specialInitTargetAttr: null,
      },
    });
  });
  expect(parse(`<textarea t-model="state.stuff" />`)).toEqual({
    type: ASTType.DomNode,
    attrs: null,
    attrsTranslationCtx: null,
    content: [],
    on: null,
    ref: null,
    tag: "textarea",
    dynamicTag: null,
    ns: null,
    model: {
      expr: "state.stuff",
      eventType: "input",
      shouldNumberize: false,
      shouldTrim: false,
      targetAttr: "value",
      hasDynamicChildren: false,
      specialInitTargetAttr: null,
    },
  });
  expect(parse(`<input type="checkbox" t-model="state.stuff" />`)).toEqual({
    type: ASTType.DomNode,
    attrs: { type: "checkbox" },
    attrsTranslationCtx: null,
    content: [],
    on: null,
    ref: null,
    tag: "input",
    dynamicTag: null,
    ns: null,
    model: {
      expr: "state.stuff",
      eventType: "input",
      shouldNumberize: false,
      shouldTrim: false,
      targetAttr: "checked",
      hasDynamicChildren: false,
      specialInitTargetAttr: null,
    },
  });
  expect(parse(`<input type="radio" t-model="state.stuff" />`)).toEqual({
    type: ASTType.DomNode,
    attrs: { type: "radio" },
    attrsTranslationCtx: null,
    content: [],
    on: null,
    ref: null,
    tag: "input",
    dynamicTag: null,
    ns: null,
    model: {
      expr: "state.stuff",
      eventType: "click",
      shouldNumberize: false,
      shouldTrim: false,
      targetAttr: "value",
      hasDynamicChildren: false,
      specialInitTargetAttr: "checked",
    },
  });
  expect(parse(`<input type="radio" t-model.lazy.trim.number="state.stuff" />`)).toEqual({
    type: ASTType.DomNode,
    attrs: { type: "radio" },
    attrsTranslationCtx: null,
    content: [],
    on: null,
    ref: null,
    tag: "input",
    dynamicTag: null,
    ns: null,
    model: {
      expr: "state.stuff",
      eventType: "click",
      shouldNumberize: true,
      shouldTrim: true,
      targetAttr: "value",
      hasDynamicChildren: false,
      specialInitTargetAttr: "checked",
    },
  });

  // ---------------------------------------------------------------------------
  // t-tag
  // ---------------------------------------------------------------------------
  test("t-tag", async () => {
    expect(parse(`<div t-tag="theTag" />`)).toEqual({
      type: ASTType.DomNode,
      attrs: null,
      attrsTranslationCtx: null,
      content: [],
      on: null,
      ref: null,
      tag: "div",
      dynamicTag: "theTag",
      model: null,
      ns: null,
    });
  });

  // ---------------------------------------------------------------------------
  // t-portal
  // ---------------------------------------------------------------------------
  test("t-portal", async () => {
    expect(parse(`<t t-portal="target">Content</t>`)).toEqual({
      type: ASTType.TPortal,
      target: "target",
      content: { type: ASTType.Text, value: "Content" },
    });
  });

  test("t-portal with t-if", async () => {
    expect(parse(`<t t-portal="target" t-if="condition">Content</t>`)).toEqual({
      condition: "condition",
      content: {
        content: { type: ASTType.Text, value: "Content" },
        target: "target",
        type: ASTType.TPortal,
      },
      tElif: null,
      tElse: null,
      type: ASTType.TIf,
    });
  });
});
