# Owl Benchmark

A performance benchmarking suite for Owl. It measures rendering performance across a set of standard DOM operations and can compare results against other popular frameworks.

## Features

- **Browser UI**: an interactive dashboard for running benchmarks, adjusting parameters, and visualizing results.
- **Node.js CLI**: a headless runner using jsdom, suitable for CI or commit-to-commit comparisons without a browser.
- **Multi-framework comparison**: runs the same benchmark operations against Owl (state and signal variants), React, Vue, and Solid side-by-side.
- **Statistical analysis**: removes outliers via IQR filtering and computes confidence intervals and standard deviation.
- **Snapshot comparison**: save a baseline result and compare it against a new run directly in the UI.

## Benchmark Operations

Each framework implements the same 10 standard operations:

1. Create 1,000 rows
2. Replace all rows (re-create 1,000 rows)
3. Partial update (update every 10th row label)
4. Click row (increment a counter on one row)
5. Select row (highlight one row)
6. Swap rows (swap rows 1 and 998)
7. Remove row (delete one row)
8. Append 1,000 rows to existing rows
9. Clear rows (remove all rows)

## Framework Variants

| File | Framework |
|---|---|
| `frameworks/owl3_state.ts` | Owl 3 with `proxy()` state |
| `frameworks/owl3_signal.ts` | Owl 3 with `signal()` reactivity |
| `frameworks/owl2_reactive.ts` | Owl 2 reactive |
| `frameworks/react.tsx` | React (hooks) |
| `frameworks/vue.ts` | Vue 3 (Composition API) |
| `frameworks/solid.tsx` | Solid.js |

## Usage

### Browser UI

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Select frameworks and benchmarks, configure the duration, and click **Run**.

### Node.js CLI

```sh
npx ts-node run_node.ts [--duration <ms>] [--bench <name>] [--variant <name>]
```

Results are printed to stdout with per-operation statistics.
