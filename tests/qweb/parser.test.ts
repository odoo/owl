import { ASTType, parse } from "../../src/qweb/parser";

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

  test("white spaces are condensed into a single space", async () => {
    expect(parse("   ")).toEqual({
      type: ASTType.Text,
      value: " ",
    });
  });

  test("white spaces only text nodes with newlines are removed", async () => {
    const template = `
      <div>  
      </div>`;
    expect(parse(template)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      content: [],
      attrs: {},
      on: {},
      ref: null,
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
      attrs: {},
      on: {},
      ref: null,
      content: [],
    });
  });

  test("div with some text", async () => {
    expect(parse("<div>some text</div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: null,
      content: [{ type: ASTType.Text, value: "some text" }],
    });
  });

  test("div with some more content", async () => {
    expect(parse("<div>some text<span>inside</span></div>")).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: null,
      content: [
        { type: ASTType.Text, value: "some text" },
        {
          type: ASTType.DomNode,
          tag: "span",
          attrs: {},
          on: {},
          ref: null,
          content: [{ type: ASTType.Text, value: "inside" }],
        },
      ],
    });
  });

  test("multiple root dom nodes", async () => {
    expect(parse("<div></div><span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.DomNode, tag: "div", attrs: {}, on: {}, ref: null, content: [] },
        { type: ASTType.DomNode, tag: "span", attrs: {}, on: {}, ref: null, content: [] },
      ],
    });
  });

  test("dom node next to text node", async () => {
    expect(parse("some text<span></span>")).toEqual({
      type: ASTType.Multi,
      content: [
        { type: ASTType.Text, value: "some text" },
        { type: ASTType.DomNode, tag: "span", attrs: {}, on: {}, ref: null, content: [] },
      ],
    });
  });

  test("dom node with class attribute", async () => {
    expect(parse(`<div class="abc">foo</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: { class: "abc" },
      on: {},
      ref: null,
      content: [{ type: ASTType.Text, value: "foo" }],
    });
  });

  // ---------------------------------------------------------------------------
  // t-esc
  // ---------------------------------------------------------------------------

  test("t-esc node", async () => {
    expect(parse(`<t t-esc="text"/>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
      defaultValue: "",
    });
    expect(parse(`<t><t t-esc="text"/></t>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
      defaultValue: "",
    });
  });

  test("dom node with t-esc", async () => {
    expect(parse(`<span t-esc="text"/>`)).toEqual({
      type: ASTType.DomNode,
      tag: "span",
      attrs: {},
      on: {},
      ref: null,
      content: [{ type: ASTType.TEsc, expr: "text", defaultValue: "" }],
    });
  });

  test("t-esc node with default value", async () => {
    expect(parse(`<t t-esc="text">hey</t>`)).toEqual({
      type: ASTType.TEsc,
      expr: "text",
      defaultValue: "hey",
    });
  });

  test("dom node with t-esc with default value", async () => {
    expect(parse(`<div t-esc="text">hey</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: null,
      content: [{ type: ASTType.TEsc, expr: "text", defaultValue: "hey" }],
    });
  });

  // ---------------------------------------------------------------------------
  // t-raw
  // ---------------------------------------------------------------------------

  test("t-raw node", async () => {
    expect(parse(`<t t-raw="text"/>`)).toEqual({
      type: ASTType.TRaw,
      expr: "text",
      body: null,
    });
  });

  test("t-raw node on a dom node", async () => {
    expect(parse(`<div t-raw="text"/>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: null,
      content: [{ type: ASTType.TRaw, expr: "text", body: null }],
    });
  });

  test("t-raw node with body", async () => {
    expect(parse(`<div t-raw="text">body</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: null,
      content: [
        { type: ASTType.TRaw, expr: "text", body: [{ type: ASTType.Text, value: "body" }] },
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
      attrs: {},
      on: {},
      ref: null,
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

  test("t-if (on dom node", async () => {
    expect(parse(`<div t-if="condition">hey</div>`)).toEqual({
      type: ASTType.TIf,
      condition: "condition",
      content: {
        type: ASTType.DomNode,
        tag: "div",
        attrs: {},
        on: {},
        ref: null,
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
        attrs: {},
        on: {},
        ref: null,
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
            attrs: {},
            on: {},
            ref: null,
            content: [{ type: ASTType.Text, value: "elif" }],
          },
        },
      ],
      tElse: {
        type: ASTType.DomNode,
        tag: "h2",
        attrs: {},
        on: {},
        ref: null,
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
    });
  });

  test("t-set expression with body", async () => {
    expect(parse(`<t t-set="key">ok</t>`)).toEqual({
      type: ASTType.TSet,
      name: "key",
      defaultValue: "ok",
      value: null,
      body: null,
    });

    expect(parse(`<t t-set="v"><div>ok</div></t>`)).toEqual({
      type: ASTType.TSet,
      name: "v",
      defaultValue: null,
      value: null,
      body: [
        {
          type: ASTType.DomNode,
          attrs: {},
          on: {},
          tag: "div",
          ref: null,
          content: [{ type: ASTType.Text, value: "ok" }],
        },
      ],
    });

    expect(parse(`<t t-set="v"><div>ok</div>abc</t>`)).toEqual({
      type: ASTType.TSet,
      name: "v",
      defaultValue: null,
      value: null,
      body: [
        {
          type: ASTType.DomNode,
          attrs: {},
          on: {},
          tag: "div",
          ref: null,
          content: [{ type: ASTType.Text, value: "ok" }],
        },
        { type: ASTType.Text, value: "abc" },
      ],
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
      attrs: {},
      on: {},
      ref: null,
      content: [
        {
          type: ASTType.TIf,
          condition: "flag",
          content: { type: ASTType.Text, value: "1" },
          tElif: null,
          tElse: { type: ASTType.TSet, name: "ourvar", value: "0", defaultValue: null, body: null },
        },
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // t-foreach
  // ---------------------------------------------------------------------------

  test("simple t-foreach expression", async () => {
    expect(parse(`<t t-foreach="list" t-as="item"><t t-esc="item"/></t>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: null,
      hasNoComponent: true,
      isOnlyChild: false,
      body: { type: ASTType.TEsc, expr: "item", defaultValue: "" },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression with t-esc", async () => {
    expect(parse(`<t t-foreach="list" t-as="item" t-esc="item"/>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: null,
      hasNoComponent: true,
      isOnlyChild: false,
      body: { type: ASTType.TEsc, expr: "item", defaultValue: "" },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach on a div expression with t-esc", async () => {
    expect(parse(`<div t-foreach="list" t-as="item" t-esc="item"/>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      hasNoComponent: true,
      isOnlyChild: false,
      key: null,
      body: {
        type: ASTType.DomNode,
        tag: "div",
        attrs: {},
        on: {},
        ref: null,
        content: [{ type: ASTType.TEsc, expr: "item", defaultValue: "" }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("simple keyed t-foreach expression", async () => {
    expect(parse(`<t t-foreach="list" t-as="item" t-key="item.id"><t t-esc="item"/></t>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      hasNoComponent: true,
      isOnlyChild: false,
      key: "item.id",
      body: { type: ASTType.TEsc, expr: "item", defaultValue: "" },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression on a span", async () => {
    expect(parse(`<span t-foreach="list" t-as="item"><t t-esc="item"/></span>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: null,
      hasNoComponent: true,
      isOnlyChild: false,
      body: {
        type: ASTType.DomNode,
        tag: "span",
        attrs: {},
        on: {},
        ref: null,
        content: [{ type: ASTType.TEsc, expr: "item", defaultValue: "" }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression on a span", async () => {
    expect(
      parse(`<span t-foreach="list" t-if="condition" t-as="item"><t t-esc="item"/></span>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: null,
      hasNoComponent: true,
      isOnlyChild: false,
      body: {
        type: ASTType.TIf,
        condition: "condition",
        tElif: null,
        tElse: null,
        content: {
          type: ASTType.DomNode,
          tag: "span",
          attrs: {},
          on: {},
          ref: null,
          content: [{ type: ASTType.TEsc, expr: "item", defaultValue: "" }],
        },
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("more complex t-foreach expression on an option", async () => {
    expect(
      parse(
        `<option t-foreach="categories" t-as="category" t-att-value="category.id" t-esc="category.name" t-att-selected="category.id==options.active_category_id"/>`
      )
    ).toEqual({
      type: ASTType.TForEach,
      collection: "categories",
      elem: "category",
      key: null,
      hasNoComponent: true,
      isOnlyChild: false,
      body: {
        type: ASTType.DomNode,
        tag: "option",
        attrs: {
          "t-att-selected": "category.id==options.active_category_id",
          "t-att-value": "category.id",
        },
        on: {},
        ref: null,
        content: [{ type: ASTType.TEsc, expr: "category.name", defaultValue: "" }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach in a div", async () => {
    expect(parse(`<div><t t-foreach="list" t-as="item"><t t-esc="item"/></t></div>`)).toEqual({
      type: ASTType.DomNode,
      attrs: {},
      on: {},
      ref: null,
      tag: "div",
      content: [
        {
          type: ASTType.TForEach,
          collection: "list",
          elem: "item",
          key: null,
          hasNoComponent: true,
          isOnlyChild: true,
          body: { type: ASTType.TEsc, expr: "item", defaultValue: "" },
          memo: "",
          hasNoFirst: true,
          hasNoIndex: true,
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
      parse(`<span t-foreach="list" t-as="item" t-key="item_index"><t t-esc="item"/></span>`)
    ).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: "item_index",
      hasNoComponent: true,
      isOnlyChild: false,
      body: {
        type: ASTType.DomNode,
        tag: "span",
        on: {},
        ref: null,
        attrs: {},
        content: [{ type: ASTType.TEsc, expr: "item", defaultValue: "" }],
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: false,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression with a component inside", async () => {
    expect(parse(`<Comp t-foreach="list" t-as="item" />`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: null,
      hasNoComponent: false,
      isOnlyChild: false,
      body: {
        type: ASTType.TComponent,
        isDynamic: false,
        name: "Comp",
        handlers: {},
        props: {},
        slots: {},
      },
      memo: "",
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
    });
  });

  test("t-foreach expression with a t-call inside", async () => {
    expect(parse(`<t t-foreach="list" t-as="item"><t t-call="blap"/></t>`)).toEqual({
      type: ASTType.TForEach,
      collection: "list",
      elem: "item",
      key: null,
      hasNoComponent: false,
      isOnlyChild: false,
      body: {
        type: ASTType.TCall,
        name: "blap",
        body: null,
      },
      memo: "",
      hasNoFirst: false,
      hasNoIndex: false,
      hasNoLast: false,
      hasNoValue: false,
    });
  });

  test("t-foreach expression with t-memo", async () => {
    expect(parse(`<t t-foreach="list" t-as="item" t-memo="[row.x]"><t t-esc="item"/></t>`)).toEqual(
      {
        type: ASTType.TForEach,
        collection: "list",
        elem: "item",
        key: null,
        hasNoComponent: true,
        isOnlyChild: false,
        body: { type: ASTType.TEsc, expr: "item", defaultValue: "" },
        memo: "[row.x]",
        hasNoFirst: true,
        hasNoIndex: true,
        hasNoLast: true,
        hasNoValue: true,
      }
    );
  });

  // ---------------------------------------------------------------------------
  // t-call
  // ---------------------------------------------------------------------------

  test("simple t-call expression", async () => {
    expect(parse(`<t t-call="blabla" />`)).toEqual({
      type: ASTType.TCall,
      name: "blabla",
      body: null,
    });
  });

  test("t-call with body", async () => {
    expect(parse(`<t t-call="sub">ok</t>`)).toEqual({
      type: ASTType.TCall,
      name: "sub",
      body: [{ type: ASTType.Text, value: "ok" }],
    });
  });

  test("t-call on a div node", async () => {
    expect(parse(`<div t-call="blabla" />`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: null,
      content: [
        {
          type: ASTType.TCall,
          name: "blabla",
          body: null,
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
      attrs: {},
      on: { click: "add" },
      ref: null,
      content: [{ type: ASTType.Text, value: "Click" }],
    });
  });

  // ---------------------------------------------------------------------------
  // t-component
  // ---------------------------------------------------------------------------

  test("just a plain component", async () => {
    expect(parse(`<MyComponent />`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      handlers: {},
      slots: {},
      isDynamic: false,
    });
  });

  test("component with props", async () => {
    expect(parse(`<MyComponent a="1" b="'b'"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: { a: "1", b: "'b'" },
      handlers: {},
      isDynamic: false,
      slots: {},
    });
  });

  test("component with event handler", async () => {
    expect(parse(`<MyComponent t-on-click="someMethod"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      handlers: { click: "someMethod" },
      isDynamic: false,
      slots: {},
    });
  });

  test("a component with a default slot", async () => {
    expect(parse(`<MyComponent>foo</MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      isDynamic: false,
      handlers: {},
      slots: { default: { type: ASTType.Text, value: "foo" } },
    });
  });

  test("a component with a default multi root slot", async () => {
    expect(parse(`<MyComponent><span/><div/></MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      isDynamic: false,
      props: {},
      handlers: {},
      slots: {
        default: {
          type: ASTType.Multi,
          content: [
            { type: ASTType.DomNode, tag: "span", attrs: {}, content: [], ref: null, on: {} },
            { type: ASTType.DomNode, tag: "div", attrs: {}, content: [], ref: null, on: {} },
          ],
        },
      },
    });
  });

  test("a component with a named slot", async () => {
    expect(parse(`<MyComponent><t t-set-slot="name">foo</t></MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      isDynamic: false,
      props: {},
      handlers: {},
      slots: { name: { type: ASTType.Text, value: "foo" } },
    });
  });

  test("a component with a named slot and some white space", async () => {
    expect(parse(`<MyComponent><t t-set-slot="name">foo</t> </MyComponent>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      isDynamic: false,
      handlers: {},
      slots: {
        default: { type: ASTType.Text, value: " " },
        name: { type: ASTType.Text, value: "foo" },
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
      props: {},
      handlers: {},
      isDynamic: false,
      slots: {
        a: { type: ASTType.Text, value: "foo" },
        b: { type: ASTType.Text, value: "bar" },
      },
    });
  });

  test("dynamic t-component", async () => {
    expect(parse(`<t t-component="myComponent" />`)).toEqual({
      type: ASTType.TComponent,
      name: "myComponent",
      props: {},
      handlers: {},
      isDynamic: true,
      slots: {},
    });
  });

  test("dynamic component with props", async () => {
    expect(parse(`<t t-component="mycomponent" a="1" b="'b'"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "mycomponent",
      props: { a: "1", b: "'b'" },
      handlers: {},
      isDynamic: true,
      slots: {},
    });
  });

  test("component with t-esc", async () => {
    expect(parse(`<MyComponent t-esc="someValue"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      handlers: {},
      isDynamic: false,
      slots: { default: { defaultValue: "", expr: "someValue", type: ASTType.TEsc } },
    });
  });

  test("component with t-call", async () => {
    expect(parse(`<MyComponent t-call="subTemplate"/>`)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      handlers: {},
      isDynamic: false,
      slots: { default: { body: null, name: "subTemplate", type: ASTType.TCall } },
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
      props: {},
      handlers: {},
      isDynamic: false,
      slots: {
        default: {
          type: ASTType.TComponent,
          isDynamic: false,
          handlers: {},
          name: "Child",
          props: {},
          slots: { brol: { type: ASTType.Text, value: "coucou" } },
        },
      },
    });
  });

  test("component with t-set-slot inside component, with an extra <t>", async () => {
    const template = `
      <MyComponent>
        <Child>
          <t><t t-set-slot="brol">coucou</t></t>
        </Child>
      </MyComponent>
    `;
    expect(parse(template)).toEqual({
      type: ASTType.TComponent,
      name: "MyComponent",
      props: {},
      handlers: {},
      isDynamic: false,
      slots: {
        default: {
          type: ASTType.TComponent,
          isDynamic: false,
          handlers: {},
          name: "Child",
          props: {},
          slots: { brol: { type: ASTType.Text, value: "coucou" } },
        },
      },
    });
  });

  // ---------------------------------------------------------------------------
  // t-slot
  // ---------------------------------------------------------------------------

  test("a simple t-slot", async () => {
    expect(parse(`<t t-slot="default"/>`)).toEqual({
      type: ASTType.TSlot,
      name: "default",
      defaultContent: null,
    });
  });

  test("a t-slot with default content", async () => {
    expect(parse(`<t t-slot="header">default content</t>`)).toEqual({
      type: ASTType.TSlot,
      name: "header",
      defaultContent: { type: ASTType.Text, value: "default content" },
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
        attrs: {},
        on: {},
        ref: null,
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
        attrs: {},
        on: {},
        ref: null,
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
      attrs: {},
      on: {},
      ref: "name",
      content: [{ type: ASTType.Text, value: "hey" }],
    });
  });

  test("node with t-ref and t-raw", async () => {
    expect(parse(`<div t-raw="text" t-ref="name">body</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: "name",
      content: [
        { type: ASTType.TRaw, expr: "text", body: [{ type: ASTType.Text, value: "body" }] },
      ],
    });
  });

  test("node with t-ref and t-esc", async () => {
    expect(parse(`<div t-esc="text" t-ref="name">body</div>`)).toEqual({
      type: ASTType.DomNode,
      tag: "div",
      attrs: {},
      on: {},
      ref: "name",
      content: [{ type: ASTType.TEsc, expr: "text", defaultValue: "body" }],
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

    expect(parse(`<div t-foreach="list" t-translation="off" t-as="item">word</div>`)).toEqual({
      body: {
        content: {
          attrs: {},
          content: [
            {
              type: 0,
              value: "word",
            },
          ],
          on: {},
          ref: null,
          tag: "div",
          type: 2,
        },
        type: 16,
      },
      collection: "list",
      elem: "item",
      hasNoComponent: true,
      hasNoFirst: true,
      hasNoIndex: true,
      hasNoLast: true,
      hasNoValue: true,
      isOnlyChild: false,
      key: null,
      memo: "",
      type: 9,
    });
  });
});
