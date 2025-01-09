#!/usr/bin/env node

// this is the "compile_owl_templates" command that owl makes available when
// installed as a node_module.
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { compileTemplates } from "../dist/compile_templates.mjs";
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
