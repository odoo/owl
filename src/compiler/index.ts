import type { BDom } from "../blockdom";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";

export type Template = (context: any, vnode: any, key?: string) => BDom;

export type TemplateFunction = (blocks: any, utils: any) => Template;

interface CompileOptions extends Config {
  name?: string;
}
let nextId = 1;
export function compile(template: string | Node, options: CompileOptions = {}): TemplateFunction {
  // parsing
  const ast = parse(template);

  // some work
  const hasSafeContext =
    template instanceof Node
      ? !(template instanceof Element) || template.querySelector("[t-set], [t-call]") === null
      : !template.includes("t-set") && !template.includes("t-call");
  const name = options.name || `template_${nextId++}`;

  // code generation
  const codeGenerator = new CodeGenerator(name, ast, { ...options, hasSafeContext });
  const code = codeGenerator.generateCode();

  // template function
  return new Function("bdom, helpers", code) as TemplateFunction;
}
