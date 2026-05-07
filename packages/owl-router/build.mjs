import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

const ES_FILENAME = "dist/owl-router.es.js";
const CJS_FILENAME = "dist/owl-router.cjs.js";

async function buildBundle() {
  const common = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    target: "es2022",
    external: ["@odoo/owl-core", "@odoo/owl-runtime"],
  };
  await Promise.all([
    esbuild.build({ ...common, outfile: ES_FILENAME, format: "esm" }),
    esbuild.build({ ...common, outfile: CJS_FILENAME, format: "cjs" }),
  ]);
}

function buildTypes() {
  mkdirSync("dist/types", { recursive: true });
  execSync(
    "npx dts-bundle-generator --project tsconfig.json -o dist/types/index.d.ts src/index.ts --no-banner --external-imports @odoo/owl-core --external-imports @odoo/owl-runtime",
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
