import { version } from "./package.json";

// rollup.config.js
export default {
  input: "dist/core/src/index.js",
  output: {
    file: "dist/core.js",
    format: "iife",
    name: "odoo",
    extend: true,
    outro: `exports.core.version = '${version}';`
  }
};
