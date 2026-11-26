import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import solid from "vite-plugin-solid";
import snapshots from "./vite-plugin-snapshots";

const OWL_ROOT = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  server: {
    fs: {
      allow: [OWL_ROOT],
    },
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_HASH__: JSON.stringify("benchmark"),
  },
  plugins: [
    react({ include: /\/react\.tsx$/ }),
    solid({ include: /\/solid\.tsx$/ }),
    vue(),
    snapshots(),
  ],
  esbuild: {
    tsconfigRaw: `{
      "compilerOptions": {
        "target": "ESNext",
        "useDefineForClassFields": true,
        "experimentalDecorators": false
      }
    }`,
  },
});
