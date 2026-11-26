import {
  afterRender,
  confidenceInterval95,
  getSelectedBenchmarks,
  fixture,
  floor,
  getConfig,
  getSetups,
  hashHas,
  hideControls,
  iqrFences,
  medianOf,
  setHash,
  shuffled,
  snapshotsReady,
  stddev,
} from "./utils";

async function runBenchmarks() {
  hideControls();
  const config = getConfig();
  const { duration } = config;
  const durationMs = duration * 1000;

  const setups = getSetups();
  const selectedBenchmarks = getSelectedBenchmarks();
  console.log("Running", selectedBenchmarks.length, "benchmarks across", setups.length, "setups");
  console.table(config);

  const htmlSections: string[] = [];

  // Store per-benchmark, per-setup means for geometric mean
  const meansBySetup: Map<string, number[]> = new Map();
  const trimmedMeansBySetup: Map<string, number[]> = new Map();
  for (const setup of setups) {
    meansBySetup.set(setup.label, []);
    trimmedMeansBySetup.set(setup.label, []);
  }

  for (let benchIdx = 0; benchIdx < selectedBenchmarks.length; benchIdx++) {
    const benchmark = selectedBenchmarks[benchIdx]!;
    const benchProgress = `[${benchIdx + 1}/${selectedBenchmarks.length}]`;
    console.log(`Running %c"${benchmark.label}"%c...`, ORANGE, "");

    // --- Warmup (untimed) ---
    if (benchmark.warmup > 0) {
      for (const setup of setups) {
        for (let i = 0; i < benchmark.warmup; i++) {
          statusEl.textContent = `${benchProgress} "${benchmark.label}" — warming up ${setup.label} (${i + 1}/${benchmark.warmup})`;
          const app = await setup.createApp({ css: false, visible: false });
          if (benchmark.before) {
            benchmark.before(app);
            await afterRender();
          }
          benchmark.run(app);
          await afterRender();
          await app.destroy();
        }
      }
    }

    // --- Round-robin sampling ---
    const rawSamples: Map<string, number[]> = new Map();
    for (const setup of setups) {
      rawSamples.set(setup.label, []);
    }

    let totalRounds = 0;
    const benchStart = performance.now();

    while (performance.now() - benchStart < durationMs) {
      const elapsed = floor((performance.now() - benchStart) / 1000, 1);
      statusEl.textContent = `${benchProgress} "${benchmark.label}" — round ${totalRounds + 1} (${elapsed}s / ${duration}s)`;
      const roundOrder = shuffled(setups);
      for (const setup of roundOrder) {
        const app = await setup.createApp({ css: false, visible: false });
        if (benchmark.before) {
          benchmark.before(app);
          await afterRender();
        }
        const t0 = performance.now();
        benchmark.run(app);
        await afterRender();
        const elapsed = performance.now() - t0;
        rawSamples.get(setup.label)!.push(elapsed);
        await app.destroy();
      }
      totalRounds++;
    }

    const totalElapsed = floor((performance.now() - benchStart) / 1000, 2);
    console.log(`  Completed ${totalRounds} rounds in ${totalElapsed}s`);

    // --- Post-hoc analysis ---
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

    console.log(`\nCase %c"${benchmark.label}"%c results:`, ORANGE, "");

    for (const setup of setups) {
      const raw = rawSamples.get(setup.label)!;
      const sorted = raw.slice().sort((a, b) => a - b);
      const [lo, hi] = iqrFences(sorted);
      const filtered = sorted.filter((v) => v >= lo && v <= hi);
      const outlierCount = raw.length - filtered.length;

      const ci = confidenceInterval95(filtered);
      const med = medianOf(filtered);
      const sd = stddev(filtered);
      const cv = ci.mean > 0 ? sd / ci.mean : 0;
      // Mean excluding the single slowest sample (guards against GC pauses)
      const trimmedMean =
        filtered.length > 1
          ? filtered.slice(0, -1).reduce((a, b) => a + b, 0) / (filtered.length - 1)
          : ci.mean;

      results.push({ label: setup.label, filtered, outlierCount, ci, med, sd, cv, trimmedMean });
    }

    // Store means for geometric mean calculation
    for (const r of results) {
      meansBySetup.get(r.label)!.push(r.ci.mean);
      trimmedMeansBySetup.get(r.label)!.push(r.trimmedMean);
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const pctChange =
        i > 0
          ? ` %c(${floor(((r.ci.mean - results[0]!.ci.mean) / results[0]!.ci.mean) * 100, 1)}%)%c`
          : "";
      const pctStyles = i > 0 ? [r.ci.mean < results[0]!.ci.mean ? GREEN : RED, ""] : [];

      console.log(
        `  %c${r.label}%c: n=${r.filtered.length} (${r.outlierCount} outliers)\n` +
          `    mean = ${floor(r.ci.mean, 2)}ms  95%%CI [${floor(r.ci.lo, 2)}, ${floor(r.ci.hi, 2)}]  (±${floor(r.ci.ci, 2)}ms)\n` +
          `    mean (drop worst) = ${floor(r.trimmedMean, 2)}ms\n` +
          `    med  = ${floor(r.med, 2)}ms  sd=${floor(r.sd, 2)}ms  cv=${floor(r.cv * 100, 1)}%` +
          pctChange,
        ORANGE,
        "",
        ...pctStyles
      );
    }

    console.log("");

    // --- Build HTML for this benchmark ---
    const bestMean = Math.min(...results.map((r) => r.ci.mean));
    const bestTrimmed = Math.min(...results.map((r) => r.trimmedMean));
    const tableRows = results
      .map((r, i) => {
        const pct =
          i > 0
            ? floor(((r.ci.mean - results[0]!.ci.mean) / results[0]!.ci.mean) * 100, 1)
            : null;
        const pctBadge =
          pct !== null
            ? `<span class="badge ${pct < 0 ? "bg-success" : "bg-danger"}">${pct > 0 ? "+" : ""}${pct}%</span>`
            : "";
        const trimmedPct =
          i > 0
            ? floor(((r.trimmedMean - results[0]!.trimmedMean) / results[0]!.trimmedMean) * 100, 1)
            : null;
        const trimmedBadge =
          trimmedPct !== null
            ? `<span class="badge ${trimmedPct < 0 ? "bg-success" : "bg-danger"}">${trimmedPct > 0 ? "+" : ""}${trimmedPct}%</span>`
            : "";
        const isBest = r.ci.mean === bestMean;
        const isBestTrimmed = r.trimmedMean === bestTrimmed;
        const rowClass = isBest ? ' class="table-success"' : "";
        return `<tr${rowClass}>
          <td class="fw-bold">${r.label}</td>
          <td>${r.filtered.length} <small class="text-muted">(${r.outlierCount} outliers)</small></td>
          <td class="fw-bold">${floor(r.ci.mean, 2)}ms ${pctBadge}</td>
          <td class="${isBestTrimmed ? "fw-bold" : ""}">${floor(r.trimmedMean, 2)}ms ${trimmedBadge}</td>
          <td>[${floor(r.ci.lo, 2)}, ${floor(r.ci.hi, 2)}] <small class="text-muted">\u00b1${floor(r.ci.ci, 2)}ms</small></td>
          <td>${floor(r.med, 2)}ms</td>
          <td>${floor(r.sd, 2)}ms</td>
          <td>${floor(r.cv * 100, 1)}%</td>
        </tr>`;
      })
      .join("");

    htmlSections.push(
      `<div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">${benchmark.label}</h5>
          <small class="text-muted">${totalRounds} rounds in ${totalElapsed}s</small>
        </div>
        <div class="card-body p-0">
          <table class="table table-sm table-hover mb-0">
            <thead>
              <tr>
                <th>Setup</th>
                <th>Samples</th>
                <th>Mean</th>
                <th>Mean (drop worst)</th>
                <th>95% CI</th>
                <th>Median</th>
                <th>Std Dev</th>
                <th>CV</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`
    );
  }

  // --- Geometric mean summary ---
  if (setups.length > 1 && selectedBenchmarks.length > 1) {
    const geoMeans: { label: string; geoMean: number; geoMeanTrimmed: number }[] = [];

    // For each benchmark, find the best (lowest) mean
    const bestMeans: number[] = [];
    const bestTrimmedMeans: number[] = [];
    for (let b = 0; b < selectedBenchmarks.length; b++) {
      let best = Infinity;
      let bestTrimmed = Infinity;
      for (const setup of setups) {
        const mean = meansBySetup.get(setup.label)![b]!;
        const trimmed = trimmedMeansBySetup.get(setup.label)![b]!;
        if (mean < best) best = mean;
        if (trimmed < bestTrimmed) bestTrimmed = trimmed;
      }
      bestMeans.push(best);
      bestTrimmedMeans.push(bestTrimmed);
    }

    for (const setup of setups) {
      const means = meansBySetup.get(setup.label)!;
      const trimmedMeans = trimmedMeansBySetup.get(setup.label)!;
      let logSum = 0;
      let logSumTrimmed = 0;
      for (let b = 0; b < means.length; b++) {
        logSum += Math.log(means[b]! / bestMeans[b]!);
        logSumTrimmed += Math.log(trimmedMeans[b]! / bestTrimmedMeans[b]!);
      }
      const geoMean = Math.exp(logSum / means.length);
      const geoMeanTrimmed = Math.exp(logSumTrimmed / trimmedMeans.length);
      geoMeans.push({ label: setup.label, geoMean, geoMeanTrimmed });
    }

    const bestGeo = Math.min(...geoMeans.map((g) => g.geoMean));
    const bestGeoTrimmed = Math.min(...geoMeans.map((g) => g.geoMeanTrimmed));
    const geoRows = geoMeans
      .map((g) => {
        const isBest = g.geoMean === bestGeo;
        const isBestTrimmed = g.geoMeanTrimmed === bestGeoTrimmed;
        const rowClass = isBest ? ' class="table-success"' : "";
        const score = floor(g.geoMean, 3);
        const scoreTrimmed = floor(g.geoMeanTrimmed, 3);
        return `<tr${rowClass}>
          <td class="fw-bold">${g.label}</td>
          <td class="fw-bold">${score}x</td>
          <td class="${isBestTrimmed ? "fw-bold" : ""}">${scoreTrimmed}x</td>
        </tr>`;
      })
      .join("");

    console.log("Geometric mean (lower is better):");
    for (const g of geoMeans) {
      console.log(`  %c${g.label}%c: ${floor(g.geoMean, 3)}x  (trimmed: ${floor(g.geoMeanTrimmed, 3)}x)`, ORANGE, "");
    }

    htmlSections.push(
      `<div class="card mb-3 border-primary">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">Geometric Mean (lower is better)</h5>
        </div>
        <div class="card-body p-0">
          <table class="table table-sm table-hover mb-0">
            <thead>
              <tr>
                <th>Setup</th>
                <th>Score</th>
                <th>Score (trimmed)</th>
              </tr>
            </thead>
            <tbody>${geoRows}</tbody>
          </table>
        </div>
      </div>`
    );
  }

  statusEl.textContent = "";
  fixture.innerHTML = `<div class="p-3">${htmlSections.join("")}</div>`;

  startButton.disabled = false;
  startButton.textContent = "Rerun";
  startButton.focus();
}

// Console colors
const GREEN = "color: #40e040; font-weight: bold;";
const ORANGE = "color: #f08040; font-weight: bold;";
const RED = "color: #e04040; font-weight: bold;";

const statusEl = document.getElementById("status") as HTMLSpanElement;
const startButton = document.getElementById("start") as HTMLButtonElement;

if (hashHas("autorun")) {
  startButton.disabled = true;
  startButton.textContent = "Running";
  setHash("");
  snapshotsReady.then(() => requestAnimationFrame(runBenchmarks));
}

startButton.addEventListener("click", () => window.close());
