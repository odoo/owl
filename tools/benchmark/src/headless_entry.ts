/**
 * Browser-side benchmark entry point.
 *
 * This file is bundled with esbuild and injected into a headless Chromium page
 * by run_node.ts. It defines all framework setups (Vanilla JS, Owl signal,
 * Owl state), runs the benchmark loop, and stores raw timing samples in
 * window.__BENCH_RESULTS__ for the Node orchestrator to collect.
 *
 * Config is read from window.__BENCH_CONFIG__.
 * Progress is reported via window.__benchProgress__(msg).
 */

import * as owl from "../../../src";
import {
  BENCHMARKS,
  buildData,
  shuffled,
  type BenchmarkApp,
  type Row,
} from "./shared";

const { Component, signal, xml, props, proxy, mount } = owl;

// ---------------------------------------------------------------------------
// Config & progress
// ---------------------------------------------------------------------------

interface BenchConfig {
  duration: number;
  benchIndices: number[];
  variantFilter: "signal" | "state" | "all";
}

const config: BenchConfig = (window as any).__BENCH_CONFIG__;
const progress: (msg: string) => void =
  (window as any).__benchProgress__ || (() => {});

// ---------------------------------------------------------------------------
// afterRender — wait for framework schedulers to flush + one extra rAF
// ---------------------------------------------------------------------------

function afterRender(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    }, 0);
  });
}

// ---------------------------------------------------------------------------
// Container helper — isolated iframe per app instance
// ---------------------------------------------------------------------------

function createContainer(): { container: HTMLElement; cleanup: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return {
    container,
    cleanup() {
      container.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// Setup interface
// ---------------------------------------------------------------------------

interface Setup {
  label: string;
  createApp(): Promise<BenchmarkApp>;
}

// ---------------------------------------------------------------------------
// Vanilla JS setup (baseline)
// ---------------------------------------------------------------------------

function createVanillaSetup(): Setup {
  return {
    label: "Vanilla JS",
    async createApp() {
      const { container, cleanup } = createContainer();

      const rowTemplate = document.createElement("tr");
      rowTemplate.innerHTML =
        "<td> </td>" +
        "<td><a class='lbl'> </a></td>" +
        "<td><a class='remove'>x</a></td>" +
        "<td><span> </span> <button class='counter-btn'>+</button></td>";

      const table = document.createElement("table");
      const tbody = document.createElement("tbody");
      table.appendChild(tbody);
      container.appendChild(table);

      let trs: HTMLElement[] = [];
      let dataArr: Row[] = [];
      let counters: number[] = [];
      let selectedIdx = -1;

      // Event delegation
      tbody.addEventListener("click", (e) => {
        let node = e.target as HTMLElement | null;
        let action: "select" | "remove" | "counter" | null = null;
        while (node && node !== tbody) {
          const cls = node.className;
          if (cls === "lbl") action = "select";
          else if (cls === "remove") action = "remove";
          else if (cls === "counter-btn") action = "counter";

          if (action && (node as any)._idx !== undefined) {
            const idx = (node as any)._idx as number;
            if (action === "select") {
              doSelect(idx);
            } else if (action === "remove") {
              doRemove(idx);
            } else {
              counters[idx]!++;
              node.childNodes[3]!.firstChild!.firstChild!.nodeValue =
                String(counters[idx]);
            }
            break;
          }
          node = node.parentElement;
        }
      });

      function doSelect(idx: number) {
        if (selectedIdx !== -1 && trs[selectedIdx])
          trs[selectedIdx]!.className = "";
        selectedIdx = idx;
        trs[idx]!.className = "selected";
      }

      function doRemove(idx: number) {
        trs[idx]!.remove();
        trs.splice(idx, 1);
        dataArr.splice(idx, 1);
        counters.splice(idx, 1);
        for (let i = idx, len = trs.length; i < len; i++)
          (trs[i] as any)._idx = i;
        if (selectedIdx === idx) selectedIdx = -1;
        else if (selectedIdx > idx) selectedIdx--;
      }

      function createRow(row: Row, idx: number): HTMLElement {
        const tr = rowTemplate.cloneNode(true) as HTMLElement;
        (tr as any)._idx = idx;
        const td1 = tr.firstChild!;
        const td2 = td1.nextSibling!;
        const td4 = td2.nextSibling!.nextSibling!;
        td1.firstChild!.nodeValue = String(row.id);
        td2.firstChild!.firstChild!.nodeValue = row.label;
        td4.firstChild!.firstChild!.nodeValue = String(row.id);
        return tr;
      }

      function appendData(newData: Row[]) {
        const len = newData.length;
        const startIdx = trs.length;
        const empty = !tbody.firstChild;
        if (empty) tbody.remove();
        for (let i = 0; i < len; i++) {
          const row = newData[i]!;
          const tr = createRow(row, startIdx + i);
          trs[startIdx + i] = tr;
          dataArr[startIdx + i] = row;
          counters[startIdx + i] = row.id;
          tbody.appendChild(tr);
        }
        if (empty) table.insertBefore(tbody, null);
      }

      function clearAll() {
        tbody.textContent = "";
        trs = [];
        dataArr = [];
        counters = [];
        selectedIdx = -1;
      }

      return {
        create(count) {
          clearAll();
          appendData(buildData(count));
        },
        update(mod) {
          for (let i = 0, len = trs.length; i < len; i += mod) {
            dataArr[i]!.label += " !!!";
            trs[i]!.firstChild!.nextSibling!.firstChild!.firstChild!.nodeValue =
              dataArr[i]!.label;
          }
        },
        select(index) {
          doSelect(index);
        },
        swap(a, b) {
          const trA = trs[a]!;
          const trB = trs[b]!;
          trs[a] = trB;
          trs[b] = trA;
          (trA as any)._idx = b;
          (trB as any)._idx = a;
          let tmp: any = dataArr[a];
          dataArr[a] = dataArr[b]!;
          dataArr[b] = tmp;
          tmp = counters[a];
          counters[a] = counters[b]!;
          counters[b] = tmp;
          const refA = trA.nextSibling;
          const refB = trB.nextSibling;
          tbody.insertBefore(trB, refA);
          tbody.insertBefore(trA, refB);
        },
        remove(index) {
          doRemove(index);
        },
        append(count) {
          appendData(buildData(count));
        },
        incrementCounters(mod) {
          const btns =
            container.querySelectorAll<HTMLButtonElement>(".counter-btn");
          for (let i = 0; i < btns.length; i += mod) btns[i]!.click();
        },
        clear() {
          clearAll();
        },
        async destroy() {
          cleanup();
        },
      } satisfies BenchmarkApp;
    },
  };
}

// ---------------------------------------------------------------------------
// Owl 3 (signal) setup
// ---------------------------------------------------------------------------

interface SignalRow {
  id: number;
  label: ReturnType<typeof signal<string>>;
}

function toSignalRows(rows: Row[]): SignalRow[] {
  return rows.map((r) => ({ id: r.id, label: signal(r.label) }));
}

class SignalCounter extends Component {
  static override template = xml`
    <span t-out="this.value()"/> <button class="counter-btn" t-on-click="this.increment">+</button>
  `;
  props = props();
  value = signal(this.props.initialValue as number);
  increment() {
    this.value.set(this.value() + 1);
  }
}

class SignalTableRow extends Component {
  static components = { Counter: SignalCounter };
  static override template = xml`
    <tr t-att-class="this.props.selected ? 'selected' : ''">
      <td t-out="this.props.row.id"/>
      <td><a t-on-click="this.props.onSelect" t-out="this.props.row.label()"/></td>
      <td><a t-on-click="this.props.onRemove">x</a></td>
      <td><Counter initialValue="this.props.row.id"/></td>
    </tr>
  `;
  props = props();
}

class SignalRoot extends Component {
  static components = { TableRow: SignalTableRow };
  static override template = xml`
    <table>
      <tbody>
        <t t-foreach="this.rows()" t-as="row" t-key="row.id">
          <TableRow
            row="row"
            selected="row.id === this.selectedId()"
            onSelect.bind="() => this.doSelect(row.id)"
            onRemove.bind="() => this.doRemove(row.id)"
          />
        </t>
      </tbody>
    </table>
  `;
  rows = signal.Array<SignalRow>([]);
  selectedId = signal(0);

  doSelect(id: number) {
    this.selectedId.set(id);
  }
  doRemove(id: number) {
    const rows = this.rows();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx !== -1) rows.splice(idx, 1);
  }
}

function createSignalSetup(): Setup {
  return {
    label: "Owl 3 (signal)",
    async createApp() {
      const { container, cleanup } = createContainer();
      const comp = await mount(SignalRoot, container, {});
      return {
        create(count) {
          comp.rows.set(toSignalRows(buildData(count)));
        },
        update(mod) {
          const rows = comp.rows();
          for (let i = 0; i < rows.length; i += mod)
            rows[i]!.label.set(rows[i]!.label() + " !!!");
        },
        select(index) {
          comp.selectedId.set(comp.rows()[index]!.id);
        },
        swap(a, b) {
          const rows = comp.rows();
          const tmp = rows[a]!;
          rows[a] = rows[b]!;
          rows[b] = tmp;
        },
        remove(index) {
          comp.rows().splice(index, 1);
        },
        append(count) {
          comp.rows().push(...toSignalRows(buildData(count)));
        },
        incrementCounters(mod) {
          const btns =
            container.querySelectorAll<HTMLButtonElement>(".counter-btn");
          for (let i = 0; i < btns.length; i += mod) btns[i]!.click();
        },
        clear() {
          comp.rows.set([]);
        },
        async destroy() {
          (comp as any).__owl__.app.destroy();
          cleanup();
        },
      } satisfies BenchmarkApp;
    },
  };
}

// ---------------------------------------------------------------------------
// Owl 3 (state) setup
// ---------------------------------------------------------------------------

class StateCounter extends Component {
  static override template = xml`
    <span t-out="this.state.value"/> <button class="counter-btn" t-on-click="this.increment">+</button>
  `;
  props = props();
  state = proxy({ value: this.props.initialValue as number });
  increment() {
    this.state.value++;
  }
}

class StateTableRow extends Component {
  static components = { Counter: StateCounter };
  static override template = xml`
    <tr t-att-class="this.props.selected ? 'selected' : ''">
      <td t-out="this.props.row.id"/>
      <td><a t-on-click="this.props.onSelect" t-out="this.props.row.label"/></td>
      <td><a t-on-click="this.props.onRemove">x</a></td>
      <td><Counter initialValue="this.props.row.id"/></td>
    </tr>
  `;
  props = props();
}

class StateRoot extends Component {
  static components = { TableRow: StateTableRow };
  static override template = xml`
    <table>
      <tbody>
        <t t-foreach="this.state.rows" t-as="row" t-key="row.id">
          <TableRow
            row="row"
            selected="row.id === this.state.selectedId"
            onSelect.bind="() => this.doSelect(row.id)"
            onRemove.bind="() => this.doRemove(row.id)"
          />
        </t>
      </tbody>
    </table>
  `;
  state = proxy({ rows: [] as Row[], selectedId: 0 });

  doSelect(id: number) {
    this.state.selectedId = id;
  }
  doRemove(id: number) {
    const idx = this.state.rows.findIndex((r) => r.id === id);
    if (idx !== -1) this.state.rows.splice(idx, 1);
  }
}

function createStateSetup(): Setup {
  return {
    label: "Owl 3 (state)",
    async createApp() {
      const { container, cleanup } = createContainer();
      const comp = await mount(StateRoot, container, {});
      return {
        create(count) {
          comp.state.rows = buildData(count);
        },
        update(mod) {
          const rows = comp.state.rows;
          for (let i = 0; i < rows.length; i += mod) rows[i]!.label += " !!!";
        },
        select(index) {
          comp.state.selectedId = comp.state.rows[index]!.id;
        },
        swap(a, b) {
          const rows = comp.state.rows;
          const tmp = rows[a]!;
          rows[a] = rows[b]!;
          rows[b] = tmp;
        },
        remove(index) {
          comp.state.rows.splice(index, 1);
        },
        append(count) {
          comp.state.rows.push(...buildData(count));
        },
        incrementCounters(mod) {
          const btns =
            container.querySelectorAll<HTMLButtonElement>(".counter-btn");
          for (let i = 0; i < btns.length; i += mod) btns[i]!.click();
        },
        clear() {
          comp.state.rows = [];
        },
        async destroy() {
          (comp as any).__owl__.app.destroy();
          cleanup();
        },
      } satisfies BenchmarkApp;
    },
  };
}

// ---------------------------------------------------------------------------
// Build setup list
// ---------------------------------------------------------------------------

const allSetups: Setup[] = [createVanillaSetup()];
if (config.variantFilter === "all" || config.variantFilter === "signal") {
  allSetups.push(createSignalSetup());
}
if (config.variantFilter === "all" || config.variantFilter === "state") {
  allSetups.push(createStateSetup());
}

const selectedBenchmarks = config.benchIndices.map((i) => BENCHMARKS[i]!);
const durationMs = config.duration * 1000;

// ---------------------------------------------------------------------------
// Benchmark loop
// ---------------------------------------------------------------------------

interface BenchResult {
  benchLabel: string;
  rounds: number;
  elapsed: number;
  samples: Record<string, number[]>;
}

const results: BenchResult[] = [];

for (let b = 0; b < selectedBenchmarks.length; b++) {
  const benchmark = selectedBenchmarks[b]!;
  progress(
    JSON.stringify({
      type: "start",
      index: b,
      total: selectedBenchmarks.length,
      label: benchmark.label,
    })
  );

  // Warmup
  if (benchmark.warmup > 0) {
    for (const setup of allSetups) {
      for (let w = 0; w < benchmark.warmup; w++) {
        const app = await setup.createApp();
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

  // Round-robin sampling
  const rawSamples: Record<string, number[]> = {};
  for (const setup of allSetups) rawSamples[setup.label] = [];

  let totalRounds = 0;
  const benchStart = performance.now();

  while (performance.now() - benchStart < durationMs) {
    const roundOrder = shuffled(allSetups);
    for (const setup of roundOrder) {
      const app = await setup.createApp();
      if (benchmark.before) {
        benchmark.before(app);
        await afterRender();
      }
      const t0 = performance.now();
      benchmark.run(app);
      await afterRender();
      rawSamples[setup.label]!.push(performance.now() - t0);
      await app.destroy();
    }
    totalRounds++;
  }

  const elapsed = (performance.now() - benchStart) / 1000;

  progress(
    JSON.stringify({
      type: "done",
      index: b,
      rounds: totalRounds,
      elapsed,
    })
  );

  results.push({
    benchLabel: benchmark.label,
    rounds: totalRounds,
    elapsed,
    samples: rawSamples,
  });
}

// ---------------------------------------------------------------------------
// Publish results
// ---------------------------------------------------------------------------

(window as any).__BENCH_RESULTS__ = {
  setupLabels: allSetups.map((s) => s.label),
  results,
};
