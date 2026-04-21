import { OwlError } from "@odoo/owl-core";
import { CodeGenerator, Config } from "./code_generator";
import { parse } from "./parser";

// Opaque types for values produced/consumed at runtime. The concrete shapes
// live in `@odoo/owl-runtime`; owl-compiler only needs them as type labels
// and never inspects them, so `any` avoids forcing consumers to cast.
export type BDom = any;
export type TemplateSet = any;

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
