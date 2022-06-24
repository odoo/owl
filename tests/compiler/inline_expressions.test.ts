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
    expect(() => tokenize("'")).toThrow("Tokenizer error: could not tokenize `'`");
    expect(() => tokenize("'\\")).toThrow("Tokenizer error: could not tokenize `'\\`");
    expect(() => tokenize("'\\'")).toThrow("Tokenizer error: could not tokenize `'\\'`");
    expect(tokenize("'hello ged'")).toEqual([{ type: "VALUE", value: "'hello ged'" }]);
    expect(tokenize("'hello \\'ged\\''")).toEqual([{ type: "VALUE", value: "'hello \\'ged\\''" }]);

    expect(() => tokenize('"')).toThrow('Tokenizer error: could not tokenize `"`');
    expect(() => tokenize('"\\"')).toThrow('Tokenizer error: could not tokenize `"\\"`');
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
    expect(compileExpr("a in b")).toBe("ctx['a'] in ctx['b']");
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
    expect(compileExpr("list.map(e => e.val)")).toBe("ctx['list'].map(_e=>_e.val)");
    expect(compileExpr("list.map(e => a + e)")).toBe("ctx['list'].map(_e=>ctx['a']+_e)");
    expect(compileExpr("list.map((e) => e)")).toBe("ctx['list'].map((_e)=>_e)");
    expect(compileExpr("list.map((elem, index) => elem + index)")).toBe(
      "ctx['list'].map((_elem,_index)=>_elem+_index)"
    );
    expect(compileExpr("(ev => ev)(e)")).toBe("(_ev=>_ev)(ctx['e'])");
    expect(compileExpr("(v1) => myFunc(v1)")).toBe("(_v1)=>ctx['myFunc'](_v1)");
    expect(compileExpr("list.data.map((data) => data)")).toBe(
      "ctx['list'].data.map((_data)=>_data)"
    );
  });
  test.skip("arrow functions: not yet supported", () => {
    // e is added to localvars in inline_expression but not removed after the arrow func body
    expect(compileExpr("(e => e)(e)")).toBe("(_e=>_e)(ctx['e'])");
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

  test("works with builtin properties", () => {
    expect(compileExpr("state.constructor.name")).toBe("ctx['state'].constructor.name");
  });

  test("works with shortcut object key description", () => {
    expect(compileExpr("{a}")).toBe("{a:ctx['a']}");
    expect(compileExpr("{a,b}")).toBe("{a:ctx['a'],b:ctx['b']}");
    expect(compileExpr("{a,b:3,c}")).toBe("{a:ctx['a'],b:3,c:ctx['c']}");
  });

  test("template strings", () => {
    expect(compileExpr("`hey`")).toBe("`hey`");
    expect(compileExpr("`hey ${you}`")).toBe("`hey ${ctx['you']}`");
    expect(compileExpr("`hey ${1 + 2}`")).toBe("`hey ${1+2}`");
  });

  test("works with short object description and lists ", () => {
    expect(compileExpr("[a, b]")).toBe("[ctx['a'],ctx['b']]");
    expect(compileExpr("[a, b, c]")).toBe("[ctx['a'],ctx['b'],ctx['c']]");
    expect(compileExpr("[a, {b, c},d]")).toBe("[ctx['a'],{b:ctx['b'],c:ctx['c']},ctx['d']]");
    expect(compileExpr("{a:[b, {c, d: e}]}")).toBe("{a:[ctx['b'],{c:ctx['c'],d:ctx['e']}]}");
  });

  test("preserving spaces where needed for text operators", () => {
    expect(compileExpr("new Date()")).toBe("new Date()");
    expect(compileExpr("a.c in b")).toBe("ctx['a'].c in ctx['b']");
    expect(compileExpr("typeof val")).toBe("typeof ctx['val']");
  });

  test("binary operators", () => {
    expect(compileExpr("1 | 1")).toBe("1|1");
    expect(compileExpr("1 & 1")).toBe("1&1");
    expect(compileExpr("1 ^ 1")).toBe("1^1");
    expect(compileExpr("~1")).toBe("~1");
  });
});
