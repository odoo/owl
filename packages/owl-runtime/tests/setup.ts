// Wire compile + parseXML into TemplateSet for tests that use xml templates.
import { compile, parseXML } from "@odoo/owl-compiler";
import { TemplateSet } from "../src/template_set";
import { Scheduler } from "../src/rendering/scheduler";

TemplateSet.compile = compile;
TemplateSet.parseXML = parseXML;

// Disable frame budgeting in tests: nextTick() awaits one RAF and expects the
// scheduler fully drained by then. Individual tests that exercise budgeting
// set Scheduler.frameBudgetMs back to a finite value and restore it after.
Scheduler.frameBudgetMs = Infinity;

const consoleOutput: string[] = [];
(globalThis as any).__owl_console_output = consoleOutput;

for (const method of ["warn", "info", "log", "error"] as const) {
  console[method] = (...args: any[]) => {
    consoleOutput.push(`${method}:${args[0]}`);
  };
}

afterEach(() => {
  const remaining = consoleOutput.splice(0);
  if (remaining.length > 0) {
    throw new Error(`Unexpected console output:\n${remaining.join("\n")}`);
  }
});
