import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { readFileSync, mkdirSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const IIFE_FILENAME = "dist/owl.iife.js";
const CJS_FILENAME = "dist/owl.cjs";
const ES_FILENAME = "dist/owl.es.js";

if (pkg.module !== ES_FILENAME || pkg.main !== CJS_FILENAME) {
  throw new Error("package.json has been modified. Build script should be updated accordingly");
}

function getGitHash() {
  return execSync("git rev-parse --short HEAD").toString().trim();
}

function addSuffix(filename, suffix) {
  const parts = filename.split(".");
  parts.splice(parts.length - 1, 0, suffix);
  return parts.join(".");
}

const define = {
  __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  __BUILD_HASH__: JSON.stringify(getGitHash()),
};

async function buildVariant(entry, suffix) {
  const esm = suffix ? addSuffix(ES_FILENAME, suffix) : ES_FILENAME;
  const cjs = suffix ? addSuffix(CJS_FILENAME, suffix) : CJS_FILENAME;
  const iife = suffix ? addSuffix(IIFE_FILENAME, suffix) : IIFE_FILENAME;
  const iifeMin = addSuffix(iife, "min");

  const common = {
    entryPoints: [entry],
    bundle: true,
    define,
    target: "es2022",
    // Force owl-core to resolve to its built dist file. Without this, esbuild
    // picks up the `paths` mapping in owl-runtime/tsconfig.json and pulls
    // owl-core's source in addition to its dist via owl-compiler — bundling
    // owl-core twice.
    alias: {
      "@odoo/owl-core": "../owl-core/dist/owl-core.es.js",
    },
  };

  // esbuild exposes the exports of an iife bundle as getters, which cannot be
  // reassigned. Replace the `owl` global with a plain copy, so that code using
  // it (e.g. Odoo) can override them. No export is a live binding (`export
  // let`), so nothing is lost by copying.
  const iifeOptions = { format: "iife", globalName: "owl", footer: { js: "owl = { ...owl };" } };

  await Promise.all([
    esbuild.build({ ...common, outfile: esm, format: "esm" }),
    esbuild.build({ ...common, outfile: cjs, format: "cjs" }),
    esbuild.build({ ...common, ...iifeOptions, outfile: iife }),
    esbuild.build({ ...common, ...iifeOptions, outfile: iifeMin, minify: true }),
  ]);
}

function buildTypes() {
  mkdirSync("dist/types", { recursive: true });
  execSync(
    "npx dts-bundle-generator --project tsconfig.types.json -o dist/types/owl.d.ts src/index.ts --no-banner",
    { stdio: "inherit" }
  );
}

const target = process.argv[2];

switch (target) {
  case "types":
    buildTypes();
    break;
  default:
    await buildVariant("src/index.ts");
}
