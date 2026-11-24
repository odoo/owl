#!/usr/bin/env node

// this is the "compile_owl_templates" command that owl makes available when
// installed as a node_module: it compiles the templates of the given xml files
// (or folders) into a js file.
//
//   compile_owl_templates path/to/templates -o templates.js
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: {
      type: "string",
      short: "o",
      default: "templates.js",
    },
  },
});

// The compiler needs a DOM, provided by jsdom. It is an optional dependency of
// owl, since only this command needs it.
let compileTemplates;
try {
  ({ compileTemplates } = await import("../dist/compile_templates.mjs"));
} catch (e) {
  if (e.code === "ERR_MODULE_NOT_FOUND" && e.message.includes("'jsdom'")) {
    console.error("compile_owl_templates needs jsdom: npm install --save-dev jsdom");
    process.exit(1);
  }
  throw e;
}

if (positionals.length) {
  const result = await compileTemplates(positionals);
  const outputPath = values.output;
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(outputPath, result);
} else {
  console.log("Please provide a path");
}
