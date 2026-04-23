import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { readFileSync, mkdirSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const IIFE_FILENAME = "dist/owl.iife.js";
const CJS_FILENAME = "dist/owl.cjs.js";
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
  };

  await Promise.all([
    esbuild.build({ ...common, outfile: esm, format: "esm" }),
    esbuild.build({ ...common, outfile: cjs, format: "cjs" }),
    esbuild.build({ ...common, outfile: iife, format: "iife", globalName: "owl" }),
    esbuild.build({ ...common, outfile: iifeMin, format: "iife", globalName: "owl", minify: true }),
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
