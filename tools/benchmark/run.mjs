#!/usr/bin/env node

// Runs list.html in headless Chrome for each given owl build (an owl.iife.js
// file), and prints the median time of each operation, in ms.
//
//   node tools/benchmark/run.mjs [label=]path/to/owl.iife.js ...
//
// Chrome is driven through the DevTools protocol (fetch + WebSocket, Node 22),
// so there is no dependency. The CHROME environment variable overrides the
// browser binary (google-chrome by default).

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9333;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const builds = process.argv.slice(2).map((arg) => {
  const [label, file] = arg.includes("=") ? arg.split("=") : [path.basename(arg), arg];
  return { label, url: pathToFileURL(path.resolve(file)).href };
});
if (!builds.length) {
  console.log("usage: node tools/benchmark/run.mjs [label=]path/to/owl.iife.js ...");
  process.exit(1);
}

async function send(wsUrl, method, params = {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.send(JSON.stringify({ id: 1, method, params }));
}

async function evaluate(wsUrl, expression) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  try {
    return await new Promise((resolve, reject) => {
      ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.id !== 1) {
          return;
        }
        if (data.result.exceptionDetails) {
          reject(new Error(JSON.stringify(data.result.exceptionDetails)));
        } else {
          resolve(data.result.result.value);
        }
      };
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        })
      );
    });
  } finally {
    ws.close();
  }
}

const profile = mkdtempSync(path.join(tmpdir(), "owl-benchmark-"));
const chrome = spawn(
  process.env.CHROME || "google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--allow-file-access-from-files",
    "about:blank",
  ],
  { stdio: "ignore" }
);

let browserWsUrl = null;
try {
  for (let i = 0; i < 50 && !browserWsUrl; i++) {
    try {
      const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      browserWsUrl = version.webSocketDebuggerUrl;
    } catch {
      await sleep(100);
    }
  }
  if (!browserWsUrl) {
    throw new Error("could not connect to chrome");
  }
  const results = {};
  for (const { label, url } of builds) {
    const page = `${pathToFileURL(path.join(here, "list.html")).href}?build=${encodeURIComponent(url)}`;
    const target = await (
      await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(page)}`, {
        method: "PUT",
      })
    ).json();
    results[label] = await evaluate(
      target.webSocketDebuggerUrl,
      `new Promise((r) => document.readyState === "complete" ? r() : addEventListener("load", r))
        .then(() => runBenchmark())`
    );
    await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
  }
  const labels = builds.map((b) => b.label);
  console.log(`| operation (median ms) | ${labels.join(" | ")} |`);
  console.log(`|---|${labels.map(() => "---").join("|")}|`);
  for (const operation of Object.keys(results[labels[0]])) {
    console.log(`| ${operation} | ${labels.map((l) => results[l][operation]).join(" | ")} |`);
  }
} finally {
  if (chrome.exitCode === null && chrome.signalCode === null) {
    // close chrome properly (so that it releases its profile), or kill it
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    if (browserWsUrl) {
      await send(browserWsUrl, "Browser.close").catch(() => {});
    }
    const timeout = setTimeout(() => chrome.kill(), 5000);
    await exited;
    clearTimeout(timeout);
  }
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    console.warn(`could not remove the chrome profile ${profile}`);
  }
}
