import { compileExpr, tokenize } from "../../src/qweb/expression_parser";

describe("tokenizer", () => {
  test("simple tokens", () => {
    expect(tokenize("1.3")).toEqual([{ type: "VALUE", value: "1.3" }]);

    expect(tokenize("{}")).toEqual([
      { type: "LEFT_BRACE", value: "{" },
      { type: "RIGHT_BRACE", value: "}" },
    ]);
    expect(tokenize("{ }}")).toEqual([
      { type: "LEFT_BRACE", value: "{" },
      { type: "RIGHT_BRACE", value: "}" },
      { type: "RIGHT_BRACE", value: "}" },
    ]);
    expect(tokenize("a")).toEqual([{ type: "SYMBOL", value: "a" }]);
    expect(tokenize("true")).toEqual([{ type: "SYMBOL", value: "true" }]);
    expect(tokenize("abcde")).toEqual([{ type: "SYMBOL", value: "abcde" }]);
    expect(tokenize("_ab2")).toEqual([{ type: "SYMBOL", value: "_ab2" }]);
    expect(tokenize("$ab2")).toEqual([{ type: "SYMBOL", value: "$ab2" }]);
    expect(tokenize("ABC")).toEqual([{ type: "SYMBOL", value: "ABC" }]);

    expect(tokenize("{a: 2}")).toEqual([
      { type: "LEFT_BRACE", value: "{" },
      { type: "SYMBOL", value: "a" },
      { type: "COLON", value: ":" },
      { type: "VALUE", value: "2" },
      { type: "RIGHT_BRACE", value: "}" },
    ]);
    expect(tokenize("a,")).toEqual([
      { type: "SYMBOL", value: "a" },
      { type: "COMMA", value: "," },
    ]);
    expect(tokenize("][")).toEqual([
      { type: "RIGHT_BRACKET", value: "]" },
      { type: "LEFT_BRACKET", value: "[" },
    ]);
  });

  test("various operators", () => {
    expect(tokenize(">= <= < > !== !=")).toEqual([
      { type: "OPERATOR", value: ">=" },
      { type: "OPERATOR", value: "<=" },
      { type: "OPERATOR", value: "<" },
      { type: "OPERATOR", value: ">" },
      { type: "OPERATOR", value: "!==" },
      { type: "OPERATOR", value: "!=" },
    ]);
    expect(tokenize("typeof a")).toEqual([
      { type: "OPERATOR", value: "typeof " },
      { type: "SYMBOL", value: "a" },
    ]);

    expect(tokenize("a...1")).toEqual([
      { type: "SYMBOL", value: "a" },
      { type: "OPERATOR", value: "..." },
      { type: "VALUE", value: "1" },
    ]);

    expect(tokenize("a in b")).toEqual([
      { type: "SYMBOL", value: "a" },
      { type: "OPERATOR", value: "in " },
      { type: "SYMBOL", value: "b" },
    ]);
  });

  test("strings", () => {
    expect(() => tokenize("'")).toThrow("Invalid expression");
    expect(() => tokenize("'\\")).toThrow("Invalid expression");
    expect(() => tokenize("'\\'")).toThrow("Invalid expression");
    expect(tokenize("'hello ged'")).toEqual([{ type: "VALUE", value: "'hello ged'" }]);
    expect(tokenize("'hello \\'ged\\''")).toEqual([{ type: "VALUE", value: "'hello \\'ged\\''" }]);

    expect(() => tokenize('"')).toThrow("Invalid expression");
    expect(() => tokenize('"\\"')).toThrow("Invalid expression");
    expect(tokenize('"hello ged"')).toEqual([{ type: "VALUE", value: '"hello ged"' }]);
    expect(tokenize('"hello ged"}')).toEqual([
      { type: "VALUE", value: '"hello ged"' },
      { type: "RIGHT_BRACE", value: "}" },
    ]);
    expect(tokenize('"hello \\"ged\\""')).toEqual([{ type: "VALUE", value: '"hello \\"ged\\""' }]);
  });
});

describe("expression evaluation", () => {
  test("simple static values", () => {
    expect(compileExpr("1", {})).toBe("1");
    expect(compileExpr("1 ", {})).toBe("1");
    expect(compileExpr("'some string#/, {' ", {})).toBe("'some string#/, {'");
    expect(compileExpr("{ } ", {})).toBe("{}");
    expect(compileExpr("{a: 1} ", {})).toBe("{a:1}");
    expect(compileExpr("{a: 1, b: 2   } ", {})).toBe("{a:1,b:2}");
    expect(compileExpr("[] ", {})).toBe("[]");
    expect(compileExpr("[1] ", {})).toBe("[1]");
    expect(compileExpr("['1', '2'] ", {})).toBe("['1','2']");
    expect(compileExpr("['1', \"2\"] ", {})).toBe("['1',\"2\"]");
  });

  test("various types of 'words'", () => {
    expect(compileExpr("true", {})).toBe("true");
    expect(compileExpr("false", {})).toBe("false");
    expect(compileExpr("debugger", {})).toBe("debugger");
  });

  test("parenthesis", () => {
    expect(compileExpr("(1)", {})).toBe("(1)");
    expect(compileExpr("a*(1 +3)", {})).toBe("scope['a']*(1+3)");
  });

  test("objects and sub objects", () => {
    expect(compileExpr("{a:{b:1}} ", {})).toBe("{a:{b:1}}");
  });

  test("replacing variables", () => {
    expect(compileExpr("a", {})).toBe("scope['a']");
    expect(compileExpr("a", { a: { id: "_3", expr: "scope._3" } })).toBe("scope._3");
  });

  test("arrays and objects", () => {
    expect(compileExpr("[{b:1}] ", {})).toBe("[{b:1}]");
    expect(compileExpr("{a: []} ", {})).toBe("{a:[]}");
    expect(compileExpr("[{b:1, c: [1, {d: {e: 3}} ]}] ", {})).toBe("[{b:1,c:[1,{d:{e:3}}]}]");
  });

  test("dot operator", () => {
    expect(compileExpr("a.b", {})).toBe("scope['a'].b");
    expect(compileExpr("a.b.c", {})).toBe("scope['a'].b.c");
  });

  test("various unary operators", () => {
    expect(compileExpr("!flag", {})).toBe("!scope['flag']");
    expect(compileExpr("-3", {})).toBe("-3");
    expect(compileExpr("-a", {})).toBe("-scope['a']");
    expect(compileExpr("typeof a", {})).toBe("typeof scope['a']");
  });

  test("various binary operators", () => {
    expect(compileExpr("color == 'black'", {})).toBe("scope['color']=='black'");
    expect(compileExpr("a || b", {})).toBe("scope['a']||scope['b']");
    expect(compileExpr("color === 'black'", {})).toBe("scope['color']==='black'");
    expect(compileExpr("'li_'+item", {})).toBe("'li_'+scope['item']");
    expect(compileExpr("state.val > 1", {})).toBe("scope['state'].val>1");
    expect(compileExpr("a in b", {})).toBe("scope['a']in scope['b']");
  });

  test("boolean operations", () => {
    expect(compileExpr("a && b", {})).toBe("scope['a']&&scope['b']");
  });

  test("ternary operators", () => {
    expect(compileExpr("a ? b: '2'", {})).toBe("scope['a']?scope['b']:'2'");
    expect(compileExpr("a ? b: (c or '2') ", {})).toBe("scope['a']?scope['b']:(scope['c']||'2')");
    expect(compileExpr("a ? {test:c}: [1,u]", {})).toBe(
      "scope['a']?{test:scope['c']}:[1,scope['u']]"
    );
  });

  test("word replacement", () => {
    expect(compileExpr("a or b", {})).toBe("scope['a']||scope['b']");
    expect(compileExpr("a and b", {})).toBe("scope['a']&&scope['b']");
  });

  test("function calls", () => {
    expect(compileExpr("a()", {})).toBe("scope['a']()");
    expect(compileExpr("a(1)", {})).toBe("scope['a'](1)");
    expect(compileExpr("a(1,2)", {})).toBe("scope['a'](1,2)");
    expect(compileExpr("a(1,2,{a:[a]})", {})).toBe("scope['a'](1,2,{a:[scope['a']]})");
    expect(compileExpr("'x'.toUpperCase()", {})).toBe("'x'.toUpperCase()");
    expect(compileExpr("'x'.toUpperCase({a: 3})", {})).toBe("'x'.toUpperCase({a:3})");
    expect(compileExpr("'x'.toUpperCase(a)", { a: { id: "_v5", expr: "scope._v5" } })).toBe(
      "'x'.toUpperCase(scope._v5)"
    );
    expect(compileExpr("'x'.toUpperCase({b: a})", { a: { id: "_v5", expr: "scope._v5" } })).toBe(
      "'x'.toUpperCase({b:scope._v5})"
    );
  });

  test("arrow functions", () => {
    expect(compileExpr("list.map(e => e.val)", {})).toBe("scope['list'].map(e=>e.val)");
    expect(compileExpr("list.map(e => a + e)", {})).toBe("scope['list'].map(e=>scope['a']+e)");
    expect(compileExpr("list.map((e) => e)", {})).toBe("scope['list'].map((e)=>e)");
    expect(compileExpr("list.map((elem, index) => elem + index)", {})).toBe(
      "scope['list'].map((elem,index)=>elem+index)"
    );
  });

  test("assignation", () => {
    expect(compileExpr("a = b", {})).toBe("scope['a']=scope['b']");
    expect(compileExpr("a += b", {})).toBe("scope['a']+=scope['b']");
    expect(compileExpr("a -= b", {})).toBe("scope['a']-=scope['b']");
    expect(compileExpr("a.b = !a.b", {})).toBe("scope['a'].b=!scope['a'].b");
  });

  test("spread operator", () => {
    expect(compileExpr("[...state.list]", {})).toBe("[...scope['state'].list]");
    expect(compileExpr("f(...state.list)", {})).toBe("scope['f'](...scope['state'].list)");
    expect(compileExpr("f([...list])", {})).toBe("scope['f']([...scope['list']])");
  });
});
