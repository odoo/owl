import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "rollup-plugin-terser";
import postcss from "rollup-plugin-postcss";
import copy from "rollup-plugin-copy";

const isProduction = process.env.NODE_ENV === "production";
const isFirefox = process.env.NODE_BROWSER === "firefox";
const isChrome = process.env.NODE_BROWSER === "chrome";

export default [
  {
    input: "src/utils.js",
    output: [
      {
        file: "build/utils.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      postcss({
        config: {
          path: "./postcss.config.js",
        },
        extensions: [".css"],
        extract: true,
        minimize: isProduction,
      }),
      isProduction && terser.terser(),
    ],
  },
  {
    input: "src/content.js",
    output: [
      {
        file: "build/content.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      postcss({
        config: {
          path: "./postcss.config.js",
        },
        extensions: [".css"],
        extract: true,
        minimize: isProduction,
      }),
      isProduction && terser.terser(),
    ],
  },
  {
    input: "src/devtools_app/devtools.js",
    output: [
      {
        file: "build/devtools_app/devtools.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      isProduction && terser.terser(),
      copy({
        targets: [{ src: "src/devtools_app/devtools.html", dest: "build/devtools_app" }],
      }),
    ],
  },
  {
    input: "src/page_scripts/load_scripts.js",
    output: [
      {
        file: "build/page_scripts/load_scripts.js",
        format: "esm",
      },
    ],
    plugins: [nodeResolve(), isProduction && terser.terser()],
  },
  {
    input: "src/devtools_app/devtools_panel.js",
    output: [
      {
        file: "build/devtools_app/devtools_panel.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      postcss({
        config: {
          path: "./postcss.config.js",
        },
        extensions: [".css"],
        extract: true,
        minimize: isProduction,
      }),
      isProduction && terser.terser(),
      copy({
        targets: [
          { src: "src/devtools_app/devtools_panel.html", dest: "build/devtools_app" },
          { src: "src/fonts/*", dest: "build/fonts/" },
        ],
      }),
    ],
  },
  {
    input: "src/popup_app/popup.js",
    output: [
      {
        file: "build/popup_app/popup.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      postcss({
        config: {
          path: "./postcss.config.js",
        },
        extensions: [".css"],
        extract: true,
        minimize: isProduction,
      }),
      isProduction && terser.terser(),
      copy({
        targets: [{ src: "src/popup_app/popup.html", dest: "build/popup_app" }],
      }),
    ],
  },

  {
    input: "assets/templates.js",
    output: [
      {
        file: "build/assets/templates.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      postcss({
        config: {
          path: "./postcss.config.js",
        },
        extensions: [".css"],
        extract: true,
        minimize: isProduction,
      }),
      isProduction && terser.terser(),
    ],
  },

  {
    input: "src/background.js",
    output: [
      {
        file: "build/background.js",
        format: "esm",
      },
    ],
    plugins: [
      nodeResolve(),
      postcss({
        config: {
          path: "./postcss.config.js",
        },
        extensions: [".css"],
        extract: true,
        minimize: isProduction,
      }),
      isProduction && terser.terser(),
      copy({
        targets: [
          { src: "src/background.html", dest: "build" },
          { src: "assets/**/*", dest: "build/assets/" },
          {
            src: isChrome ? "manifest-chrome.json" : "manifest-firefox.json",
            dest: "build",
            rename: "manifest.json",
          },
        ],
      }),
    ],
  },
];

//
