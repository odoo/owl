import { createApp, ref, shallowRef, h, defineComponent, type App } from "vue";
import { addSetup, buildData, createIsolatedContainer, type BenchmarkApp, type Row } from "../src/utils";

const CounterComponent = defineComponent({
  props: {
    initialValue: { type: Number, required: true },
  },
  setup(props) {
    const value = ref(props.initialValue);
    return () =>
      h("span", {}, [
        h("span", {}, value.value),
        " ",
        h("button", { class: "counter-btn btn btn-sm btn-outline-secondary", onClick: () => { value.value++; } }, "+"),
      ]);
  },
});

const TableRow = defineComponent({
  props: {
    row: { type: Object as () => Row, required: true },
    selected: { type: Boolean, required: true },
  },
  emits: ["select", "remove"],
  setup(props, { emit }) {
    return () =>
      h(
        "tr",
        { class: props.selected ? "table-danger" : "" },
        [
          h("td", { class: "col-md-1" }, [
            h("span", { class: "badge bg-secondary rounded-pill" }, props.row.id),
          ]),
          h("td", { class: "col-md-4" }, [
            h("div", { class: "d-flex align-items-center gap-2" }, [
              h("span", { class: "icon text-muted", "aria-hidden": "true" }, "\u2733"),
              h("a", { class: "fw-normal text-decoration-none", onClick: () => emit("select") }, props.row.label),
            ]),
          ]),
          h("td", { class: "col-md-1 text-end" }, [
            h("span", { class: "badge bg-info text-dark" }, "Active"),
          ]),
          h("td", { class: "col-md-1" }, [
            h("a", { class: "btn btn-sm btn-outline-danger", "aria-label": "Remove", title: "Remove", onClick: () => emit("remove") }, [
              h("span", { class: "icon", "aria-hidden": "true" }, "\u2715"),
            ]),
          ]),
          h("td", { class: "col-md-1" }, [
            h(CounterComponent, { initialValue: props.row.id }),
          ]),
          h("td", { class: "col-md-5" }, [
            h("div", { class: "d-flex justify-content-end gap-1" }, [
              h("span", { class: "text-muted small" }, "Item"),
              h("span", { class: "text-muted small" }, "#"),
              h("span", { class: "text-muted small" }, props.row.id),
            ]),
          ]),
        ]
      );
  },
});

const RootComponent = defineComponent({
  setup() {
    const rows = shallowRef<Row[]>([]);
    const selectedId = ref(0);

    return { rows, selectedId };
  },
  render() {
    return h(
      "table",
      { class: "table table-hover table-striped test-data" },
      [
        h(
          "tbody",
          this.rows.map((row: Row) =>
            h(TableRow, {
              key: row.id,
              row,
              selected: this.selectedId === row.id,
              onSelect: () => {
                this.selectedId = row.id;
              },
              onRemove: () => {
                const idx = this.rows.findIndex((r: Row) => r.id === row.id);
                if (idx !== -1) this.rows.splice(idx, 1);
              },
            })
          )
        ),
      ]
    );
  },
});

addSetup({
  label: "Vue",
  owl: null,
  async createApp(options?) {
    const { container, cleanup } = createIsolatedContainer(options);
    const app: App = createApp(RootComponent);
    const vm = app.mount(container) as InstanceType<typeof RootComponent>;

    return {
      create(count: number) {
        vm.rows = buildData(count);
        vm.selectedId = 0;
      },
      update(mod: number) {
        vm.rows = vm.rows.map((r, i) =>
          i % mod === 0 ? { ...r, label: r.label + " !!!" } : r
        );
      },
      select(index: number) {
        vm.selectedId = vm.rows[index]!.id;
      },
      swap(a: number, b: number) {
        const rows = vm.rows.slice();
        const tmp = rows[a]!;
        rows[a] = rows[b]!;
        rows[b] = tmp;
        vm.rows = rows;
      },
      remove(index: number) {
        const rows = vm.rows.slice();
        rows.splice(index, 1);
        vm.rows = rows;
      },
      append(count: number) {
        vm.rows = [...vm.rows, ...buildData(count)];
      },
      incrementCounters(mod: number) {
        const btns = container.querySelectorAll<HTMLButtonElement>('.counter-btn');
        for (let i = 0; i < btns.length; i += mod) {
          btns[i]!.click();
        }
      },
      clear() {
        vm.rows = [];
        vm.selectedId = 0;
      },
      async destroy() {
        app.unmount();
        cleanup();
      },
    } satisfies BenchmarkApp;
  },
});
