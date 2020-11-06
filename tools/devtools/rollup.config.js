import serve from "rollup-plugin-serve";
import typescript from "rollup-plugin-typescript2";
import nodeResolve from "@rollup/plugin-node-resolve";
import livereload from "rollup-plugin-livereload";
import terser from "rollup-plugin-terser";
import postcss from "rollup-plugin-postcss";

const isProduction = process.env.NODE_ENV === "production";

export default [
  {
    input: "src/main.ts",
    output: [
      {
        file: "dist/bundle.js",
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
        // modules: true,
      }),
      // !isProduction &&
      //   serve({
      //     open: false,
      //     verbose: true,
      //     contentBase: ["dist", "public"],
      //     host: "localhost",
      //     port: 10001,
      //   }),
      // !isProduction && livereload(),
      isProduction && terser.terser(),
    ],
  },
];
