import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

const ES_FILENAME = "dist/owl-compiler.es.js";
const CJS_FILENAME = "dist/owl-compiler.cjs.js";

async function buildBundle() {
  const common = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    target: "es2022",
  };
  await Promise.all([
    esbuild.build({ ...common, outfile: ES_FILENAME, format: "esm" }),
    esbuild.build({ ...common, outfile: CJS_FILENAME, format: "cjs" }),
    esbuild.build({
      entryPoints: ["src/standalone/index.ts"],
      outfile: "dist/compile_templates.mjs",
      bundle: true,
      format: "esm",
      target: "es2022",
      platform: "node",
      external: ["fs", "fs/promises", "path", "jsdom"],
    }),
  ]);
}

function buildTypes() {
  mkdirSync("dist/types", { recursive: true });
  execSync(
    "npx dts-bundle-generator --project tsconfig.json -o dist/types/index.d.ts src/index.ts --no-banner",
    { stdio: "inherit" }
  );
}

const target = process.argv[2];

switch (target) {
  case "types":
    buildTypes();
    break;
  default:
    await buildBundle();
}
