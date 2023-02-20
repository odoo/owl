import terser from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";

const isProduction = process.env.NODE_ENV === "production";
const isFirefox = process.env.NODE_BROWSER === "firefox";
const isChrome = process.env.NODE_BROWSER === "chrome";
const filesToMove =
[
  { src: "src/devtools_app/devtools.html", dest: "build/devtools_app" },
  { src: "src/devtools_app/devtools_panel.html", dest: "build/devtools_app" },
  { src: "src/fonts/*", dest: "build/fonts/" },
  { src: "src/popup_app/popup.html", dest: "build/popup_app" },
  { src: "src/background.html", dest: "build" },
  { src: "src/main.css", dest: "build/popup_app" },
  { src: "src/main.css", dest: "build/devtools_app" },
  { src: "assets/**/*", dest: "build/assets/" },
  {
    src: isChrome ? "manifest-chrome.json" : "manifest-firefox.json",
    dest: "build",
    rename: "manifest.json",
  },
];

function generateRule(input){
  return {
    input: input,
    output:[
      {
        format: "esm",
        file: input.replace("src", "build"),
      }
    ],
    plugins: [
      isProduction && terser.terser(),
    ],
  }
}

const firstRule = generateRule("src/utils.js");
firstRule.plugins.push(copy({targets: filesToMove}));

export default [
  firstRule,
  generateRule("src/content.js"),
  generateRule("src/devtools_app/devtools.js"),
  generateRule("src/page_scripts/load_scripts.js"), 
  generateRule("src/devtools_app/devtools_panel.js"), 
  generateRule("src/popup_app/popup.js"), 
  generateRule("src/background.js")
];
