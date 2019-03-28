import { version } from "./package.json";
import git from "git-rev-sync";

// rollup.config.js
export default {
  input: "dist/owl/src/index.js",
  output: {
    file: "dist/owl.js",
    format: "iife",
    name: "owl",
    extend: true,
    outro: `exports._version = '${version}';\nexports._date = '${new Date().toISOString()}';\nexports._hash = '${git.short()}';`
  }
};
