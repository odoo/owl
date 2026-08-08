import { memo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { addSetup, buildData, createIsolatedContainer, type BenchmarkApp, type Row } from "../src/utils";

const Counter = memo(function Counter({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <span>{value}</span>{" "}
      <button className="counter-btn btn btn-sm btn-outline-secondary" onClick={() => setValue((v) => v + 1)}>+</button>
    </>
  );
});

const TableRow = memo(function TableRow({
  row,
  selected,
  onSelect,
  onRemove,
}: {
  row: Row;
  selected: boolean;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <tr className={selected ? "table-danger" : ""}>
      <td className="col-md-1">
        <span className="badge bg-secondary rounded-pill">{row.id}</span>
      </td>
      <td className="col-md-4">
        <div className="d-flex align-items-center gap-2">
          <span className="icon text-muted" aria-hidden="true">&#9733;</span>
          <a className="fw-normal text-decoration-none" onClick={() => onSelect(row.id)}>{row.label}</a>
        </div>
      </td>
      <td className="col-md-1 text-end">
        <span className="badge bg-info text-dark">Active</span>
      </td>
      <td className="col-md-1">
        <a className="btn btn-sm btn-outline-danger" aria-label="Remove" title="Remove" onClick={() => onRemove(row.id)}>
          <span className="icon" aria-hidden="true">&#10005;</span>
        </a>
      </td>
      <td className="col-md-1">
        <Counter initialValue={row.id}/>
      </td>
      <td className="col-md-5">
        <div className="d-flex justify-content-end gap-1">
          <span className="text-muted small">Item</span>
          <span className="text-muted small">#</span>
          <span className="text-muted small">{row.id}</span>
        </div>
      </td>
    </tr>
  );
});

function Table({ rows, selectedId, onSelect, onRemove }: {
  rows: Row[];
  selectedId: number;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <table className="table table-hover table-striped test-data">
      <tbody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            row={row}
            selected={selectedId === row.id}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}
      </tbody>
    </table>
  );
}

addSetup({
  label: "React",
  owl: null,
  async createApp(options?) {
    const { container, cleanup } = createIsolatedContainer(options);
    const root: Root = createRoot(container);

    let currentRows: Row[] = [];
    let currentSelectedId = 0;

    const handleSelect = (id: number) => {
      currentSelectedId = id;
      render();
    };
    const handleRemove = (id: number) => {
      const idx = currentRows.findIndex((r) => r.id === id);
      if (idx === -1) return;
      currentRows = currentRows.slice();
      currentRows.splice(idx, 1);
      render();
    };

    function render() {
      flushSync(() => {
        root.render(
          <Table rows={currentRows} selectedId={currentSelectedId} onSelect={handleSelect} onRemove={handleRemove} />
        );
      });
    }

    render();

    return {
      create(count: number) {
        currentRows = buildData(count);
        currentSelectedId = 0;
        render();
      },
      update(mod: number) {
        currentRows = currentRows.map((r, i) =>
          i % mod === 0 ? { ...r, label: r.label + " !!!" } : r
        );
        render();
      },
      select(index: number) {
        currentSelectedId = currentRows[index]!.id;
        render();
      },
      swap(a: number, b: number) {
        currentRows = currentRows.slice();
        const tmp = currentRows[a]!;
        currentRows[a] = currentRows[b]!;
        currentRows[b] = tmp;
        render();
      },
      remove(index: number) {
        currentRows = currentRows.slice();
        currentRows.splice(index, 1);
        render();
      },
      append(count: number) {
        currentRows = [...currentRows, ...buildData(count)];
        render();
      },
      incrementCounters(mod: number) {
        const btns = container.querySelectorAll<HTMLButtonElement>('.counter-btn');
        for (let i = 0; i < btns.length; i += mod) {
          btns[i]!.click();
        }
      },
      clear() {
        currentRows = [];
        currentSelectedId = 0;
        render();
      },
      async destroy() {
        root.unmount();
        cleanup();
      },
    } satisfies BenchmarkApp;
  },
});
