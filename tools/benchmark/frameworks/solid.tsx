/** @jsxImportSource solid-js */
import { createSignal, For, type Accessor } from "solid-js";
import { render } from "solid-js/web";
import { addSetup, buildData, createIsolatedContainer, type BenchmarkApp, type Row } from "../src/utils";

interface SolidRow {
  id: number;
  label: Accessor<string>;
  setLabel: (v: string) => void;
}

function toSolidRows(rows: Row[]): SolidRow[] {
  return rows.map((r) => {
    const [label, setLabel] = createSignal(r.label);
    return { id: r.id, label, setLabel };
  });
}

function Counter(props: { initialValue: number }) {
  const [value, setValue] = createSignal(props.initialValue);
  return (
    <>
      <span>{value()}</span>{" "}
      <button class="counter-btn btn btn-sm btn-outline-secondary" on:click={() => setValue((v) => v + 1)}>+</button>
    </>
  );
}

function TableRow(props: {
  row: SolidRow;
  selected: Accessor<boolean>;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <tr class={props.selected() ? "table-danger" : ""}>
      <td class="col-md-1">
        <span class="badge bg-secondary rounded-pill">{props.row.id}</span>
      </td>
      <td class="col-md-4">
        <div class="d-flex align-items-center gap-2">
          <span class="icon text-muted" aria-hidden="true">&#9733;</span>
          <a class="fw-normal text-decoration-none" on:click={props.onSelect}>{props.row.label()}</a>
        </div>
      </td>
      <td class="col-md-1 text-end">
        <span class="badge bg-info text-dark">Active</span>
      </td>
      <td class="col-md-1">
        <a class="btn btn-sm btn-outline-danger" aria-label="Remove" title="Remove" on:click={props.onRemove}>
          <span class="icon" aria-hidden="true">&#10005;</span>
        </a>
      </td>
      <td class="col-md-1">
        <Counter initialValue={props.row.id}/>
      </td>
      <td class="col-md-5">
        <div class="d-flex justify-content-end gap-1">
          <span class="text-muted small">Item</span>
          <span class="text-muted small">#</span>
          <span class="text-muted small">{props.row.id}</span>
        </div>
      </td>
    </tr>
  );
}

function App(props: { api: API }) {
  const [rows, setRows] = createSignal<SolidRow[]>([]);
  const [selectedId, setSelectedId] = createSignal(0);

  props.api.rows = rows;
  props.api.setRows = setRows;
  props.api.setSelectedId = setSelectedId;

  return (
    <table class="table table-hover table-striped test-data">
      <tbody>
        <For each={rows()}>
          {(row) => (
            <TableRow
              row={row}
              selected={() => selectedId() === row.id}
              onSelect={() => setSelectedId(row.id)}
              onRemove={() =>
                setRows((prev) => {
                  const idx = prev.findIndex((r) => r.id === row.id);
                  if (idx === -1) return prev;
                  const next = prev.slice();
                  next.splice(idx, 1);
                  return next;
                })
              }
            />
          )}
        </For>
      </tbody>
    </table>
  );
}

interface API {
  rows: Accessor<SolidRow[]>;
  setRows: (v: SolidRow[] | ((prev: SolidRow[]) => SolidRow[])) => void;
  setSelectedId: (v: number) => void;
}

addSetup({
  label: "Solid",
  owl: null,
  async createApp(options?) {
    const { container, cleanup } = createIsolatedContainer(options);

    const api: API = {
      rows: () => [],
      setRows: () => {},
      setSelectedId: () => {},
    };
    const dispose = render(() => <App api={api} />, container);

    return {
      create(count: number) {
        api.setRows(toSolidRows(buildData(count)));
        api.setSelectedId(0);
      },
      update(mod: number) {
        const current = api.rows();
        for (let i = 0; i < current.length; i += mod) {
          const row = current[i]!;
          row.setLabel(row.label() + " !!!");
        }
      },
      select(index: number) {
        api.setSelectedId(api.rows()[index]!.id);
      },
      swap(a: number, b: number) {
        api.setRows((prev) => {
          const next = prev.slice();
          const tmp = next[a]!;
          next[a] = next[b]!;
          next[b] = tmp;
          return next;
        });
      },
      remove(index: number) {
        api.setRows((prev) => {
          const next = prev.slice();
          next.splice(index, 1);
          return next;
        });
      },
      append(count: number) {
        api.setRows((prev) => [...prev, ...toSolidRows(buildData(count))]);
      },
      incrementCounters(mod: number) {
        const btns = container.querySelectorAll<HTMLButtonElement>('.counter-btn');
        for (let i = 0; i < btns.length; i += mod) {
          btns[i]!.click();
        }
      },
      clear() {
        api.setRows([]);
        api.setSelectedId(0);
      },
      async destroy() {
        dispose();
        cleanup();
      },
    } satisfies BenchmarkApp;
  },
});
