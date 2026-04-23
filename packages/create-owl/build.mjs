import * as esbuild from "esbuild";
import { chmodSync } from "fs";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  external: ["prompts", "picocolors"],
  banner: { js: "#!/usr/bin/env node" },
});

chmodSync("dist/index.js", 0o755);
