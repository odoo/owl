import { version } from "./package.json";
import git from "git-rev-sync";

// rollup.config.js
export default {
  input: "dist/owl/index.js",
  output: {
    file: "dist/owl.js",
    format: "iife",
    name: "owl",
    extend: true,
    outro: `exports.__info__.version = '${version}';\nexports.__info__.date = '${new Date().toISOString()}';\nexports.__info__.hash = '${git.short()}';\nexports.__info__.url = 'https://github.com/odoo/owl';`
  }
};
