import { version } from "./package.json";
import git from "git-rev-sync";

// rollup.config.js
export default {
  input: "dist/core/src/index.js",
  output: {
    file: "dist/core.js",
    format: "iife",
    name: "odoo",
    extend: true,
    outro: `exports.core._version = '${version}';\nexports.core._date = '${new Date().toISOString()}';\nexports.core._hash = '${git.short()}';`
  }
};
