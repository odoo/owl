import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const monacoRoot = path.resolve(
  rootDir,
  "node_modules/monaco-editor/esm/vs"
);

const outputFile = path.resolve(
  __dirname,
  "libs/monaco/monaco.bundle.js"
);

// monaco-vim's ESM build imports monaco-editor submodules (e.g.
// "monaco-editor/esm/vs/editor/editor.api") without a ".js" extension.
// monaco-editor's package.json "exports" map ("./*": "./*") only matches
// literal file paths, so esbuild can't resolve those on its own — add the
// extension back ourselves.
const monacoEsmExtensionPlugin = {
  name: "monaco-editor-esm-js-extension",
  setup(build) {
    build.onResolve({ filter: /^monaco-editor\/esm\/vs\// }, (args) => {
      if (args.path.endsWith(".js")) {
        return null;
      }
      const rel = args.path.slice("monaco-editor/esm/vs/".length);
      return { path: path.join(monacoRoot, rel + ".js") };
    });
  },
};

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
import { initVimMode } from "monaco-vim";

export const {
  editor,
  languages,
  Uri,
  Range,
  KeyMod,
  KeyCode,
  typescript,
} = monaco;

export { initVimMode };
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
    // monaco-vim's "exports" map picks its standalone UMD build under the
    // "browser" condition, which bundles its own separate copy of
    // monaco-editor's internals. Alias straight to its ESM build instead,
    // so it shares this bundle's single monaco-editor module graph.
    alias: {
      "monaco-vim": path.resolve(
        rootDir,
        "node_modules/monaco-vim/dist/index.mjs"
      ),
    },
    plugins: [monacoEsmExtensionPlugin],
    loader: {
      ".ttf": "file",
      ".css": "css",
    },

    assetNames: "[name]",
  });

  await esbuild.build({
    entryPoints: {
      "editor.worker": path.join(
        monacoRoot,
        "editor/editor.worker.js"
      ),

      "ts.worker": path.join(
        monacoRoot,
        "language/typescript/ts.worker.js"
      ),

      "css.worker": path.join(
        monacoRoot,
        "language/css/css.worker.js"
      ),

      "html.worker": path.join(
        monacoRoot,
        "language/html/html.worker.js"
      ),
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
