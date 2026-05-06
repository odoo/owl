#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { parseArgs } from "util";
import { compileTemplates, watchAndCompile } from "../dist/compile_templates.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: {
      type: "string",
      short: "o",
      default: "templates.js",
    },
    watch: {
      type: "boolean",
      short: "w",
      default: false,
    },
  },
});

if (!positionals.length) {
  console.error("Usage: compile_owl_templates <path...> [-o output] [--watch]");
  process.exit(1);
}

const outputPath = values.output;
const dir = dirname(outputPath);
if (dir && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

if (values.watch) {
  await watchAndCompile(positionals, outputPath);
} else {
  const result = await compileTemplates(positionals);
  writeFileSync(outputPath, result);
}
