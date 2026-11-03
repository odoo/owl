# Owl Benchmark

A performance benchmarking suite for Owl. It measures rendering performance across a set of standard DOM operations and can compare results against other popular frameworks — or against Owl itself at different commits.

## Features

- **Browser UI**: an interactive dashboard for running benchmarks, adjusting parameters, and visualizing results.
- **Node.js CLI**: a headless runner using Playwright + Chromium, suitable for CI or reproducible measurements.
- **Commit-to-commit comparison**: run the suite against two git refs and get a statistically-grounded before/after report.
- **Multi-framework comparison**: runs the same benchmark operations against Owl (state and signal variants), React, Vue, and Solid side-by-side.
- **Statistical analysis**: removes outliers via IQR filtering and computes confidence intervals and standard deviation; commit comparisons add Welch's t-test for significance.
- **Snapshot comparison**: save a baseline result and compare it against a new run directly in the UI.

## Benchmark Operations

Each framework implements the same 10 standard operations:

1. Create 2,000 rows
2. Replace all rows
3. Partial update (update every 10th row label)
4. Click counter (increment counters on every 10th row)
5. Select row
6. Swap rows (swap rows 1 and 998)
7. Remove row
8. Create 10,000 rows
9. Append 1,000 rows
10. Clear rows

## Framework Variants

| File | Framework |
|---|---|
| `frameworks/owl3_state.ts` | Owl 3 with `proxy()` state |
| `frameworks/owl3_signal.ts` | Owl 3 with `signal()` reactivity |
| `frameworks/owl2_reactive.ts` | Owl 2 reactive |
| `frameworks/react.tsx` | React (hooks) |
| `frameworks/vue.ts` | Vue 3 (Composition API) |
| `frameworks/solid.tsx` | Solid.js |

## Setup

The benchmark tool is a separate workspace with its own dependencies (Vite, Playwright, framework runtimes):

```sh
cd tools/benchmark
npm install
npx playwright install chromium   # only the first time
```

You don't need to build Owl before running benchmarks — the runner bundles `packages/owl/src/` with esbuild on every invocation.

## Usage

All commands below are run from the repo root unless noted otherwise.

### Browser UI

```sh
npm run benchmark:server
```

Open the URL printed by Vite. Select frameworks and benchmarks, configure the duration, and click **Run**. The UI also supports saving baselines and comparing snapshots.

### Node.js CLI (single run)

```sh
npm run benchmark                              # all benchmarks, all variants, 5s each
npm run benchmark -- --duration 10             # 10s per benchmark
npm run benchmark -- --bench 0                 # only the first benchmark
npm run benchmark -- --bench "create 2"        # benchmarks whose label matches the string
npm run benchmark -- --variant signal          # only the Owl 3 signal variant (plus Vanilla baseline)
npm run benchmark -- --json                    # machine-readable output on stdout
```

Results are printed to stdout with per-operation statistics (mean, 95% CI, median, standard deviation, coefficient of variation).

### Commit-to-commit comparison

`benchmark:compare` checks out `packages/owl/src/` from two refs in turn, runs the full benchmark suite against each, and prints a side-by-side report with Welch's t-test so you can tell signal from noise.

```sh
npm run benchmark:compare -- --before=<ref> --after=<ref> [--duration=<s>]
```

Examples:

```sh
# Compare your working branch against main:
npm run benchmark:compare -- --before=main --after=my-branch

# Compare two specific commits, 60 seconds per benchmark (recommended for publishable numbers):
npm run benchmark:compare -- --before=abc1234 --after=def5678 --duration=60

# Quick local sanity check (~5 min total):
npm run benchmark:compare -- --before=HEAD~1 --after=HEAD --duration=10
```

**Important:** the compare script refuses to run if you have uncommitted changes under `packages/owl/src/`. Commit or stash them first — the script swaps sources between refs and will not clobber your work.

**Duration guidance:**

- `--duration=10` — ~5 min total; fine for a quick signal on large changes.
- `--duration=60` — ~30 min total; reliable t-test results even for small changes (recommended default).
- `--duration=120` — ~1 h total; use if a scenario shows borderline p-values at 60s.

The output marks each scenario's change as **Significant** / **Not significant** based on the t-test, so small deltas that fall within run-to-run noise are called out as not meaningful.

### Interpreting the comparison output

For every benchmark, you get one row per framework variant:

```
Create 2,000 rows
                       Before      After    Change  Sig.
  Vanilla JS          123.45ms    122.90ms   -0.4%  no
  Owl 3 (signal)      340.12ms    298.61ms  -12.2%  yes ***
  Owl 3 (state)       355.80ms    312.04ms  -12.3%  yes ***
```

- **Change%** is the difference of means (after − before) / before.
- **Sig.** uses Welch's t-test:
  - `yes ***` — p < 0.001 (very strong evidence of a real difference)
  - `yes **`  — p < 0.01
  - `yes *`   — p < 0.05
  - `no`      — change is within run-to-run noise
- The **Vanilla JS** row is a framework-free baseline; if it moves significantly between refs, your timing environment shifted (CPU throttling, background load) and the other rows should be retaken.

### Filtering comparison runs

The compare script accepts the same single-run filters under the hood:

```sh
npm run benchmark:compare -- --before=main --after=HEAD --duration=30
```

runs everything, but if you only care about a subset, pass `--bench` or `--variant` through `run_node.ts` by editing the compare invocation (or run `npm run benchmark -- --bench <x>` manually against each ref and diff yourself).

## Troubleshooting

- **"Playwright is required for headless benchmarks"** — run `npx playwright install chromium` inside `tools/benchmark/`.
- **Browser runtime errors** — the Node runner surfaces `[browser pageerror]` and `[browser error]` / `[browser warning]` lines to stderr. If a benchmark silently freezes, those messages point to the cause.
- **"uncommitted changes in `packages/owl/src/`"** from `benchmark:compare` — commit or stash; the comparison needs a clean tree to swap sources between refs.
