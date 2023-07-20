import type { TemplateSet } from "../runtime/template_set";
import type { BDom } from "../runtime/blockdom";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";
import { OwlError } from "../common/owl_error";

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
