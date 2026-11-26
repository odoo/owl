// --- Data model ---

export interface Row {
  id: number;
  label: string;
}

const ADJECTIVES = [
  "pretty", "large", "big", "small", "tall", "short", "long", "handsome",
  "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful",
  "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap",
  "expensive", "fancy",
];
const COLOURS = [
  "red", "yellow", "blue", "green", "pink", "brown", "purple", "brown",
  "white", "black", "orange",
];
const NOUNS = [
  "table", "chair", "house", "bbq", "desk", "car", "pony", "cookie",
  "sandwich", "burger", "pizza", "mouse", "keyboard",
];

let nextId = 1;

export function buildData(count: number): Row[] {
  const data: Row[] = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${ADJECTIVES[randInt(ADJECTIVES.length)]} ${COLOURS[randInt(COLOURS.length)]} ${NOUNS[randInt(NOUNS.length)]}`,
    };
  }
  return data;
}

// --- Benchmark interfaces ---

export interface BenchmarkApp {
  create(count: number): void;
  update(mod: number): void;
  incrementCounters(mod: number): void;
  select(index: number): void;
  swap(a: number, b: number): void;
  remove(index: number): void;
  append(count: number): void;
  clear(): void;
  destroy(): Promise<void>;
}

export interface OwlSetup {
  label: string;
  owl: any;
  enabled?: boolean;
  snapshotId?: string;
  createApp(options?: { css?: boolean; visible?: boolean }): Promise<BenchmarkApp>;
}

export interface BenchmarkDef {
  label: string;
  warmup: number;
  before?(app: BenchmarkApp): void;
  run(app: BenchmarkApp): void;
}

// --- 10 standard benchmark operations ---

export const BENCHMARKS: BenchmarkDef[] = [
  { label: "Create 2,000 rows", warmup: 0, run: (app) => app.create(2_000) },
  { label: "Replace all rows", warmup: 5, before: (app) => app.create(2_000), run: (app) => app.create(2_000) },
  { label: "Partial update", warmup: 5, before: (app) => app.create(2_000), run: (app) => app.update(10) },
  { label: "Click counter", warmup: 5, before: (app) => app.create(2_000), run: (app) => app.incrementCounters(10) },
  { label: "Select row", warmup: 5, before: (app) => app.create(2_000), run: (app) => app.select(1) },
  { label: "Swap rows", warmup: 5, before: (app) => app.create(2_000), run: (app) => app.swap(1, 998) },
  { label: "Remove row", warmup: 5, before: (app) => app.create(2_000), run: (app) => app.remove(4) },
  { label: "Create 10,000 rows", warmup: 0, run: (app) => app.create(10_000) },
  { label: "Append rows", warmup: 0, before: (app) => app.create(2_000), run: (app) => app.append(1_000) },
  { label: "Clear rows", warmup: 0, before: (app) => app.create(2_000), run: (app) => app.clear() },
];

// --- Utility functions ---

export function choose<T>(list: T[]) {
  return list[randInt(list.length)]!;
}

export function floor(n: number, rounding: number = 0) {
  const mult = 10 ** rounding;
  return Math.floor(n * mult) / mult;
}

export function randBool() {
  return Math.random() < 0.5;
}

export function randFloat(start: number, end?: number) {
  if (!end) {
    end = start;
    start = 0;
  }
  return Math.random() * (end - start) + start;
}

export function randInt(start: number, end?: number) {
  return Math.floor(randFloat(start, end));
}

export function ratio(min: number, max: number) {
  return Math.floor((1 - min / max) * 100);
}

export function shuffled<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function sum(numbers: Iterable<number>) {
  let total = 0;
  for (const n of numbers) {
    total += n;
  }
  return total;
}

// --- Statistical utilities ---

/** Interpolated percentile on a pre-sorted array (0-1). */
export function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Returns [lower, upper] Tukey fences: Q1 - 1.5*IQR, Q3 + 1.5*IQR. */
export function iqrFences(sorted: number[]): [number, number] {
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  return [q1 - 1.5 * iqr, q3 + 1.5 * iqr];
}

/** Sample standard deviation (Bessel-corrected, n-1). */
export function stddev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/** Coefficient of variation: stddev / mean. */
export function coefficientOfVariation(values: number[]): number {
  const n = values.length;
  if (n < 2) return Infinity;
  const m = values.reduce((a, b) => a + b, 0) / n;
  if (m === 0) return Infinity;
  return stddev(values) / m;
}

/** Correct median of a pre-sorted array. */
export function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Two-tailed t critical values for 95% confidence. */
function tCritical(df: number): number {
  const table: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021,
    50: 2.009, 60: 2.000, 80: 1.990, 100: 1.984, 120: 1.980,
  };
  if (table[df]) return table[df];
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (let i = keys.length - 1; i >= 0; i--) {
    if (keys[i]! <= df) return table[keys[i]!]!;
  }
  return 1.96;
}

/** 95% confidence interval for the mean. Returns {mean, ci, lo, hi}. */
export function confidenceInterval95(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, ci: 0, lo: mean, hi: mean };
  const se = stddev(values) / Math.sqrt(n);
  const df = n - 1;
  const t = tCritical(df);
  const ci = t * se;
  return { mean, ci, lo: mean - ci, hi: mean + ci };
}

/** Welch's t-test for two independent samples (95% confidence). */
export function welchTTest(a: number[], b: number[]) {
  const nA = a.length;
  const nB = b.length;
  const mA = a.reduce((s, v) => s + v, 0) / nA;
  const mB = b.reduce((s, v) => s + v, 0) / nB;
  const vA = a.reduce((s, v) => s + (v - mA) ** 2, 0) / (nA - 1);
  const vB = b.reduce((s, v) => s + (v - mB) ** 2, 0) / (nB - 1);
  const seA = vA / nA;
  const seB = vB / nB;
  const seDiff = Math.sqrt(seA + seB);
  if (seDiff === 0) return { t: 0, df: nA + nB - 2, significant: false };
  const t = (mA - mB) / seDiff;
  const df = (seA + seB) ** 2 / (seA ** 2 / (nA - 1) + seB ** 2 / (nB - 1));
  const tc = tCritical(Math.floor(df));
  return { t, df, significant: Math.abs(t) > tc };
}
