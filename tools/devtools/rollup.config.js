import terser from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";
import execute from "rollup-plugin-execute";
import { string } from "rollup-plugin-string";

const isWindows = process.platform === "win32";

export default ({ "config-browser": browser, "config-env": env }) => {
  const isProduction = env === "production";
  const isChrome = browser === "chrome";
  const filesToMove = [
    { src: "tools/devtools/assets/**/*", dest: "dist/devtools/assets/" },
    {
      src: "tools/devtools/src/devtools_app/devtools.html",
      dest: "dist/devtools/devtools_app",
    },
    {
      src: "tools/devtools/src/devtools_app/devtools_panel.html",
      dest: "dist/devtools/devtools_app",
    },
    {
      src: "tools/devtools/src/page_scripts/owl_devtools_global_hook.js",
      dest: "dist/devtools/page_scripts",
    },
    { src: "tools/devtools/src/fonts/*", dest: "dist/devtools/fonts/" },
    { src: "tools/devtools/src/popup_app/popup.html", dest: "dist/devtools/popup_app" },
    { src: "tools/devtools/src/background.html", dest: "dist/devtools" },
    { src: "tools/devtools/src/main.css", dest: "dist/devtools/popup_app" },
    { src: "tools/devtools/src/main.css", dest: "dist/devtools/devtools_app" },
    {
      src: isChrome
        ? "tools/devtools/manifest-chrome.json"
        : "tools/devtools/manifest-firefox.json",
      dest: "dist/devtools",
      rename: "manifest.json",
    },
  ];

  function generateRule(input, plugins = []) {
    return {
      input,
      output: [
        {
          format: "esm",
          file: input.replace("tools/devtools/src", "dist/devtools"),
        },
      ],
      plugins: [
        string({
          include: "**/page_scripts/owl_devtools_global_hook.js",
        }),
        isProduction && terser.terser(),
        ...plugins,
      ],
    };
  }
  const commands = new Array(2);
  commands[1] = isWindows
    ? "npm run compile_templates -- tools\\devtools\\src && move templates.js tools\\devtools\\assets\\templates.js"
    : "npm run compile_templates -- tools/devtools/src && mv templates.js tools/devtools/assets/templates.js";
  if (isProduction) {
    commands[0] = isWindows
      ? "npm run build && copy dist\\owl.iife.js tools\\devtools\\assets\\owl.js && npm run build:compiler"
      : "npm run build && cp dist/owl.iife.js tools/devtools/assets/owl.js && npm run build:compiler";
  } else {
    commands[0] = isWindows
      ? "copy dist\\owl.iife.js tools\\devtools\\assets\\owl.js"
      : "cp dist/owl.iife.js tools/devtools/assets/owl.js";
  }

  return [
    generateRule("tools/devtools/src/page_scripts/owl_devtools_global_hook.js", [
      execute(commands, true),
    ]),
    generateRule("tools/devtools/src/content.js", [copy({ targets: filesToMove })]),
    generateRule("tools/devtools/src/devtools_app/devtools.js"),
    generateRule("tools/devtools/src/utils.js"),
    generateRule("tools/devtools/src/devtools_app/devtools_panel.js"),
    generateRule("tools/devtools/src/popup_app/popup.js"),
    generateRule("tools/devtools/src/background.js"),
  ];
};
