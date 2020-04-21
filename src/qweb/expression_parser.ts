/**
 * Owl QWeb Expression Parser
 *
 * Owl needs in various contexts to be able to understand the structure of a
 * string representing a javascript expression.  The usual goal is to be able
 * to rewrite some variables.  For example, if a template has
 *
 *  ```xml
 *  <t t-if="computeSomething({val: state.val})">...</t>
 * ```
 *
 * this needs to be translated in something like this:
 *
 * ```js
 *   if (context["computeSomething"]({val: context["state"].val})) { ... }
 * ```
 *
 * This file contains the implementation of an extremely naive tokenizer/parser
 * and evaluator for javascript expressions.  The supported grammar is basically
 * only expressive enough to understand the shape of objects, of arrays, and
 * various operators.
 */

//------------------------------------------------------------------------------
// Misc types, constants and helpers
//------------------------------------------------------------------------------

const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,eval,void,Math,RegExp,Array,Object,Date".split(
  ","
);

const WORD_REPLACEMENT = {
  and: "&&",
  or: "||",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

export interface QWebVar {
  id: string; // foo
  expr: string; // scope.foo (local variables => only foo)
  value?: string; // 1 + 3
  hasBody?: boolean;
}

//------------------------------------------------------------------------------
// Tokenizer
//------------------------------------------------------------------------------
type TKind =
  | "LEFT_BRACE"
  | "RIGHT_BRACE"
  | "LEFT_BRACKET"
  | "RIGHT_BRACKET"
  | "LEFT_PAREN"
  | "RIGHT_PAREN"
  | "COMMA"
  | "VALUE"
  | "SYMBOL"
  | "OPERATOR"
  | "COLON";

interface Token {
  type: TKind;
  value: string;
  originalValue?: string;
  size?: number;
  varName?: string;
}

const STATIC_TOKEN_MAP: { [key: string]: TKind } = {
  "{": "LEFT_BRACE",
  "}": "RIGHT_BRACE",
  "[": "LEFT_BRACKET",
  "]": "RIGHT_BRACKET",
  ":": "COLON",
  ",": "COMMA",
  "(": "LEFT_PAREN",
  ")": "RIGHT_PAREN",
};

// note that the space after typeof is relevant. It makes sure that the formatted
// expression has a space after typeof
const OPERATORS = "...,.,===,==,+,!==,!=,!,||,&&,>=,>,<=,<,?,-,*,/,%,typeof ,=>,=,;,in ".split(",");

type Tokenizer = (expr: string) => Token | false;

let tokenizeString: Tokenizer = function (expr) {
  let s = expr[0];
  let start = s;
  if (s !== "'" && s !== '"') {
    return false;
  }
  let i = 1;
  let cur;
  while (expr[i] && expr[i] !== start) {
    cur = expr[i];
    s += cur;
    if (cur === "\\") {
      i++;
      cur = expr[i];
      if (!cur) {
        throw new Error("Invalid expression");
      }
      s += cur;
    }
    i++;
  }
  if (expr[i] !== start) {
    throw new Error("Invalid expression");
  }
  s += start;
  return { type: "VALUE", value: s };
};

let tokenizeNumber: Tokenizer = function (expr) {
  let s = expr[0];
  if (s && s.match(/[0-9]/)) {
    let i = 1;
    while (expr[i] && expr[i].match(/[0-9]|\./)) {
      s += expr[i];
      i++;
    }
    return { type: "VALUE", value: s };
  } else {
    return false;
  }
};

let tokenizeSymbol: Tokenizer = function (expr) {
  let s = expr[0];
  if (s && s.match(/[a-zA-Z_\$]/)) {
    let i = 1;
    while (expr[i] && expr[i].match(/\w/)) {
      s += expr[i];
      i++;
    }
    if (s in WORD_REPLACEMENT) {
      return { type: "OPERATOR", value: WORD_REPLACEMENT[s], size: s.length };
    }
    return { type: "SYMBOL", value: s };
  } else {
    return false;
  }
};

const tokenizeStatic: Tokenizer = function (expr) {
  const char = expr[0];
  if (char && char in STATIC_TOKEN_MAP) {
    return { type: STATIC_TOKEN_MAP[char], value: char };
  }
  return false;
};

const tokenizeOperator: Tokenizer = function (expr) {
  for (let op of OPERATORS) {
    if (expr.startsWith(op)) {
      return { type: "OPERATOR", value: op };
    }
  }
  return false;
};

const TOKENIZERS = [
  tokenizeString,
  tokenizeNumber,
  tokenizeOperator,
  tokenizeSymbol,
  tokenizeStatic,
];

/**
 * Convert a javascript expression (as a string) into a list of tokens. For
 * example: `tokenize("1 + b")` will return:
 * ```js
 *  [
 *   {type: "VALUE", value: "1"},
 *   {type: "OPERATOR", value: "+"},
 *   {type: "SYMBOL", value: "b"}
 * ]
 * ```
 */
export function tokenize(expr: string): Token[] {
  const result: Token[] = [];
  let token: boolean | Token = true;

  while (token) {
    expr = expr.trim();
    if (expr) {
      for (let tokenizer of TOKENIZERS) {
        token = tokenizer(expr);
        if (token) {
          result.push(token);
          expr = expr.slice(token.size || token.value.length);
          break;
        }
      }
    } else {
      token = false;
    }
  }
  if (expr.length) {
    throw new Error(`Tokenizer error: could not tokenize "${expr}"`);
  }
  return result;
}

//------------------------------------------------------------------------------
// Expression "evaluator"
//------------------------------------------------------------------------------

/**
 * This is the main function exported by this file. This is the code that will
 * process an expression (given as a string) and returns another expression with
 * proper lookups in the context.
 *
 * Usually, this kind of code would be very simple to do if we had an AST (so,
 * if we had a javascript parser), since then, we would only need to find the
 * variables and replace them.  However, a parser is more complicated, and there
 * are no standard builtin parser API.
 *
 * Since this method is applied to simple javasript expressions, and the work to
 * be done is actually quite simple, we actually can get away with not using a
 * parser, which helps with the code size.
 *
 * Here is the heuristic used by this method to determine if a token is a
 * variable:
 * - by default, all symbols are considered a variable
 * - unless the previous token is a dot (in that case, this is a property: `a.b`)
 * - or if the previous token is a left brace or a comma, and the next token is
 *   a colon (in that case, this is an object key: `{a: b}`)
 *
 * Some specific code is also required to support arrow functions. If we detect
 * the arrow operator, then we add the current (or some previous tokens) token to
 * the list of variables so it does not get replaced by a lookup in the context
 */
export function compileExprToArray(expr: string, scope: { [key: string]: QWebVar }): Token[] {
  scope = Object.create(scope);
  const tokens = tokenize(expr);
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    let prevToken = tokens[i - 1];
    let nextToken = tokens[i + 1];
    let isVar = token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value);
    if (token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value)) {
      if (prevToken) {
        if (prevToken.type === "OPERATOR" && prevToken.value === ".") {
          isVar = false;
        } else if (prevToken.type === "LEFT_BRACE" || prevToken.type === "COMMA") {
          if (nextToken && nextToken.type === "COLON") {
            isVar = false;
          }
        }
      }
    }
    if (nextToken && nextToken.type === "OPERATOR" && nextToken.value === "=>") {
      if (token.type === "RIGHT_PAREN") {
        let j = i - 1;
        while (j > 0 && tokens[j].type !== "LEFT_PAREN") {
          if (tokens[j].type === "SYMBOL" && tokens[j].originalValue) {
            tokens[j].value = tokens[j].originalValue!;
            scope[tokens[j].value] = { id: tokens[j].value, expr: tokens[j].value };
          }
          j--;
        }
      } else {
        scope[token.value] = { id: token.value, expr: token.value };
      }
    }

    if (isVar) {
      token.varName = token.value;
      if (token.value in scope && "id" in scope[token.value]) {
        token.value = scope[token.value].expr!;
      } else {
        token.originalValue = token.value;
        token.value = `scope['${token.value}']`;
      }
    }
  }
  return tokens;
}

export function compileExpr(expr: string, scope: { [key: string]: QWebVar }): string {
  return compileExprToArray(expr, scope)
    .map((t) => t.value)
    .join("");
}
