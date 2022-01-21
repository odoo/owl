import type { BDom } from "../blockdom";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";

export type Template = (context: any, vnode: any, key?: string) => BDom;

export type TemplateFunction = (blocks: any, utils: any) => Template;

interface CompileOptions extends Config {
  name?: string;
  nameSpace?: string,
}
export function compile(template: string | Node, options: CompileOptions = {}): TemplateFunction {
  // parsing
  const ast = parse(template);

  // some work
  const hasSafeContext =
    template instanceof Node
      ? !(template instanceof Element) || template.querySelector("[t-set], [t-call]") === null
      : !template.includes("t-set") && !template.includes("t-call");

  // code generation
  console.log("compile", options)
  const codeGenerator = new CodeGenerator(ast, { ...options, hasSafeContext });
  const code = codeGenerator.generateCode();
  console.log(code)
  // template function
  return new Function("bdom, helpers", code) as TemplateFunction;
}
