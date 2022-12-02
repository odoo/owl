import { OwlError } from "../runtime/error_handling";

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

const RESERVED_WORDS =
  "true,false,NaN,null,undefined,debugger,console,window,in,instanceof,new,function,return,eval,void,Math,RegExp,Array,Object,Date".split(
    ","
  );

const WORD_REPLACEMENT: { [key: string]: string } = Object.assign(Object.create(null), {
  and: "&&",
  or: "||",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
});

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
  | "TEMPLATE_STRING"
  | "SYMBOL"
  | "OPERATOR"
  | "COLON";

interface Token {
  type: TKind;
  value: string;
  originalValue?: string;
  size?: number;
  varName?: string;
  replace?: Function;
  isLocal?: boolean;
}

const STATIC_TOKEN_MAP: { [key: string]: TKind } = Object.assign(Object.create(null), {
  "{": "LEFT_BRACE",
  "}": "RIGHT_BRACE",
  "[": "LEFT_BRACKET",
  "]": "RIGHT_BRACKET",
  ":": "COLON",
  ",": "COMMA",
  "(": "LEFT_PAREN",
  ")": "RIGHT_PAREN",
});

// note that the space after typeof is relevant. It makes sure that the formatted
// expression has a space after typeof. Currently we don't support delete and void
const OPERATORS =
  "...,.,===,==,+,!==,!=,!,||,&&,>=,>,<=,<,?,-,*,/,%,typeof ,=>,=,;,in ,new ,|,&,^,~".split(",");

type Tokenizer = (expr: string) => Token | false;

let tokenizeString: Tokenizer = function (expr) {
  let s = expr[0];
  let start = s;
  if (s !== "'" && s !== '"' && s !== "`") {
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
        throw new OwlError("Invalid expression");
      }
      s += cur;
    }
    i++;
  }
  if (expr[i] !== start) {
    throw new OwlError("Invalid expression");
  }
  s += start;
  if (start === "`") {
    return {
      type: "TEMPLATE_STRING",
      value: s,
      replace(replacer: any) {
        return s.replace(/\$\{(.*?)\}/g, (match, group) => {
          return "${" + replacer(group) + "}";
        });
      },
    };
  }
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
  let error: any;
  let current = expr;

  try {
    while (token) {
      current = current.trim();
      if (current) {
        for (let tokenizer of TOKENIZERS) {
          token = tokenizer(current);
          if (token) {
            result.push(token);
            current = current.slice(token.size || token.value.length);
            break;
          }
        }
      } else {
        token = false;
      }
    }
  } catch (e) {
    error = e; // Silence all errors and throw a generic error below
  }
  if (current.length || error) {
    throw new OwlError(`Tokenizer error: could not tokenize \`${expr}\``);
  }
  return result;
}

//------------------------------------------------------------------------------
// Expression "evaluator"
//------------------------------------------------------------------------------

const isLeftSeparator = (token: Token) =>
  token && (token.type === "LEFT_BRACE" || token.type === "COMMA");
const isRightSeparator = (token: Token) =>
  token && (token.type === "RIGHT_BRACE" || token.type === "COMMA");

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
export function compileExprToArray(expr: string): Token[] {
  const localVars = new Set<string>();
  const tokens = tokenize(expr);
  let i = 0;
  let stack = []; // to track last opening [ or {

  while (i < tokens.length) {
    let token = tokens[i];
    let prevToken = tokens[i - 1];
    let nextToken = tokens[i + 1];
    let groupType = stack[stack.length - 1];

    switch (token.type) {
      case "LEFT_BRACE":
      case "LEFT_BRACKET":
        stack.push(token.type);
        break;
      case "RIGHT_BRACE":
      case "RIGHT_BRACKET":
        stack.pop();
    }

    let isVar = token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value);
    if (token.type === "SYMBOL" && !RESERVED_WORDS.includes(token.value)) {
      if (prevToken) {
        // normalize missing tokens: {a} should be equivalent to {a:a}
        if (
          groupType === "LEFT_BRACE" &&
          isLeftSeparator(prevToken) &&
          isRightSeparator(nextToken)
        ) {
          tokens.splice(i + 1, 0, { type: "COLON", value: ":" }, { ...token });
          nextToken = tokens[i + 1];
        }

        if (prevToken.type === "OPERATOR" && prevToken.value === ".") {
          isVar = false;
        } else if (prevToken.type === "LEFT_BRACE" || prevToken.type === "COMMA") {
          if (nextToken && nextToken.type === "COLON") {
            isVar = false;
          }
        }
      }
    }
    if (token.type === "TEMPLATE_STRING") {
      token.value = token.replace!((expr: any) => compileExpr(expr));
    }
    if (nextToken && nextToken.type === "OPERATOR" && nextToken.value === "=>") {
      if (token.type === "RIGHT_PAREN") {
        let j = i - 1;
        while (j > 0 && tokens[j].type !== "LEFT_PAREN") {
          if (tokens[j].type === "SYMBOL" && tokens[j].originalValue) {
            tokens[j].value = tokens[j].originalValue!;
            localVars.add(tokens[j].value); //] = { id: tokens[j].value, expr: tokens[j].value };
          }
          j--;
        }
      } else {
        localVars.add(token.value); //] = { id: token.value, expr: token.value };
      }
    }

    if (isVar) {
      token.varName = token.value;
      if (!localVars.has(token.value)) {
        token.originalValue = token.value;
        token.value = `ctx['${token.value}']`;
      }
    }
    i++;
  }
  // Mark all variables that have been used locally.
  // This assumes the expression has only one scope (incorrect but "good enough for now")
  for (const token of tokens) {
    if (token.type === "SYMBOL" && token.varName && localVars.has(token.value)) {
      token.originalValue = token.value;
      token.value = `_${token.value}`;
      token.isLocal = true;
    }
  }
  return tokens;
}

// Leading spaces are trimmed during tokenization, so they need to be added back for some values
const paddedValues = new Map([["in ", " in "]]);

export function compileExpr(expr: string): string {
  return compileExprToArray(expr)
    .map((t) => paddedValues.get(t.value) || t.value)
    .join("");
}

export const INTERP_REGEXP = /\{\{.*?\}\}|\#\{.*?\}/g;

export function replaceDynamicParts(s: string, replacer: (s: string) => string) {
  let matches = s.match(INTERP_REGEXP);
  if (matches && matches[0].length === s.length) {
    return `(${replacer(s.slice(2, matches[0][0] === "{" ? -2 : -1))})`;
  }

  let r = s.replace(
    INTERP_REGEXP,
    (s) => "${" + replacer(s.slice(2, s[0] === "{" ? -2 : -1)) + "}"
  );
  return "`" + r + "`";
}
export function interpolate(s: string): string {
  return replaceDynamicParts(s, compileExpr);
}
