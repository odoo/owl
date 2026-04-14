import * as esbuild from "esbuild";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const externalsPlugin = {
  name: "playground-externals",
  setup(build) {
    build.onResolve({ filter: /^@odoo\/owl$/ }, () => ({
      path: "../owl.js",
      external: true,
    }));
    build.onResolve({ filter: /^@libs\/codemirror$/ }, () => ({
      path: "./libs/codemirror.bundle.js",
      external: true,
    }));
  },
};

await esbuild.build({
  entryPoints: ["src/playground.js"],
  outfile: "../../docs/playground/playground.js",
  bundle: true,
  format: "esm",
  absWorkingDir: __dirname,
  plugins: [externalsPlugin],
});
