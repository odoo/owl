/**
 * Node.js CLI benchmark for Owl.
 *
 * Runs the standard benchmark suite in a headless Chromium browser via
 * Playwright for accurate real-browser DOM performance measurements.
 *
 * Usage:
 *   npx tsx tools/benchmark/run_node.ts [options]
 *
 * Options:
 *   --duration <seconds>   Duration per benchmark (default: 5)
 *   --bench <index|name>   Run a single benchmark (default: all)
 *   --variant <signal|state|all>  Which Owl variant(s) (default: all)
 */

import path from "node:path";
import { build } from "esbuild";
import {
  BENCHMARKS,
  floor,
  iqrFences,
  confidenceInterval95,
  medianOf,
  stddev,
  type BenchmarkDef,
} from "./src/shared";

// ---------------------------------------------------------------------------
// 1. Parse CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const DURATION = Number(getArg("duration", "5"));
const BENCH_FILTER = getArg("bench", "all");
const VARIANT_FILTER = getArg("variant", "all") as "signal" | "state" | "all";
const JSON_OUTPUT = args.includes("--json");

// When --json: progress → stderr, final JSON → stdout
const log = JSON_OUTPUT ? process.stderr : process.stdout;

// ---------------------------------------------------------------------------
// 2. Select benchmarks
// ---------------------------------------------------------------------------

let selectedBenchmarks: BenchmarkDef[];
if (BENCH_FILTER === "all") {
  selectedBenchmarks = BENCHMARKS;
} else {
  const idx = Number(BENCH_FILTER);
  if (!isNaN(idx) && BENCHMARKS[idx]) {
    selectedBenchmarks = [BENCHMARKS[idx]];
  } else {
    const match = BENCHMARKS.filter((b) =>
      b.label.toLowerCase().includes(BENCH_FILTER.toLowerCase())
    );
    if (match.length === 0) {
      console.error(`No benchmark matching "${BENCH_FILTER}"`);
      process.exit(1);
    }
    selectedBenchmarks = match;
  }
}

const benchIndices = selectedBenchmarks.map((b) => BENCHMARKS.indexOf(b));

// ---------------------------------------------------------------------------
// ANSI helpers (needed early for progress output)
// ---------------------------------------------------------------------------

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function pad(str: string, len: number) {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}
function rpad(str: string, len: number) {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

// ---------------------------------------------------------------------------
// 3. Bundle browser entry with esbuild
// ---------------------------------------------------------------------------

log.write("Bundling… ");

const bundleResult = await build({
  entryPoints: [path.resolve(import.meta.dirname, "src/headless_entry.ts")],
  bundle: true,
  format: "esm",
  write: false,
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_HASH__: JSON.stringify("benchmark"),
  },
  tsconfigRaw: `{
    "compilerOptions": {
      "target": "ESNext",
      "useDefineForClassFields": true,
      "experimentalDecorators": false
    }
  }`,
});

const browserCode = bundleResult.outputFiles![0]!.text;
log.write("done.\n");

// ---------------------------------------------------------------------------
// 4. Launch headless Chromium via Playwright
// ---------------------------------------------------------------------------

let chromium: typeof import("playwright").chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\nPlaywright is required for headless benchmarks.\n" +
      "Install with:\n" +
      "  cd tools/benchmark && npm install playwright && npx playwright install chromium\n"
  );
  process.exit(1);
}

log.write("Launching browser… ");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Surface browser-side errors and console output so runtime failures don't
// manifest as a silent hang until the poll timeout fires.
page.on("pageerror", (err) => {
  process.stderr.write(`\n${RED}[browser pageerror]${RESET} ${err.message}\n${err.stack ?? ""}\n`);
});
page.on("console", (msg) => {
  const type = msg.type();
  if (type === "error" || type === "warning") {
    process.stderr.write(`[browser ${type}] ${msg.text()}\n`);
  }
});

await page.setContent("<!DOCTYPE html><html><body></body></html>");

log.write("done.\n");

// ---------------------------------------------------------------------------
// 5. Wire progress reporting
// ---------------------------------------------------------------------------

await page.exposeFunction(
  "__benchProgress__",
  (json: string) => {
    try {
      const msg = JSON.parse(json);
      if (msg.type === "start") {
        log.write(
          `[${msg.index + 1}/${msg.total}] ${BOLD}${msg.label}${RESET} `
        );
      } else if (msg.type === "done") {
        log.write(
          `${DIM}(${msg.rounds} rounds in ${floor(msg.elapsed, 1)}s)${RESET}\n`
        );
      }
    } catch {
      // ignore malformed progress
    }
  }
);

// ---------------------------------------------------------------------------
// 6. Inject config and run benchmarks
// ---------------------------------------------------------------------------

await page.evaluate(
  (cfg) => {
    (window as any).__BENCH_CONFIG__ = cfg;
  },
  { duration: DURATION, benchIndices, variantFilter: VARIANT_FILTER }
);

// Figure out how many variant setups will run
const variantCount =
  VARIANT_FILTER === "all" ? 3 : VARIANT_FILTER === "signal" || VARIANT_FILTER === "state" ? 2 : 1;
const setupLabels: string[] = ["Vanilla JS"];
if (VARIANT_FILTER === "all" || VARIANT_FILTER === "signal")
  setupLabels.push("Owl 3 (signal)");
if (VARIANT_FILTER === "all" || VARIANT_FILTER === "state")
  setupLabels.push("Owl 3 (state)");

log.write(
  `\n${BOLD}Owl Benchmark (headless Chromium)${RESET}\n` +
    `${"=".repeat(50)}\n` +
    `Duration: ${DURATION}s | Benchmarks: ${selectedBenchmarks.length} | ` +
    `Variants: ${setupLabels.join(", ")}\n\n`
);

// Inject the bundled entry — this kicks off the benchmark loop
await page.addScriptTag({ content: browserCode, type: "module" });

// Wait for completion (generous timeout: duration × benchmarks × variants + overhead)
const timeoutMs =
  (DURATION * selectedBenchmarks.length * variantCount + 60) * 1000;
await page.waitForFunction(
  () => (window as any).__BENCH_RESULTS__ !== undefined,
  null,
  { timeout: timeoutMs }
);

// ---------------------------------------------------------------------------
// 7. Collect raw results
// ---------------------------------------------------------------------------

interface BenchResult {
  benchLabel: string;
  rounds: number;
  elapsed: number;
  samples: Record<string, number[]>;
}
interface RawResults {
  setupLabels: string[];
  results: BenchResult[];
}

const raw: RawResults = await page.evaluate(
  () => (window as any).__BENCH_RESULTS__
);

await browser.close();

// ---------------------------------------------------------------------------
// 8. JSON output (for --json mode)
// ---------------------------------------------------------------------------

if (JSON_OUTPUT) {
  // Output raw samples per benchmark per setup — the consumer does statistics
  const jsonOut = {
    setupLabels: raw.setupLabels,
    benchmarks: raw.results.map((b) => ({
      label: b.benchLabel,
      samples: b.samples,
    })),
  };
  process.stdout.write(JSON.stringify(jsonOut) + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 9. Statistical analysis and human-readable output
// ---------------------------------------------------------------------------

const meansBySetup = new Map<string, number[]>();
const trimmedMeansBySetup = new Map<string, number[]>();
for (const label of raw.setupLabels) {
  meansBySetup.set(label, []);
  trimmedMeansBySetup.set(label, []);
}

for (const bench of raw.results) {
  interface SetupResult {
    label: string;
    filtered: number[];
    outlierCount: number;
    ci: { mean: number; ci: number; lo: number; hi: number };
    med: number;
    sd: number;
    cv: number;
    trimmedMean: number;
  }

  const results: SetupResult[] = [];

  for (const label of raw.setupLabels) {
    const samples = bench.samples[label] || [];
    const sorted = samples.slice().sort((a, b) => a - b);
    const [lo, hi] = iqrFences(sorted);
    const filtered = sorted.filter((v) => v >= lo && v <= hi);
    const outlierCount = samples.length - filtered.length;

    const ci = confidenceInterval95(filtered);
    const med = medianOf(filtered);
    const sd_ = stddev(filtered);
    const cv = ci.mean > 0 ? sd_ / ci.mean : 0;
    const trimmedMean =
      filtered.length > 1
        ? filtered.slice(0, -1).reduce((a, b) => a + b, 0) /
          (filtered.length - 1)
        : ci.mean;

    results.push({
      label,
      filtered,
      outlierCount,
      ci,
      med,
      sd: sd_,
      cv,
      trimmedMean,
    });
  }

  // Store for geometric mean
  for (const r of results) {
    meansBySetup.get(r.label)!.push(r.ci.mean);
    trimmedMeansBySetup.get(r.label)!.push(r.trimmedMean);
  }

  // Print per-benchmark results
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const pctStr =
      i > 0
        ? (() => {
            const pct = floor(
              ((r.ci.mean - results[0]!.ci.mean) / results[0]!.ci.mean) * 100,
              1
            );
            const color = pct < 0 ? GREEN : RED;
            return `  ${color}${pct > 0 ? "+" : ""}${pct}%${RESET}`;
          })()
        : "";

    console.log(
      `  ${YELLOW}${pad(r.label, 18)}${RESET} ` +
        `n=${rpad(String(r.filtered.length), 3)} ${DIM}(${r.outlierCount} outliers)${RESET}  ` +
        `mean=${BOLD}${rpad(floor(r.ci.mean, 2).toFixed(2), 7)}ms${RESET}  ` +
        `95%CI [${floor(r.ci.lo, 2).toFixed(2)}, ${floor(r.ci.hi, 2).toFixed(2)}]  ` +
        `med=${rpad(floor(r.med, 2).toFixed(2), 7)}ms  ` +
        `sd=${floor(r.sd, 2).toFixed(2)}ms  ` +
        `cv=${floor(r.cv * 100, 1)}%` +
        pctStr
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// 9. Geometric mean summary
// ---------------------------------------------------------------------------

if (raw.setupLabels.length > 1 && raw.results.length > 1) {
  const geoMeans: {
    label: string;
    geoMean: number;
    geoMeanTrimmed: number;
  }[] = [];

  const bestMeans: number[] = [];
  const bestTrimmedMeans: number[] = [];
  for (let b = 0; b < raw.results.length; b++) {
    let best = Infinity;
    let bestTrimmed = Infinity;
    for (const label of raw.setupLabels) {
      const mean = meansBySetup.get(label)![b]!;
      const trimmed = trimmedMeansBySetup.get(label)![b]!;
      if (mean < best) best = mean;
      if (trimmed < bestTrimmed) bestTrimmed = trimmed;
    }
    bestMeans.push(best);
    bestTrimmedMeans.push(bestTrimmed);
  }

  for (const label of raw.setupLabels) {
    const means = meansBySetup.get(label)!;
    const trimmedMeans = trimmedMeansBySetup.get(label)!;
    let logSum = 0;
    let logSumTrimmed = 0;
    for (let b = 0; b < means.length; b++) {
      logSum += Math.log(means[b]! / bestMeans[b]!);
      logSumTrimmed += Math.log(trimmedMeans[b]! / bestTrimmedMeans[b]!);
    }
    const geoMean = Math.exp(logSum / means.length);
    const geoMeanTrimmed = Math.exp(logSumTrimmed / trimmedMeans.length);
    geoMeans.push({ label, geoMean, geoMeanTrimmed });
  }

  console.log(`${BOLD}Geometric Mean ${DIM}(lower is better)${RESET}`);
  for (const g of geoMeans) {
    const best =
      g.geoMean === Math.min(...geoMeans.map((x) => x.geoMean));
    const marker = best ? `${GREEN}*${RESET}` : " ";
    console.log(
      `  ${marker} ${YELLOW}${pad(g.label, 18)}${RESET} ` +
        `${BOLD}${floor(g.geoMean, 3)}x${RESET}  ` +
        `${DIM}(trimmed: ${floor(g.geoMeanTrimmed, 3)}x)${RESET}`
    );
  }
  console.log();
}

console.log(`${DIM}Done.${RESET}\n`);
