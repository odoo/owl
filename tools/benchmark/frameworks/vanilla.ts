import { addSetup, buildData, createIsolatedContainer, type BenchmarkApp, type Row } from "../src/utils";

// --- Row DOM template (cloned for each row) ---
// Text node placeholders (spaces) are overwritten via .nodeValue after cloning.

const TEMPLATE = document.createElement("tr");
TEMPLATE.innerHTML =
  "<td class='col-md-1'><span class='badge bg-secondary rounded-pill'> </span></td>" +
  "<td class='col-md-4'><div class='d-flex align-items-center gap-2'>" +
    "<span class='icon text-muted' aria-hidden='true'>&#9733;</span>" +
    "<a class='lbl fw-normal text-decoration-none'> </a></div></td>" +
  "<td class='col-md-1 text-end'><span class='badge bg-info text-dark'>Active</span></td>" +
  "<td class='col-md-1'><a class='remove btn btn-sm btn-outline-danger' aria-label='Remove' title='Remove'>" +
    "<span class='icon' aria-hidden='true'>&#10005;</span></a></td>" +
  "<td class='col-md-1'><span> </span> " +
    "<button class='counter-btn btn btn-sm btn-outline-secondary'>+</button></td>" +
  "<td class='col-md-5'><div class='d-flex justify-content-end gap-1'>" +
    "<span class='text-muted small'>Item</span>" +
    "<span class='text-muted small'>#</span>" +
    "<span class='text-muted small'> </span></div></td>";

// Cache navigated offsets from the template so createRow is pure firstChild/nextSibling.
// Structure: tr > td*6, each td has known children.

function createRow(data: Row): HTMLTableRowElement {
  const tr = TEMPLATE.cloneNode(true) as HTMLTableRowElement;
  const td1 = tr.firstChild!;                        // td.col-md-1 (id)
  const td2 = td1.nextSibling!;                      // td.col-md-4 (label)
  const td4 = td2.nextSibling!.nextSibling!;         // td.col-md-1 (remove)
  const td5 = td4.nextSibling!;                      // td.col-md-1 (counter)
  const td6 = td5.nextSibling!;                      // td.col-md-5 (item #)

  // id badge: td1 > span > textNode
  td1.firstChild!.firstChild!.nodeValue = String(data.id);
  // label: td2 > div > span, a.lbl > textNode
  td2.firstChild!.firstChild!.nextSibling!.firstChild!.nodeValue = data.label;
  // counter value: td5 > span > textNode
  td5.firstChild!.firstChild!.nodeValue = String(data.id);
  // item # id: td6 > div > span, span, span > textNode
  td6.firstChild!.firstChild!.nextSibling!.nextSibling!.firstChild!.nodeValue = String(data.id);

  (tr as any)._dataId = data.id;
  return tr;
}

addSetup({
  label: "Vanilla JS",
  owl: null,
  async createApp(options?) {
    const { container, cleanup } = createIsolatedContainer(options);

    const table = document.createElement("table");
    table.className = "table table-hover table-striped test-data";
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    container.appendChild(table);

    // Parallel arrays — rows[i] is the <tr>, data[i] is the Row, counters[i] is the counter value.
    let rows: HTMLTableRowElement[] = [];
    let data: Row[] = [];
    let counters: number[] = [];
    let selectedRow: HTMLTableRowElement | null = null;

    // --- Event delegation: single listener on tbody ---
    tbody.addEventListener("click", (e) => {
      let node = e.target as HTMLElement | null;
      // Walk up to find a <tr> with _dataId and identify action
      let action: "select" | "remove" | "counter" | null = null;
      while (node && node !== tbody) {
        if (node.classList.contains("lbl")) { action = "select"; }
        else if (node.classList.contains("remove")) { action = "remove"; }
        else if (node.classList.contains("counter-btn")) { action = "counter"; }

        if ((node as any)._dataId !== undefined && action) {
          const id = (node as any)._dataId as number;
          const idx = findIdx(id);
          if (idx === -1) break;
          if (action === "select") {
            doSelect(idx);
          } else if (action === "remove") {
            doRemove(idx);
          } else {
            counters[idx]!++;
            // counter span: tr > td(skip 4) > span > textNode
            const td5 = node.firstChild!.nextSibling!.nextSibling!.nextSibling!.nextSibling!;
            td5.firstChild!.firstChild!.nodeValue = String(counters[idx]);
          }
          break;
        }
        node = node.parentElement;
      }
    });

    function findIdx(id: number): number {
      for (let i = 0, len = data.length; i < len; i++) {
        if (data[i]!.id === id) return i;
      }
      return -1;
    }

    function doSelect(idx: number) {
      if (selectedRow) selectedRow.className = "";
      selectedRow = rows[idx]!;
      selectedRow.className = "table-danger";
    }

    function doRemove(idx: number) {
      const tr = rows[idx]!;
      tr.remove();
      rows.splice(idx, 1);
      data.splice(idx, 1);
      counters.splice(idx, 1);
      if (selectedRow === tr) selectedRow = null;
    }

    function appendData(newData: Row[]) {
      const len = newData.length;
      const startIdx = rows.length;
      const empty = !tbody.firstChild;
      if (empty) tbody.remove();  // detach tbody for faster insert
      for (let i = 0; i < len; i++) {
        const row = newData[i]!;
        const tr = createRow(row);
        rows[startIdx + i] = tr;
        data[startIdx + i] = row;
        counters[startIdx + i] = row.id;
        tbody.appendChild(tr);
      }
      if (empty) table.insertBefore(tbody, null);  // re-attach
    }

    function clearAll() {
      tbody.textContent = "";
      rows = [];
      data = [];
      counters = [];
      selectedRow = null;
    }

    return {
      create(count: number) {
        clearAll();
        appendData(buildData(count));
      },
      update(mod: number) {
        for (let i = 0, len = rows.length; i < len; i += mod) {
          data[i]!.label += " !!!";
          // label textNode: tr > td1 > td2 > div > span, a > textNode
          const td2 = rows[i]!.firstChild!.nextSibling!;
          td2.firstChild!.firstChild!.nextSibling!.firstChild!.nodeValue = data[i]!.label;
        }
      },
      select(index: number) {
        doSelect(index);
      },
      swap(a: number, b: number) {
        const trA = rows[a]!;
        const trB = rows[b]!;

        // swap data arrays
        let tmp: any = rows[a]; rows[a] = rows[b]!; rows[b] = tmp;
        tmp = data[a]; data[a] = data[b]!; data[b] = tmp;
        tmp = counters[a]; counters[a] = counters[b]!; counters[b] = tmp;

        // swap DOM nodes
        const refA = trA.nextSibling;
        const refB = trB.nextSibling;
        tbody.insertBefore(trB, refA);
        tbody.insertBefore(trA, refB);
      },
      remove(index: number) {
        doRemove(index);
      },
      append(count: number) {
        appendData(buildData(count));
      },
      incrementCounters(mod: number) {
        const btns = container.querySelectorAll<HTMLButtonElement>(".counter-btn");
        for (let i = 0; i < btns.length; i += mod) {
          btns[i]!.click();
        }
      },
      clear() {
        clearAll();
      },
      async destroy() {
        cleanup();
      },
    } satisfies BenchmarkApp;
  },
});
