import type { BDom } from "../blockdom";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";

export type Template = (context: any, vnode: any, key?: string) => BDom;

export type TemplateFunction = (blocks: any, utils: any) => Template;

interface CompileOptions extends Config {
  name?: string;
}
export function compile(template: string, options: CompileOptions = {}): TemplateFunction {
  // parsing
  const ast = parse(template);

  // some work
  const hasSafeContext = !template.includes("t-set") && !template.includes("t-call");
  const name = options.name || (template.length > 250 ? template.slice(0, 250) + "..." : template);

  // code generation
  const codeGenerator = new CodeGenerator(name, ast, { ...options, hasSafeContext });
  const code = codeGenerator.generateCode();

  // template function
  return new Function("bdom, helpers", code) as TemplateFunction;
}
