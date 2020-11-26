import pkg from "./package.json";
import git from "git-rev-sync";
import typescript from 'rollup-plugin-typescript2';
import { terser } from "rollup-plugin-terser";

const name = "owl";
const extend = true;

/**
 * Meta data to be added on the __info__ object.
 * Used to let external tools know the current owl version.
 */
const outro = `
__info__.version = '${pkg.version}';
__info__.date = '${new Date().toISOString()}';
__info__.hash = '${git.short()}';
__info__.url = 'https://github.com/odoo/owl';
`;

/**
 * Generate from a string depicting a path a new path for the minified version.
 * @param {string} pkgFileName file name
 */
function generateMinifiedNameFromPkgName(pkgFileName) {
  const parts = pkgFileName.split('.');
  parts.splice(parts.length - 1, 0, "min");
  return parts.join('.');
}

/**
 * Get the rollup config based on the arguments
 * @param {string} format format of the bundle
 * @param {string} generatedFileName generated file name
 * @param {boolean} minified should it be minified
 */
function getConfigForFormat(format, generatedFileName, minified = false) {
  return {
    file: minified ? generateMinifiedNameFromPkgName(generatedFileName) : generatedFileName,
    format: format,
    name: name,
    extend: extend,
    outro: outro,
    freeze: false,
    plugins: minified ? [terser()] : [],
    indent: '    ', // indent with 4 spaces
  };
}

export default {
  input: "src/index.ts",
  output: [

    /**
     * Read about module formats:
     *  https://auth0.com/blog/javascript-module-systems-showdown/
     *  https://medium.com/@kelin2025/so-you-wanna-use-es6-modules-714f48b3a953
     */

    getConfigForFormat('esm', pkg.module),
    getConfigForFormat('esm', pkg.module, true),
    getConfigForFormat('cjs', pkg.main),
    getConfigForFormat('cjs', pkg.main, true),
    getConfigForFormat('iife', pkg.browser),
    getConfigForFormat('iife', pkg.browser, true),
  ],
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true
    }),
  ]
};
