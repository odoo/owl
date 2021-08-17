import { setupBlockDom } from "./helpers";
import { QWebCompiler, TemplateFunction } from "./qweb_compiler";
export { Template, TemplateFunction } from "./qweb_compiler";

setupBlockDom();

export function compileTemplate(template: string, name?: string): TemplateFunction {
  const compiler = new QWebCompiler(template, name);
  return compiler.compile();
}
