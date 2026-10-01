import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildSync } from "esbuild";

// Compare a saved baseline bundle with the current sources (or another bundle).
// Each round runs in a fresh worker heap, sequentially in ABBA order. Discard
// two warmup passes, collect seven samples, and report their median per side.
// npm run bench:compare -- /tmp/owl-before.mjs [candidate.mjs] --output results.json

if (!isMainThread) {
  const lib = await import(pathToFileURL(workerData.bundle));
  const { signal, computed, effect, proxy, createComputation, setComputation, removeSources } = lib;
  let sink = 0;
  const samples = [];
  async function flush() {
    await Promise.resolve();
    await Promise.resolve();
  }
  async function measure(name, count, operation, cleanup = () => {}) {
    const timings = [];
    for (let pass = 0; pass < 9; pass++) {
      globalThis.retained = null;
      await flush();
      global.gc();
      const start = performance.now();
      const result = operation(count);
      if (result && typeof result.then === "function") await result;
      const ns = ((performance.now() - start) * 1e6) / count;
      if (pass >= 2) timings.push(ns);
    }
    cleanup();
    await flush();
    samples.push({ name, count, timings });
  }
  {
    const value = signal(1);
    await measure("signal read, one", 20000000, (count) => {
      let total = 0;
      for (let i = 0; i < count; i++) total += value();
      sink = total;
    });
    const values = Array.from({ length: 1024 }, (_, i) => signal(i));
    await measure("signal read, 1024", 10000000, (count) => {
      let total = 0;
      for (let i = 0; i < count; i++) total += values[i & 1023]();
      sink = total;
    });
    const derived = computed(() => value() + 1);
    derived();
    await measure("computed cached read, one", 20000000, (count) => {
      let total = 0;
      for (let i = 0; i < count; i++) total += derived();
      sink = total;
    });
    const derivedValues = values.map((value) => computed(() => value() + 1));
    for (const value of derivedValues) value();
    await measure("computed cached read, 1024", 10000000, (count) => {
      let total = 0;
      for (let i = 0; i < count; i++) total += derivedValues[i & 1023]();
      sink = total;
    });
  }
  {
    const value = signal(1);
    const context = createComputation(() => {}, false);
    await measure(
      "signal tracked read",
      5000000,
      (count) => {
        setComputation(context);
        let total = 0;
        for (let i = 0; i < count; i++) total += value();
        sink = total;
        setComputation(undefined);
      },
      () => removeSources(context)
    );
    const object = proxy({ value: 1 });
    await measure(
      "proxy tracked property read",
      2000000,
      (count) => {
        setComputation(context);
        let total = 0;
        for (let i = 0; i < count; i++) total += object.value;
        sink = total;
        setComputation(undefined);
      },
      () => removeSources(context)
    );
  }
  {
    const value = signal(0);
    await measure("signal write, unobserved", 5000000, (count) => {
      for (let i = 0; i < count; i++) value.set(i);
    });
    const unchanged = signal(0);
    await measure("signal write, unchanged", 10000000, (count) => {
      for (let i = 0; i < count; i++) unchanged.set(0);
    });
  }
  await measure("signal creation", 50000, (count) => {
    const values = new Array(count);
    for (let i = 0; i < count; i++) values[i] = signal(i);
    globalThis.retained = values;
  });
  await measure("computed creation", 50000, (count) => {
    const values = new Array(count);
    for (let i = 0; i < count; i++) values[i] = computed(() => i);
    globalThis.retained = values;
  });
  {
    const value = signal(0);
    await measure("effect create + dispose", 100000, (count) => {
      for (let i = 0; i < count; i++) effect(() => value())();
    });
    await measure("nested effect create + dispose", 50000, (count) => {
      for (let i = 0; i < count; i++)
        effect(() => {
          value();
          effect(() => value());
        })();
    });
  }
  for (const fanout of [1, 10, 100]) {
    const value = signal(0);
    const stops = Array.from({ length: fanout }, () =>
      effect(() => {
        sink = value();
      })
    );
    await measure(
      `signal write + flush, ${fanout} effects`,
      fanout === 100 ? 5000 : 20000,
      async (count) => {
        for (let i = 0; i < count; i++) {
          value.set(i);
          await Promise.resolve();
          await Promise.resolve();
        }
      },
      () => {
        for (const stop of stops) stop();
      }
    );
  }
  for (const depth of [1, 5, 20]) {
    const value = signal(0);
    let head = value;
    for (let i = 0; i < depth; i++) {
      const prev = head;
      head = computed(() => prev() + 1);
    }
    const stop = effect(() => {
      sink = head();
    });
    await measure(
      `computed chain write + flush, depth ${depth}`,
      20000,
      async (count) => {
        for (let i = 0; i < count; i++) {
          value.set(i);
          await Promise.resolve();
          await Promise.resolve();
        }
      },
      stop
    );
  }
  {
    const toggle = signal(false),
      left = signal(1),
      right = signal(2);
    const choice = computed(() => (toggle() ? left() : right()));
    const stop = effect(() => {
      sink = choice();
    });
    await measure(
      "computed branch switch + flush",
      20000,
      async (count) => {
        for (let i = 0; i < count; i++) {
          toggle.set((i & 1) === 1);
          await Promise.resolve();
          await Promise.resolve();
        }
      },
      stop
    );
  }
  for (const size of [8, 64, 1024]) {
    const values = Array.from({ length: size }, () => signal(0));
    let nextValue = 0;
    const total = computed(() => {
      let sum = 0;
      for (const value of values) sum += value();
      return sum;
    });
    const stop = effect(() => {
      sink = total();
    });
    await measure(
      `computed fan-in write + flush, ${size} sources`,
      size === 1024 ? 1000 : 5000,
      async (count) => {
        for (let i = 0; i < count; i++) {
          values[i % size].set(++nextValue);
          await flush();
        }
      },
      stop
    );
  }
  globalThis.sink = sink;
  parentPort.postMessage(samples);
} else {
  if (!global.gc) throw new Error("Run with node --expose-gc or npm run bench:compare");
  const { values, positionals } = parseArgs({
    options: { output: { type: "string" } },
    allowPositionals: true,
  });
  if (positionals.length < 1 || positionals.length > 2) {
    throw new Error("Expected a baseline bundle and an optional candidate bundle");
  }
  const directory = mkdtempSync(join(tmpdir(), "owl-compare-"));
  try {
    const original = resolve(positionals[0]);
    const current = positionals[1] ? resolve(positionals[1]) : join(directory, "owl-core.mjs");
    if (!positionals[1])
      buildSync({
        entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
        bundle: true,
        format: "esm",
        platform: "node",
        target: "es2022",
        outfile: current,
      });
    const rounds = [];
    for (const [label, bundle] of [
      ["original", original],
      ["current", current],
      ["current", current],
      ["original", original],
    ]) {
      const result = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), { workerData: { bundle } });
        let result;
        worker.on("message", (value) => {
          result = value;
        });
        worker.on("error", reject);
        worker.on("exit", (code) =>
          code === 0 && result ? resolve(result) : reject(new Error(`Worker exit ${code}`))
        );
      });
      rounds.push({ label, result });
      console.log(`Finished ${label}, round ${rounds.length}`);
    }
    const median = (values) => {
      const sorted = values.toSorted((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const summary = rounds[0].result.map(({ name }) => {
      const timings = (label) =>
        rounds
          .filter((round) => round.label === label)
          .flatMap((round) => round.result.find((result) => result.name === name).timings);
      const before = median(timings("original")),
        after = median(timings("current"));
      return { name, beforeNs: before, afterNs: after, changePercent: 100 * (after / before - 1) };
    });
    if (values.output)
      writeFileSync(
        values.output,
        JSON.stringify({ node: process.version, v8: process.versions.v8, rounds, summary }, null, 2)
      );
    for (const row of summary)
      console.log(
        `${row.name.padEnd(44)} ${row.beforeNs.toFixed(1).padStart(9)} -> ${row.afterNs.toFixed(1).padStart(9)} ns  ${row.changePercent.toFixed(1).padStart(7)}%`
      );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
