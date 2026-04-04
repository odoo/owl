import * as owl from "../../../src";
import { Component, signal, Signal, xml, props } from "../../../src";
import { addSetup, buildData, createIsolatedContainer, type BenchmarkApp, type Row } from "../src/utils";

interface SignalRow {
  id: number;
  label: Signal<string>;
}

function toSignalRows(rows: Row[]): SignalRow[] {
  return rows.map((r) => ({ id: r.id, label: signal(r.label) }));
}

class Counter extends Component {
  static override template = xml`
    <span t-out="this.value()"/> <button class="counter-btn btn btn-sm btn-outline-secondary" t-on-click="this.increment">+</button>
  `;
  props = props();
  value = signal(this.props.initialValue as number);

  increment() {
    this.value.set(this.value() + 1);
  }
}

class TableRow extends Component {
  static components = { Counter };
  static override template = xml`
    <tr t-att-class="this.props.selected ? 'table-danger' : ''">
      <td class="col-md-1">
        <span class="badge bg-secondary rounded-pill" t-out="this.props.row.id"/>
      </td>
      <td class="col-md-4">
        <div class="d-flex align-items-center gap-2">
          <span class="icon text-muted" aria-hidden="true">&#9733;</span>
          <a class="fw-normal text-decoration-none" t-on-click="this.props.onSelect" t-out="this.props.row.label()"/>
        </div>
      </td>
      <td class="col-md-1 text-end">
        <span class="badge bg-info text-dark">Active</span>
      </td>
      <td class="col-md-1">
        <a class="btn btn-sm btn-outline-danger" aria-label="Remove" title="Remove" t-on-click="this.props.onRemove">
          <span class="icon" aria-hidden="true">&#10005;</span>
        </a>
      </td>
      <td class="col-md-1">
        <Counter initialValue="this.props.row.id"/>
      </td>
      <td class="col-md-5">
        <div class="d-flex justify-content-end gap-1">
          <span class="text-muted small">Item</span>
          <span class="text-muted small">#</span>
          <span class="text-muted small" t-out="this.props.row.id"/>
        </div>
      </td>
    </tr>
  `;
  props = props();
}

class Root extends Component {
  static components = { TableRow };
  static override template = xml`
    <table class="table table-hover table-striped test-data">
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

addSetup({
  label: "Owl 3 (signal)",
  owl,
  async createApp(options?) {
    const { container, cleanup } = createIsolatedContainer(options);
    const comp = await owl.mount(Root, container, {});
    return {
      create(count: number) {
        comp.rows.set(toSignalRows(buildData(count)));
      },
      update(mod: number) {
        const rows = comp.rows();
        for (let i = 0; i < rows.length; i += mod) {
          rows[i]!.label.set(rows[i]!.label() + " !!!");
        }
      },
      select(index: number) {
        comp.selectedId.set(comp.rows()[index]!.id);
      },
      swap(a: number, b: number) {
        const rows = comp.rows();
        const tmp = rows[a]!;
        rows[a] = rows[b]!;
        rows[b] = tmp;
      },
      remove(index: number) {
        comp.rows().splice(index, 1);
      },
      append(count: number) {
        comp.rows().push(...toSignalRows(buildData(count)));
      },
      incrementCounters(mod: number) {
        const btns = container.querySelectorAll<HTMLButtonElement>('.counter-btn');
        for (let i = 0; i < btns.length; i += mod) {
          btns[i]!.click();
        }
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
});
