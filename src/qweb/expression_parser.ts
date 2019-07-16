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

const RESERVED_WORDS = "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,this,typeof,eval,void,Math,RegExp,Array,Object,Date".split(
  ","
);

const WORD_REPLACEMENT = {
  and: "&&",
  or: "||",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<="
};

export interface QWebExprVar {
  id: string;
  expr: string;
}

export interface QWebXMLVar {
  xml: NodeList;
}

export type QWebVar = QWebExprVar | QWebXMLVar;

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
  size?: number;
}

const STATIC_TOKEN_MAP: { [key: string]: TKind } = {
  "{": "LEFT_BRACE",
  "}": "RIGHT_BRACE",
  "[": "LEFT_BRACKET",
  "]": "RIGHT_BRACKET",
  ":": "COLON",
  ",": "COMMA",
  "(": "LEFT_PAREN",
  ")": "RIGHT_PAREN"
};

const OPERATORS = ".,===,==,+,!==,!=,!,||,&&,>=,>,<=,<,?,-,*,/,%".split(",");

type Tokenizer = (expr: string) => Token | false;

let tokenizeString: Tokenizer = function(expr) {
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

let tokenizeNumber: Tokenizer = function(expr) {
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

let tokenizeSymbol: Tokenizer = function(expr) {
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

const tokenizeStatic: Tokenizer = function(expr) {
  const char = expr[0];
  if (char && char in STATIC_TOKEN_MAP) {
    return { type: STATIC_TOKEN_MAP[char], value: char };
  }
  return false;
};

const tokenizeOperator: Tokenizer = function(expr) {
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
  tokenizeSymbol,
  tokenizeStatic,
  tokenizeOperator
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
 */
export function compileExpr(expr: string, vars: { [key: string]: QWebVar }): string {
  const tokens = tokenize(expr);
  let result = "";
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    if (token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value)) {
      // we need to find if it is a variable
      let isVar = true;
      let prevToken = tokens[i - 1];
      if (prevToken) {
        if (prevToken.type === "OPERATOR" && prevToken.value === ".") {
          isVar = false;
        } else if (prevToken.type === "LEFT_BRACE" || prevToken.type === "COMMA") {
          let nextToken = tokens[i + 1];
          if (nextToken && nextToken.type === "COLON") {
            isVar = false;
          }
        }
      }
      if (isVar) {
        if (token.value in vars && "id" in vars[token.value]) {
          token.value = (<QWebExprVar>vars[token.value]).id;
        } else {
          token.value = `context['${token.value}']`;
        }
      }
    }
    result += token.value;
  }
  return result;
}
