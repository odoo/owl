import terser from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";
import execute from "rollup-plugin-execute";
import del from "rollup-plugin-delete";

export default ({ "config-browser": browser }) => {
  const isProduction = process.env.NODE_ENV === "production";
  const isChrome = browser === "chrome";
  const filesToMove = [
    { src: "tools/devtools/assets/**/*", dest: "tools/devtools/build/assets/" },
    {
      src: "tools/devtools/src/devtools_app/devtools.html",
      dest: "tools/devtools/build/devtools_app",
    },
    {
      src: "tools/devtools/src/devtools_app/devtools_panel.html",
      dest: "tools/devtools/build/devtools_app",
    },
    { src: "tools/devtools/src/fonts/*", dest: "tools/devtools/build/fonts/" },
    { src: "tools/devtools/src/popup_app/popup.html", dest: "tools/devtools/build/popup_app" },
    { src: "tools/devtools/src/background.html", dest: "tools/devtools/build" },
    { src: "tools/devtools/src/main.css", dest: "tools/devtools/build/popup_app" },
    { src: "tools/devtools/src/main.css", dest: "tools/devtools/build/devtools_app" },
    {
      src: isChrome
        ? "tools/devtools/manifest-chrome.json"
        : "tools/devtools/manifest-firefox.json",
      dest: "tools/devtools/build",
      rename: "manifest.json",
    },
  ];

  function generateRule(input, format = "esm") {
    return {
      input: input,
      output: [
        {
          format: format,
          file: input.replace("src", "build"),
        },
      ],
      plugins: [isProduction && terser.terser()],
    };
  }

  const commands = new Array(2);
  commands[1] =
    "npm run compile_templates -- tools/devtools/src && mv templates.js tools/devtools/assets/templates.js";
  const firstRule = generateRule("tools/devtools/src/utils.js");
  if (isProduction)
    commands[0] =
      "npm run build && cp dist/owl.iife.js tools/devtools/assets/owl.js && npm run build:compiler";
  else commands[0] = "cp dist/owl.iife.js tools/devtools/assets/owl.js";
  firstRule.plugins.push(execute(commands, true));
  const secondRule = generateRule("tools/devtools/src/content.js");
  secondRule.plugins.push(copy({ targets: filesToMove }));
  const lastRule = generateRule("tools/devtools/src/background.js");
  lastRule.plugins.push(del({ targets: "tools/devtools/assets/*.js" }));

  return [
    firstRule,
    secondRule,
    generateRule("tools/devtools/src/devtools_app/devtools.js"),
    generateRule("tools/devtools/src/page_scripts/load_scripts.js", "iife"),
    generateRule("tools/devtools/src/devtools_app/devtools_panel.js"),
    generateRule("tools/devtools/src/popup_app/popup.js"),
    lastRule,
  ];
};
