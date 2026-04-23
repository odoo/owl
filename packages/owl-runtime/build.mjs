import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

const ES_FILENAME = "dist/owl-runtime.es.js";
const CJS_FILENAME = "dist/owl-runtime.cjs.js";

function getGitHash() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const define = {
  __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  __BUILD_HASH__: JSON.stringify(getGitHash()),
};

async function buildBundle() {
  const common = {
    entryPoints: ["src/index.ts"],
    bundle: true,
    define,
    target: "es2022",
    external: ["@odoo/owl-core", "@odoo/owl-compiler"],
  };
  await Promise.all([
    esbuild.build({ ...common, outfile: ES_FILENAME, format: "esm" }),
    esbuild.build({ ...common, outfile: CJS_FILENAME, format: "cjs" }),
  ]);
}

function buildTypes() {
  mkdirSync("dist/types", { recursive: true });
  // Keep sibling package types as external imports instead of inlining them —
  // owl-compiler exports opaque `TemplateSet = any` and `BDom = any` that
  // would otherwise collide with owl-runtime's own `TemplateSet` class.
  execSync(
    "npx dts-bundle-generator --project tsconfig.json -o dist/types/index.d.ts src/index.ts --no-banner --external-imports @odoo/owl-core --external-imports @odoo/owl-compiler",
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
