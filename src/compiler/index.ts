import type { TemplateSet } from "../runtime/template_set";
import type { BDom } from "../runtime/blockdom";
import { CodeGenerator, Config } from "./code_generator";
import { parse, ASTType } from "./parser";
import type { AST } from "./parser";
import { OwlError } from "../common/owl_error";

export type CustomDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Template = (context: any, vnode: any, key?: string) => BDom;

export type TemplateFunction = (app: TemplateSet, bdom: any, helpers: any) => Template;

interface CompileOptions extends Config {
  name?: string;
  customDirectives?: CustomDirectives;
  hasGlobalValues: boolean;
}
function hasDirectTSet(ast: AST | AST[] | null | undefined): boolean {
  if (!ast) return false;
  if (Array.isArray(ast)) return ast.some(hasDirectTSet);
  switch (ast.type) {
    case ASTType.TSet:
      return true;
    case ASTType.TComponent:
    case ASTType.TCall:
    case ASTType.TPortal:
      return false; // content compiled as separate functions
    case ASTType.DomNode:
    case ASTType.Multi:
      return hasDirectTSet((ast as any).content);
    case ASTType.TIf:
      return (
        hasDirectTSet(ast.content) ||
        !!(ast.tElif?.some((e) => hasDirectTSet(e.content))) ||
        hasDirectTSet(ast.tElse)
      );
    case ASTType.TForEach:
      return hasDirectTSet(ast.body);
    case ASTType.TKey:
    case ASTType.TDebug:
    case ASTType.TLog:
    case ASTType.TTranslation:
    case ASTType.TTranslationContext:
      return hasDirectTSet((ast as any).content);
    default:
      return false;
  }
}

export function compile(
  template: string | Element,
  options: CompileOptions = {
    hasGlobalValues: false,
  }
): TemplateFunction {
  // parsing
  const ast = parse(template, options.customDirectives);

  // some work
  const hasSafeContext = !hasDirectTSet(ast);

  // code generation
  const codeGenerator = new CodeGenerator(ast, { ...options, hasSafeContext });
  const code = codeGenerator.generateCode();
  // template function
  try {
    return new Function("app, bdom, helpers", code) as TemplateFunction;
  } catch (originalError: any) {
    const { name } = options;
    const nameStr = name ? `template "${name}"` : "anonymous template";
    const err = new OwlError(
      `Failed to compile ${nameStr}: ${originalError.message}\n\ngenerated code:\nfunction(app, bdom, helpers) {\n${code}\n}`
    );
    err.cause = originalError;
    throw err;
  }
}
