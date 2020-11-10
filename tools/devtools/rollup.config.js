import typescript from "rollup-plugin-typescript2";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "rollup-plugin-terser";
import postcss from "rollup-plugin-postcss";
import copy from "rollup-plugin-copy";

const isProduction = process.env.NODE_ENV === "production";

export default [
    {
        input: "src/devtools/main.ts",
        output: [
            {
                file: "build/devtools/devtools.js",
                format: "esm",
            },
        ],
        plugins: [
            typescript(),
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
                targets: [{ src: "src/devtools/devtools.html", dest: "build/devtools" }],
            }),
        ],
    },

    {
        input: "src/popup/main.ts",
        output: [
            {
                file: "build/popup/popup.js",
                format: "esm",
            },
        ],
        plugins: [
            typescript(),
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
        input: "src/background.ts",
        output: [
            {
                file: "build/background.js",
                format: "esm",
            },
        ],
        plugins: [
            typescript(),
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
                    { src: "assets/images/**/*", dest: "build/assets/images" },
                    { src: "manifest.json", dest: "build" },
                ],
            }),
        ],
    },

    {
        input: "src/content.ts",
        output: [
            {
                file: "build/content.js",
                format: "esm",
            },
        ],
        plugins: [
            typescript(),
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
];

//
