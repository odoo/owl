import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

const outputFile = path.resolve(
  __dirname,
  "libs/monaco/monaco.bundle.js"
);

const tempEntry = path.resolve(
  rootDir,
  "temp_monaco_entry.mjs"
);

fs.writeFileSync(
  tempEntry,
  `
import * as monaco from "monaco-editor/esm/vs/editor/editor.main.js";
import "monaco-editor/esm/vs/language/css/monaco.contribution.js";
import "monaco-editor/esm/vs/language/html/monaco.contribution.js";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";

export const {
  editor,
  Uri,
  typescript,
} = monaco;
`
);

const tempShikiEntry = path.resolve(
  rootDir,
  "temp_shiki_entry.mjs",
);

fs.writeFileSync(
  tempShikiEntry,
  `
import { createHighlighter } from "shiki";
import { shikiToMonaco } from "@shikijs/monaco";
import oneDarkPro from "@shikijs/themes/one-dark-pro";

export {
  createHighlighter,
  shikiToMonaco,
  oneDarkPro
}
`
);

console.log("Bundling Monaco...");

try {
  await esbuild.build({
    entryPoints: [tempEntry],
    outfile: outputFile,
    bundle: true,
    format: "esm",
    minify: true,
    target: "es2022",
    loader: {
      ".ttf": "file",
      ".css": "css",
    },

    assetNames: "[name]",
  });

  await esbuild.build({
    entryPoints: {
      "editor.worker":
        "node_modules/monaco-editor/esm/vs/editor/editor.worker.js",

      "ts.worker":
        "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js",

      "css.worker":
        "node_modules/monaco-editor/esm/vs/language/css/css.worker.js",

      "html.worker":
        "node_modules/monaco-editor/esm/vs/language/html/html.worker.js",
    },

    outdir: path.resolve(__dirname, "libs/workers"),
    bundle: true,
    format: "iife",
    splitting: false,
    target: "es2022",
    minify: true,
  });

  await esbuild.build({
    entryPoints: [
      tempShikiEntry,
    ],
    outfile: path.resolve(
      __dirname,
      "libs/monaco/shiki.bundle.js"
    ),
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
  });

  const staticDir = path.resolve(__dirname, "static");

  const cssFile = path.resolve(__dirname, "libs/monaco/monaco.bundle.css");
  const fontFile = path.resolve(__dirname, "libs/monaco/codicon.ttf");

  if (fs.existsSync(cssFile)) {
    fs.renameSync(
      cssFile,
      path.join(staticDir, "monaco.bundle.css")
    );
  }

  if (fs.existsSync(fontFile)) {
    fs.renameSync(
      fontFile,
      path.join(staticDir, "codicon.ttf")
    );
  }

  const size = fs.statSync(outputFile);

  console.log(
    `Bundle size: ${(size.size / 1024 / 1024).toFixed(2)} MB`
  );
} finally {
  fs.unlinkSync(tempEntry);
  fs.unlinkSync(tempShikiEntry);
}

console.log("\nDone!");
