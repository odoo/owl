// Retained heap per value, measured after GC in a fresh worker heap per scenario.
// Run: npm run bench:memory -- --count 100000
// Compare a saved bundle: npm run bench:memory -- --bundle /tmp/owl-core-before.mjs
// The retaining array is allocated before measurement. User getter closures
// are counted separately; the observed case includes the effect and disposer.
import { buildSync } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

const scenarios = [
  "signal",
  "signal-custom-equals",
  "computed-shared-getter",
  "computed-own-getter",
  "computed-read",
  "computed-read-eight-sources",
  "computed-with-effect",
];

if (!isMainThread) {
  const { bundle, scenario, count } = workerData;
  const { signal, computed, effect } = await import(pathToFileURL(bundle));
  const source = signal(1);
  const sources = [source, ...Array.from({ length: 7 }, () => signal(1))];
  const constantGetter = () => 1;
  const dependentGetter = () => source() + 1;
  const aggregateGetter = () => {
    let sum = 0;
    for (const value of sources) sum += value();
    return sum;
  };
  const equals = (a, b) => a === b;

  function create(i) {
    switch (scenario) {
      case "signal":
        return signal(i);
      case "signal-custom-equals":
        return signal(i, { equals });
      case "computed-shared-getter":
        return computed(constantGetter);
      case "computed-own-getter":
        return computed(() => i);
      case "computed-read": {
        const value = computed(dependentGetter);
        value();
        return value;
      }
      case "computed-read-eight-sources": {
        const value = computed(aggregateGetter);
        value();
        return value;
      }
      case "computed-with-effect": {
        const value = computed(dependentGetter);
        return [value, effect(() => value())];
      }
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  // Warm up constructors, then release warmup dependencies through the normal
  // scheduler before establishing the baseline.
  let warmup = Array.from({ length: 10000 }, (_, i) => create(i));
  if (scenario === "computed-with-effect") {
    for (const [, dispose] of warmup) dispose();
  }
  warmup = null;
  source.set(2);
  await Promise.resolve();
  await Promise.resolve();

  const retained = new Array(count);
  for (let i = 0; i < 5; i++) global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < count; i++) retained[i] = create(i);
  globalThis.retained = retained;
  for (let i = 0; i < 5; i++) global.gc();
  const bytes = (process.memoryUsage().heapUsed - before) / count;
  parentPort.postMessage({ scenario, bytesPerValue: bytes });
} else {
  const { values } = parseArgs({
    options: {
      count: { type: "string", default: "100000" },
      bundle: { type: "string" },
    },
  });
  const count = Number(values.count);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("--count must be a positive integer");
  }
  if (!global.gc) {
    throw new Error("Run with node --expose-gc or npm run bench:memory");
  }
  const directory = mkdtempSync(join(tmpdir(), "owl-memory-"));
  try {
    const bundle = values.bundle ? resolve(values.bundle) : join(directory, "owl-core.mjs");
    if (!values.bundle) {
      buildSync({
        entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
        bundle: true,
        format: "esm",
        platform: "node",
        target: "es2022",
        outfile: bundle,
      });
    }
    console.log(`Node ${process.version}, V8 ${process.versions.v8}, ${count} values per scenario`);
    console.log("Retained bytes/value; actual sizes depend on the engine and dependencies.");
    for (const scenario of scenarios) {
      const measurement = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: { bundle, scenario, count },
        });
        let result;
        worker.on("message", (value) => (result = value));
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0 || !result) reject(new Error(`Worker exited ${code}`));
          else resolve(result);
        });
      });
      console.log(`${scenario.padEnd(25)} ${measurement.bytesPerValue.toFixed(1)}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
