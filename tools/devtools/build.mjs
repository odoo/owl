import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { cpSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const browser = args.find((a) => a.startsWith("--browser="))?.split("=")[1] || "chrome";
const env = args.find((a) => a.startsWith("--env="))?.split("=")[1] || "development";
const isProduction = env === "production";
const isChrome = browser === "chrome";
const isWindows = process.platform === "win32";

const DEVTOOLS_SRC = "tools/devtools/src";
const DEVTOOLS_DIST = "dist/devtools";

// ---- Step 1: Pre-build commands (build owl, copy iife, compile templates) ----

if (isProduction) {
  const cmd = isWindows
    ? "npm run build && copy packages\\owl\\dist\\owl.iife.js tools\\devtools\\assets\\owl.js && npm run build:compiler"
    : "npm run build && cp packages/owl/dist/owl.iife.js tools/devtools/assets/owl.js && npm run build:compiler";
  execSync(cmd, { stdio: "inherit" });
} else {
  const cmd = isWindows
    ? "copy packages\\owl\\dist\\owl.iife.js tools\\devtools\\assets\\owl.js"
    : "cp packages/owl/dist/owl.iife.js tools/devtools/assets/owl.js";
  execSync(cmd, { stdio: "inherit" });
}

const compileCmd = isWindows
  ? "npm run compile_templates -- tools\\devtools\\src && move templates.js tools\\devtools\\assets\\templates.js"
  : "npm run compile_templates -- tools/devtools/src && mv templates.js tools/devtools/assets/templates.js";
execSync(compileCmd, { stdio: "inherit" });

// ---- Step 2: Bundle JS entry points with esbuild ----

// Plugin to import owl_devtools_global_hook.js as a string (for Firefox injection)
const stringImportPlugin = {
  name: "string-import",
  setup(build) {
    build.onLoad({ filter: /owl_devtools_global_hook\.js$/ }, async (args) => {
      const text = readFileSync(args.path, "utf-8");
      return { contents: `export default ${JSON.stringify(text)}`, loader: "js" };
    });
  },
};

const entryPoints = [
  `${DEVTOOLS_SRC}/page_scripts/owl_devtools_global_hook.js`,
  `${DEVTOOLS_SRC}/content.js`,
  `${DEVTOOLS_SRC}/devtools_app/devtools.js`,
  `${DEVTOOLS_SRC}/utils.js`,
  `${DEVTOOLS_SRC}/devtools_app/devtools_panel.js`,
  `${DEVTOOLS_SRC}/popup_app/popup.js`,
  `${DEVTOOLS_SRC}/background.js`,
];

await Promise.all(
  entryPoints.map((entry) => {
    const outfile = entry.replace(DEVTOOLS_SRC, DEVTOOLS_DIST);
    return esbuild.build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: "esm",
      minify: isProduction,
      plugins: [stringImportPlugin],
    });
  })
);

// ---- Step 3: Copy static files ----

const filesToCopy = [
  { src: "tools/devtools/assets", dest: `${DEVTOOLS_DIST}/assets` },
  { src: `${DEVTOOLS_SRC}/devtools_app/devtools.html`, dest: `${DEVTOOLS_DIST}/devtools_app/devtools.html` },
  { src: `${DEVTOOLS_SRC}/devtools_app/devtools_panel.html`, dest: `${DEVTOOLS_DIST}/devtools_app/devtools_panel.html` },
  { src: `${DEVTOOLS_SRC}/page_scripts/owl_devtools_global_hook.js`, dest: `${DEVTOOLS_DIST}/page_scripts/owl_devtools_global_hook.js` },
  { src: `${DEVTOOLS_SRC}/popup_app/popup.html`, dest: `${DEVTOOLS_DIST}/popup_app/popup.html` },
  { src: `${DEVTOOLS_SRC}/background.html`, dest: `${DEVTOOLS_DIST}/background.html` },
  { src: `${DEVTOOLS_SRC}/main.css`, dest: `${DEVTOOLS_DIST}/popup_app/main.css` },
  { src: `${DEVTOOLS_SRC}/main.css`, dest: `${DEVTOOLS_DIST}/devtools_app/main.css` },
  {
    src: isChrome ? "tools/devtools/manifest-chrome.json" : "tools/devtools/manifest-firefox.json",
    dest: `${DEVTOOLS_DIST}/manifest.json`,
  },
];

// Copy fonts directory
mkdirSync(`${DEVTOOLS_DIST}/fonts`, { recursive: true });
cpSync(`${DEVTOOLS_SRC}/fonts`, `${DEVTOOLS_DIST}/fonts`, { recursive: true });

for (const { src, dest } of filesToCopy) {
  mkdirSync(join(dest, ".."), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// ---- Step 4: Cleanup temp files ----

for (const file of readdirSync("tools/devtools/assets")) {
  if (file.endsWith(".js")) {
    unlinkSync(join("tools/devtools/assets", file));
  }
}
