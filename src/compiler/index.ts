import type { TemplateSet } from "../app/template_set";
import type { BDom } from "../blockdom";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";

export type Template = (context: any, vnode: any, key?: string) => BDom;

export type TemplateFunction = (app: TemplateSet, bdom: any, helpers: any) => Template;

interface CompileOptions extends Config {
  name?: string;
}
export function compile(
  template: string | Element,
  options: CompileOptions = {}
): TemplateFunction {
  // parsing
  const ast = parse(template);

  // some work
  const hasSafeContext =
    template instanceof Node
      ? !(template instanceof Element) || template.querySelector("[t-set], [t-call]") === null
      : !template.includes("t-set") && !template.includes("t-call");

  // code generation
  const codeGenerator = new CodeGenerator(ast, { ...options, hasSafeContext });
  const code = codeGenerator.generateCode();
  // template function
  return new Function("app, bdom, helpers", code) as TemplateFunction;
}
