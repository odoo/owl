import {
  cleanup,
  floor,
  getBenchmarkCases,
  getConfig,
  getSampleData,
  getSetups,
  hashHas,
  ratio,
  setHash,
  SortedList,
  sum,
} from "./utils";

async function runBenchmarks() {
  const config = getConfig();
  const { duration, warmupSampleSize } = config;
  const durationMs = duration * 1000;

  const cases = getBenchmarkCases();
  const setups = getSetups();
  console.log("Running", cases.length, "cases");
  console.table(config);

  for (const { label, setup, run } of cases) {
    console.log(`Running %c"${label}"%c...`, ORANGE, "");
    const results = [];
    let mostSamples = -Infinity;
    let leastSamples = Infinity;
    let fastestAvg = Infinity;
    let slowestAvg = -Infinity;
    let fastestMed = Infinity;
    let slowestMed = -Infinity;
    for (const [owlLabel, owlSetup] of setups) {
      console.group(owlLabel);
      const setupResult = await setup?.(owlSetup, getSampleData());
      for (let i = 0; i < warmupSampleSize; i++) {
        const sampleResult = await run(owlSetup, setupResult);
        await cleanup(sampleResult);
      }
      console.log(`-> Starting benchmark cases...`);
      const sampleTimes = new SortedList();
      const outliers = new SortedList();
      let min = Infinity;
      let totalTime = 0;
      while (sum(sampleTimes) < durationMs) {
        if (totalTime > durationMs && outliers.length) {
          // Total time exceeded: start putting outliers in main list
          sampleTimes.insert(outliers.shift()!);
          continue;
        }
        const sampleStartTime = performance.now();
        const sampleResult = await run(owlSetup, setupResult);
        const sampleTime = performance.now() - sampleStartTime;
        totalTime += sampleTime;
        if (sampleTime < min) {
          min = sampleTime;
          outliers.insert(...sampleTimes.removeHighestThan(min * OUTLIER_RATIO));
          sampleTimes.unshift(sampleTime);
        } else if (sampleTime < min * OUTLIER_RATIO) {
          sampleTimes.insert(sampleTime);
        } else {
          outliers.insert(sampleTime);
        }
        await cleanup(sampleResult);
      }

      await cleanup(setupResult);

      const sampleSize = sampleTimes.length;
      const finalTime = sum(sampleTimes) + sum(outliers);
      const avg = sampleTimes.average();
      const med = sampleTimes.median();
      results.push({
        label: owlLabel,
        totalTime: finalTime,
        totalSize: sampleSize,
        avg,
        med,
      });
      if (sampleSize > mostSamples) {
        mostSamples = sampleSize;
      }
      if (sampleSize < leastSamples) {
        leastSamples = sampleSize;
      }
      if (avg < fastestAvg) {
        fastestAvg = avg;
      }
      if (med < fastestMed) {
        fastestMed = med;
      }
      if (avg > slowestAvg) {
        slowestAvg = avg;
      }
      if (med > slowestMed) {
        slowestMed = med;
      }
      console.log(
        `-> Finished %c${sampleSize}%c samples in %c${floor(
          finalTime
        )}%cms (ignored %c${outliers.length}%c outliers)`,
        PURPLE,
        "",
        PURPLE,
        "",
        PURPLE,
        ""
      );
      console.groupEnd();
    }

    const logs = [`Case %c"${label}"%c finished:`];
    const styles = [ORANGE, ""];
    for (const result of results) {
      let avgOffset = "%c%c";
      if (result.avg !== fastestAvg) {
        avgOffset = `(+%c${ratio(fastestAvg, result.avg)}%c%) `;
      }
      let medOffset = "%c%c";
      if (result.med !== fastestMed) {
        medOffset = `(+%c${ratio(fastestMed, result.med)}%c%) `;
      }
      logs.push(
        `> %c${result.label}%c: (%c${result.totalSize}%c samples in %c${floor(
          result.totalTime
        )}%cms) avg=%c${floor(result.avg, 2)}%cms ${avgOffset}/ med=%c${floor(
          result.med,
          2
        )}%cms ${medOffset}`
      );
      styles.push(
        ORANGE,
        "",
        result.totalSize === mostSamples ? GREEN : result.totalSize === leastSamples ? RED : PURPLE,
        "",
        PURPLE,
        "",
        result.avg === fastestAvg ? GREEN : result.avg === slowestAvg ? RED : PURPLE,
        "",
        RED,
        "",
        result.med === fastestMed ? GREEN : result.med === slowestMed ? RED : PURPLE,
        "",
        RED,
        ""
      );
    }
    console.log(logs.join("\n"), ...styles);
  }

  startButton.disabled = false;
  startButton.textContent = "Rerun";
  startButton.focus();
}

const OUTLIER_RATIO = 3;

// Console colors
const GREEN = "color: #40e040; font-weight: bold;";
const ORANGE = "color: #f08040; font-weight: bold;";
const PURPLE = "color: #a080e0; font-weight: bold;";
const RED = "color: #e04040; font-weight: bold;";

const startButton = document.getElementById("start") as HTMLButtonElement;

if (hashHas("autorun")) {
  startButton.disabled = true;
  startButton.textContent = "Running";
  setHash("");
  requestAnimationFrame(runBenchmarks);
}

startButton.addEventListener("click", () => window.close());
