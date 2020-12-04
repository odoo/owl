import { QWebCompiler, TemplateFunction } from "./compiler";
export { RenderFunction, TemplateFunction } from "./compiler";

export function compileTemplate(template: string, name?: string): TemplateFunction {
  const compiler = new QWebCompiler(template, name);
  return compiler.compile();
}
