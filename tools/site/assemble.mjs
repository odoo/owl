#!/usr/bin/env node

/**
 * Assembles the full site into _site/ for local testing or CI deployment.
 * Mirrors what the GitHub Actions pages.yml workflow does.
 */

import { cpSync, mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const out = resolve(root, "dist/website");

// Clean
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, "playground"), { recursive: true });

// Landing page
cpSync(resolve(__dirname, "index.html"), resolve(out, "index.html"));
cpSync(resolve(__dirname, "counter.js"), resolve(out, "counter.js"));
cpSync(resolve(__dirname, "main.css"), resolve(out, "main.css"));

// OWL build
cpSync(resolve(root, "packages/owl/dist/owl.es.js"), resolve(out, "owl.js"));

// Playground
cpSync(resolve(root, "tools/playground/static"), resolve(out, "playground"), { recursive: true });
cpSync(resolve(root, "tools/playground/dist/playground.js"), resolve(out, "playground/playground.js"));
cpSync(resolve(root, "tools/playground/libs"), resolve(out, "playground/libs"), { recursive: true });
cpSync(resolve(root, "tools/playground/samples"), resolve(out, "playground/samples"), { recursive: true });

console.log("Site assembled in dist/website/");
