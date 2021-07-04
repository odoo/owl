import { compileExpr, tokenize } from "../../src/compiler/inline_expressions";

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
    expect(compileExpr("1")).toBe("1");
    expect(compileExpr("1 ")).toBe("1");
    expect(compileExpr("'some string#/, {' ")).toBe("'some string#/, {'");
    expect(compileExpr("{ } ")).toBe("{}");
    expect(compileExpr("{a: 1} ")).toBe("{a:1}");
    expect(compileExpr("{a: 1, b: 2   } ")).toBe("{a:1,b:2}");
    expect(compileExpr("[] ")).toBe("[]");
    expect(compileExpr("[1] ")).toBe("[1]");
    expect(compileExpr("['1', '2'] ")).toBe("['1','2']");
    expect(compileExpr("['1', \"2\"] ")).toBe("['1',\"2\"]");
  });

  test("various types of 'words'", () => {
    expect(compileExpr("true")).toBe("true");
    expect(compileExpr("false")).toBe("false");
    expect(compileExpr("debugger")).toBe("debugger");
  });

  test("parenthesis", () => {
    expect(compileExpr("(1)")).toBe("(1)");
    expect(compileExpr("a*(1 +3)")).toBe("ctx['a']*(1+3)");
  });

  test("objects and sub objects", () => {
    expect(compileExpr("{a:{b:1}} ")).toBe("{a:{b:1}}");
  });

  test("arrays and objects", () => {
    expect(compileExpr("[{b:1}] ")).toBe("[{b:1}]");
    expect(compileExpr("{a: []} ")).toBe("{a:[]}");
    expect(compileExpr("[{b:1, c: [1, {d: {e: 3}} ]}] ")).toBe("[{b:1,c:[1,{d:{e:3}}]}]");
  });

  test("dot operator", () => {
    expect(compileExpr("a.b")).toBe("ctx['a'].b");
    expect(compileExpr("a.b.c")).toBe("ctx['a'].b.c");
  });

  test("various unary operators", () => {
    expect(compileExpr("!flag")).toBe("!ctx['flag']");
    expect(compileExpr("-3")).toBe("-3");
    expect(compileExpr("-a")).toBe("-ctx['a']");
    expect(compileExpr("typeof a")).toBe("typeof ctx['a']");
  });

  test("various binary operators", () => {
    expect(compileExpr("color == 'black'")).toBe("ctx['color']=='black'");
    expect(compileExpr("a || b")).toBe("ctx['a']||ctx['b']");
    expect(compileExpr("color === 'black'")).toBe("ctx['color']==='black'");
    expect(compileExpr("'li_'+item")).toBe("'li_'+ctx['item']");
    expect(compileExpr("state.val > 1")).toBe("ctx['state'].val>1");
    expect(compileExpr("a in b")).toBe("ctx['a']in ctx['b']");
  });

  test("boolean operations", () => {
    expect(compileExpr("a && b")).toBe("ctx['a']&&ctx['b']");
  });

  test("ternary operators", () => {
    expect(compileExpr("a ? b: '2'")).toBe("ctx['a']?ctx['b']:'2'");
    expect(compileExpr("a ? b: (c or '2') ")).toBe("ctx['a']?ctx['b']:(ctx['c']||'2')");
    expect(compileExpr("a ? {test:c}: [1,u]")).toBe("ctx['a']?{test:ctx['c']}:[1,ctx['u']]");
  });

  test("word replacement", () => {
    expect(compileExpr("a or b")).toBe("ctx['a']||ctx['b']");
    expect(compileExpr("a and b")).toBe("ctx['a']&&ctx['b']");
  });

  test("function calls", () => {
    expect(compileExpr("a()")).toBe("ctx['a']()");
    expect(compileExpr("a(1)")).toBe("ctx['a'](1)");
    expect(compileExpr("a(1,2)")).toBe("ctx['a'](1,2)");
    expect(compileExpr("a(1,2,{a:[a]})")).toBe("ctx['a'](1,2,{a:[ctx['a']]})");
    expect(compileExpr("'x'.toUpperCase()")).toBe("'x'.toUpperCase()");
    expect(compileExpr("'x'.toUpperCase({a: 3})")).toBe("'x'.toUpperCase({a:3})");
  });

  test("arrow functions", () => {
    expect(compileExpr("list.map(e => e.val)")).toBe("ctx['list'].map(e=>e.val)");
    expect(compileExpr("list.map(e => a + e)")).toBe("ctx['list'].map(e=>ctx['a']+e)");
    expect(compileExpr("list.map((e) => e)")).toBe("ctx['list'].map((e)=>e)");
    expect(compileExpr("list.map((elem, index) => elem + index)")).toBe(
      "ctx['list'].map((elem,index)=>elem+index)"
    );
  });

  test("assignation", () => {
    expect(compileExpr("a = b")).toBe("ctx['a']=ctx['b']");
    expect(compileExpr("a += b")).toBe("ctx['a']+=ctx['b']");
    expect(compileExpr("a -= b")).toBe("ctx['a']-=ctx['b']");
    expect(compileExpr("a.b = !a.b")).toBe("ctx['a'].b=!ctx['a'].b");
  });

  test("spread operator", () => {
    expect(compileExpr("[...state.list]")).toBe("[...ctx['state'].list]");
    expect(compileExpr("f(...state.list)")).toBe("ctx['f'](...ctx['state'].list)");
    expect(compileExpr("f([...list])")).toBe("ctx['f']([...ctx['list']])");
  });
});
