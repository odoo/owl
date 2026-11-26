/**
 * Compare Owl benchmark results between two git commits.
 *
 * Checks out the Owl source (packages/owl/src/) from each commit, runs the full benchmark
 * suite in headless Chromium, then prints a side-by-side comparison with
 * Welch's t-test to determine statistical significance.
 *
 * Usage:
 *   npx tsx tools/benchmark/compare.ts --before=<ref> --after=<ref> [--duration=<s>]
 *
 * Examples:
 *   npm run compare -- --before=main --after=my-branch
 *   npm run compare -- --before=abc1234 --after=def5678 --duration=30
 */

import { execSync } from "node:child_process";
import path from "node:path";
import {
  floor,
  iqrFences,
  confidenceInterval95,
  medianOf,
  welchTTest,
} from "./src/shared";

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getNamedArg(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

const beforeRef = getNamedArg("before");
const afterRef = getNamedArg("after");
const duration = Number(getNamedArg("duration") ?? "60");

if (!beforeRef || !afterRef) {
  console.error(
    "Usage: npm run compare -- --before=<ref> --after=<ref> [--duration=<s>]\n\n" +
      "Examples:\n" +
      "  npm run compare -- --before=main --after=my-branch\n" +
      "  npm run compare -- --before=abc1234 --after=HEAD --duration=30\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function rpad(s: string, n: number) {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

function shortHash(ref: string): string {
  return git(`rev-parse --short ${ref}`);
}

function commitSubject(ref: string): string {
  return git(`log -1 --format=%s ${ref}`);
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

// Verify both refs exist
try {
  git(`rev-parse --verify ${beforeRef}`);
  git(`rev-parse --verify ${afterRef}`);
} catch {
  console.error("Error: one of the refs does not exist.");
  process.exit(1);
}

// Check for uncommitted changes in packages/owl/src/
const srcDirty = git("diff HEAD -- packages/owl/src/").length > 0;
const srcStaged = git("diff --cached -- packages/owl/src/").length > 0;
if (srcDirty || srcStaged) {
  console.error(
    "Error: uncommitted changes in packages/owl/src/. Please commit or stash them first."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Run benchmark for a given ref
// ---------------------------------------------------------------------------

interface BenchData {
  setupLabels: string[];
  benchmarks: { label: string; samples: Record<string, number[]> }[];
}

function runBenchmarkAt(ref: string, label: string): BenchData {
  const hash = shortHash(ref);
  console.log(`\n${BOLD}=== ${label}: ${hash} (${commitSubject(ref)}) ===${RESET}`);

  // Checkout only packages/owl/src/ from the target ref
  git(`checkout ${ref} -- packages/owl/src/`);
  git("reset HEAD -- packages/owl/src/"); // unstage to keep index clean

  try {
    const json = execSync(
      `npx tsx tools/benchmark/run_node.ts --duration ${duration} --json`,
      {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: ["inherit", "pipe", "inherit"], // stdin+stderr pass through, stdout captured
        maxBuffer: 50 * 1024 * 1024,
        timeout: (duration * 15 + 120) * 1000,
      }
    );
    return JSON.parse(json);
  } finally {
    // Always restore packages/owl/src/ to HEAD
    git("checkout HEAD -- packages/owl/src/");
  }
}

// ---------------------------------------------------------------------------
// Run both benchmarks
// ---------------------------------------------------------------------------

console.log(
  `\n${BOLD}Owl Benchmark Comparison${RESET}\n` +
    `${"=".repeat(50)}\n` +
    `Before: ${shortHash(beforeRef)} ${DIM}${commitSubject(beforeRef)}${RESET}\n` +
    `After:  ${shortHash(afterRef)} ${DIM}${commitSubject(afterRef)}${RESET}\n` +
    `Duration: ${duration}s per benchmark`
);

const beforeData = runBenchmarkAt(beforeRef, "Before");
const afterData = runBenchmarkAt(afterRef, "After");

// ---------------------------------------------------------------------------
// Compare results
// ---------------------------------------------------------------------------

console.log(
  `\n\n${BOLD}Results${RESET}\n` + `${"=".repeat(70)}`
);

const COL_LABEL = 20;
const COL_VAL = 10;

// Header
console.log(
  `  ${pad("", COL_LABEL)} ${rpad("Before", COL_VAL)} ${rpad("After", COL_VAL)} ${rpad("Change", 8)}  Sig.`
);
console.log(`  ${"-".repeat(COL_LABEL + COL_VAL * 2 + 8 + 8)}`);

interface ComparedSetup {
  label: string;
  beforeMean: number;
  afterMean: number;
  pctChange: number;
  significant: boolean;
}

const allComparisons: ComparedSetup[][] = [];

for (let b = 0; b < beforeData.benchmarks.length; b++) {
  const bb = beforeData.benchmarks[b]!;
  const ab = afterData.benchmarks[b];
  if (!ab || ab.label !== bb.label) continue;

  console.log(`\n  ${BOLD}${bb.label}${RESET}`);

  const comparisons: ComparedSetup[] = [];

  for (const setupLabel of beforeData.setupLabels) {
    const beforeRaw = bb.samples[setupLabel] || [];
    const afterRaw = (ab.samples[setupLabel]) || [];

    // IQR filter
    const bSorted = beforeRaw.slice().sort((a, b) => a - b);
    const aSorted = afterRaw.slice().sort((a, b) => a - b);
    const [bLo, bHi] = iqrFences(bSorted);
    const [aLo, aHi] = iqrFences(aSorted);
    const bFiltered = bSorted.filter((v) => v >= bLo && v <= bHi);
    const aFiltered = aSorted.filter((v) => v >= aLo && v <= aHi);

    const bCI = confidenceInterval95(bFiltered);
    const aCI = confidenceInterval95(aFiltered);

    const pctChange =
      bCI.mean > 0 ? ((aCI.mean - bCI.mean) / bCI.mean) * 100 : 0;
    const { significant } =
      bFiltered.length >= 2 && aFiltered.length >= 2
        ? welchTTest(bFiltered, aFiltered)
        : { significant: false };

    comparisons.push({
      label: setupLabel,
      beforeMean: bCI.mean,
      afterMean: aCI.mean,
      pctChange,
      significant,
    });

    const changeStr = `${pctChange > 0 ? "+" : ""}${floor(pctChange, 1)}%`;
    const changeColor =
      Math.abs(pctChange) < 1 ? DIM : pctChange < 0 ? GREEN : RED;
    const sigStr = significant
      ? `${pctChange < 0 ? GREEN : RED}YES${RESET}`
      : `${DIM}no${RESET}`;

    console.log(
      `  ${YELLOW}${pad(setupLabel, COL_LABEL)}${RESET} ` +
        `${rpad(floor(bCI.mean, 2).toFixed(2) + "ms", COL_VAL)} ` +
        `${rpad(floor(aCI.mean, 2).toFixed(2) + "ms", COL_VAL)} ` +
        `${changeColor}${rpad(changeStr, 8)}${RESET}  ${sigStr}`
    );
  }

  allComparisons.push(comparisons);
}

// ---------------------------------------------------------------------------
// Summary: per-setup geometric mean of change
// ---------------------------------------------------------------------------

if (allComparisons.length > 1) {
  console.log(`\n${BOLD}Summary (geometric mean of ratios)${RESET}`);
  console.log(`${"=".repeat(50)}`);

  for (const setupLabel of beforeData.setupLabels) {
    let logRatioSum = 0;
    let count = 0;
    for (const benchComparisons of allComparisons) {
      const c = benchComparisons.find((x) => x.label === setupLabel);
      if (c && c.beforeMean > 0) {
        logRatioSum += Math.log(c.afterMean / c.beforeMean);
        count++;
      }
    }
    if (count === 0) continue;
    const geoRatio = Math.exp(logRatioSum / count);
    const pct = (geoRatio - 1) * 100;
    const pctStr = `${pct > 0 ? "+" : ""}${floor(pct, 1)}%`;
    const color = Math.abs(pct) < 1 ? DIM : pct < 0 ? GREEN : RED;

    console.log(
      `  ${YELLOW}${pad(setupLabel, COL_LABEL)}${RESET} ` +
        `${color}${pctStr}${RESET} ` +
        `${DIM}(ratio: ${floor(geoRatio, 3)}x)${RESET}`
    );
  }
}

console.log(`\n${DIM}Done.${RESET}\n`);
