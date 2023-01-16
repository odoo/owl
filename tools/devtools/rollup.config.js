// import typescript from "rollup-plugin-typescript2";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "rollup-plugin-terser";
import postcss from "rollup-plugin-postcss";
import copy from "rollup-plugin-copy";

const isProduction = process.env.NODE_ENV === "production";

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
        input: "src/devtools/devtools.js",
        output: [
            {
                file: "build/devtools/devtools.js",
                format: "esm",
            },
        ],
        plugins: [
            nodeResolve(),
            isProduction && terser.terser(),
            copy({
                targets: [
                    { src: "src/devtools/devtools.html", dest: "build/devtools" }
                ],
            }),
        ],
    },
    {
        input: "src/devtools/page_scripts/load_scripts.js",
        output: [
            {
                file: "build/devtools/page_scripts/load_scripts.js",
                format: "esm",
            },
        ],
        plugins: [
            nodeResolve(),
            isProduction && terser.terser(),
        ],
    },
    {
        input: "src/devtools/components_panel.js",
        output: [
            {
                file: "build/devtools/components_panel.js",
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
                    { src: "src/devtools/components_panel.html", dest: "build/devtools" },
                    { src: "src/fonts/*", dest: "build/fonts/" }, 
                ],
            }),
        ],
    },

    {
        input: "src/devtools/events_panel.js",
        output: [
            {
                file: "build/devtools/events_panel.js",
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
                    { src: "src/devtools/events_panel.html", dest: "build/devtools" },
                    { src: "src/fonts/*", dest: "build/fonts/" }, 
                ],
            }),
        ],
    },

    {
        input: "src/popup/main.js",
        output: [
            {
                file: "build/popup/popup.js",
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
                targets: [{ src: "src/popup/popup.html", dest: "build/popup" }],
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
                    { src: "manifest.json", dest: "build" },
                ],
            }),
        ],
    },

];

//
