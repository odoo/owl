import { OwlError } from "@odoo/owl-core";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";
import type { ComponentHelpers, TemplateBlockDom, TemplateHelpers } from "./template_contract";

export type { ComponentHelpers, TemplateBlockDom, TemplateHelpers } from "./template_contract";

export type CustomDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

// `any` for the app (TemplateSet): the compiler only passes it through to the
// helpers; its concrete shape lives in `@odoo/owl-runtime` and the compiler
// never inspects it. Keeping it as an opaque named type alias would cause name
// collisions when owl-runtime re-exports its own `TemplateSet` class through
// its bundled d.ts. `bdom` and `helpers` are described by the template
// contract (see template_contract.ts).
export type Template = (context: any, vnode: any, key?: string) => any;

export type TemplateFunction = (
  app: any,
  bdom: TemplateBlockDom,
  helpers: TemplateHelpers & ComponentHelpers
) => Template;

interface CompileOptions extends Config {
  name?: string;
  customDirectives?: CustomDirectives;
  hasGlobalValues: boolean;
}

export function compile(
  template: string | Element,
  options: CompileOptions = {
    hasGlobalValues: false,
  }
): TemplateFunction {
  // parsing
  const ast = parse(template, options.customDirectives);

  // code generation
  const codeGenerator = new CodeGenerator(ast, options);
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

export { parseXML } from "./parse_xml";
