import pkg from "./package.json";
import git from "git-rev-sync";
import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";
import dts from "rollup-plugin-dts";

let input, output;

const IIFE_FILENAME = "dist/owl.iife.js";
const CJS_FILENAME = "dist/owl.cjs.js";
const ES_FILENAME = "dist/owl.es.js";

if (pkg.module !== ES_FILENAME || pkg.main !== CJS_FILENAME) {
  throw new Error("package.json has been modified. Build script should be updated accordingly");
}  

const outro = `
__info__.date = '${new Date().toISOString()}';
__info__.hash = '${git.short()}';
__info__.url = 'https://github.com/odoo/owl';
`;

switch (process.argv[4]) {
  case "compiler": 
    input = "src/compiler/index.ts",
    output = [
      getConfigForFormat('cjs', 'dist/compiler.js', ''),
    ]
    break;
  case "runtime":
    input = "src/runtime/index.ts";
    output = [
      getConfigForFormat('esm', addSuffix(ES_FILENAME,  'runtime'), outro),
      getConfigForFormat('cjs', addSuffix(CJS_FILENAME,  'runtime'), outro),
      getConfigForFormat('iife', addSuffix(IIFE_FILENAME,  'runtime'), outro),
      getConfigForFormat('iife', addSuffix(IIFE_FILENAME,  'runtime'), outro, true),
    ]
    break;
  default:
    input = "src/index.ts",
    output = [
      getConfigForFormat('esm', ES_FILENAME, outro),
      getConfigForFormat('cjs', CJS_FILENAME, outro),
      getConfigForFormat('iife', IIFE_FILENAME, outro),
      getConfigForFormat('iife', IIFE_FILENAME, outro, true),
    ]
  }

/**
 * Generate from a string depicting a path a new path for the minified version.
 * @param {string} pkgFileName file name
 */
function addSuffix(pkgFileName, suffix) {
  const parts = pkgFileName.split('.');
  parts.splice(parts.length - 1, 0, suffix);
  return parts.join('.');
}

/**
 * Get the rollup config based on the arguments
 * @param {string} format format of the bundle
 * @param {string} generatedFileName generated file name
 * @param {boolean} minified should it be minified
 */
function getConfigForFormat(format, generatedFileName, outro, minified = false) {
  return {
    file: minified ? addSuffix(generatedFileName, "min") : generatedFileName,
    format: format,
    name: "owl",
    extend: true,
    outro: outro,
    freeze: false,
    plugins: minified ? [terser()] : [],
    indent: '    ', // indent with 4 spaces
  };
}

export default [
  {
    input,
    output,
    plugins: [
      typescript({
        useTsconfigDeclarationDir: true
      }),
    ]
  },
  {
    input: "dist/types/index.d.ts",
    output: [{ file: "dist/types/owl.d.ts", format: "es" }],
    plugins: [dts()],
  },
];
