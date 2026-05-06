// JIT entry point: templates are compiled in the browser at startup.
// To switch to AOT (smaller bundle, no compiler at runtime), edit index.html
// to point at /src/main.aot.js instead.
import { mount, TemplateSet } from "@odoo/owl-runtime";
import { compile, parseXML } from "@odoo/owl-compiler";
import { App } from "./App.js";

TemplateSet.compile = compile;
TemplateSet.parseXML = parseXML;

const modules = import.meta.glob("./**/*.xml", {
  query: "?raw",
  eager: true,
  import: "default",
});

const templates = `<templates>${Object.values(modules)
  .map((s) => s.replace(/<\/?templates>/g, ""))
  .join("")}</templates>`;

mount(App, document.body, { templates });
