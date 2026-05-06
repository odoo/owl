// JIT entry point: templates are compiled in the browser at startup.
// To switch to AOT (smaller bundle, no compiler at runtime), edit index.html
// to point at /src/main.aot.ts instead.
import { mount, TemplateSet } from "@odoo/owl-runtime";
import { compile, parseXML } from "@odoo/owl-compiler";
import { App } from "./App";

// `as any` because the runtime declares these slots as `null` initialized;
// the umbrella @odoo/owl package does the same wiring at module load.
(TemplateSet as any).compile = compile;
(TemplateSet as any).parseXML = parseXML;

const modules = import.meta.glob("./**/*.xml", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>;

const templates = `<templates>${Object.values(modules)
  .map((s) => s.replace(/<\/?templates>/g, ""))
  .join("")}</templates>`;

mount(App, document.body, { templates });
