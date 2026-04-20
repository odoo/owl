import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const SNAPSHOTS_DIR = path.resolve(import.meta.dirname, "snapshots");
const OWL_ENTRY = path.resolve(import.meta.dirname, "../../packages/owl/src/index.ts");

function generateSetupJs(id: string, name: string): string {
  return `import * as owl from "./owl.js";
const { Component, signal, xml, props, mount } = owl;
import { addSetup, buildData, createIsolatedContainer } from "../../src/utils";

function toSignalRows(rows) {
  return rows.map((r) => ({ id: r.id, label: signal(r.label) }));
}

class Counter extends Component {
  static template = xml\`
    <span t-out="this.value()"/> <button class="counter-btn btn btn-sm btn-outline-secondary" t-on-click="this.increment">+</button>
  \`;
  props = props();
  value = signal(this.props.initialValue);

  increment() {
    this.value.set(this.value() + 1);
  }
}

class TableRow extends Component {
  static components = { Counter };
  static template = xml\`
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
  \`;
  props = props();
}

class Root extends Component {
  static components = { TableRow };
  static template = xml\`
    <table class="table table-hover table-striped test-data">
      <tbody>
        <t t-foreach="this.rows()" t-as="row" t-key="row.id">
          <TableRow
            row="row"
            selected="row.id === this.selectedId()"
            onSelect="() => this.doSelect(row.id)"
            onRemove="() => this.doRemove(row.id)"
          />
        </t>
      </tbody>
    </table>
  \`;

  rows = signal.Array([]);
  selectedId = signal(0);

  doSelect(id) {
    this.selectedId.set(id);
  }

  doRemove(id) {
    const rows = this.rows();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx !== -1) rows.splice(idx, 1);
  }
}

addSetup({
  label: ${JSON.stringify(name)},
  snapshotId: ${JSON.stringify(id)},
  owl,
  async createApp(options) {
    const { container, cleanup } = createIsolatedContainer(options);
    const comp = await mount(Root, container, {});
    return {
      create(count) {
        comp.rows.set(toSignalRows(buildData(count)));
      },
      update(mod) {
        const rows = comp.rows();
        for (let i = 0; i < rows.length; i += mod) {
          rows[i].label.set(rows[i].label() + " !!!");
        }
      },
      select(index) {
        comp.selectedId.set(comp.rows()[index].id);
      },
      swap(a, b) {
        const rows = comp.rows();
        const tmp = rows[a];
        rows[a] = rows[b];
        rows[b] = tmp;
      },
      remove(index) {
        comp.rows().splice(index, 1);
      },
      append(count) {
        comp.rows().push(...toSignalRows(buildData(count)));
      },
      incrementCounters(mod) {
        const btns = container.querySelectorAll('.counter-btn');
        for (let i = 0; i < btns.length; i += mod) {
          btns[i].click();
        }
      },
      clear() {
        comp.rows.set([]);
      },
      async destroy() {
        comp.__owl__.app.destroy();
        cleanup();
      },
    };
  },
});
`;
}

export default function snapshotsPlugin(): Plugin {
  return {
    name: "snapshots",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__api__/snapshots")) return next();

        // DELETE /__api__/snapshots/<id>
        if (req.method === "DELETE" && req.url.startsWith("/__api__/snapshots/")) {
          const id = req.url.slice("/__api__/snapshots/".length);
          const snapshotDir = path.join(SNAPSHOTS_DIR, id);
          if (!fs.existsSync(snapshotDir)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "not found" }));
            return;
          }
          fs.rmSync(snapshotDir, { recursive: true });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (req.method === "GET") {
          if (!fs.existsSync(SNAPSHOTS_DIR)) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify([]));
            return;
          }
          const entries = fs.readdirSync(SNAPSHOTS_DIR, { withFileTypes: true });
          const snapshots = [];
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const metaPath = path.join(SNAPSHOTS_DIR, entry.name, "meta.json");
            if (!fs.existsSync(metaPath)) continue;
            snapshots.push(JSON.parse(fs.readFileSync(metaPath, "utf-8")));
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(snapshots));
          return;
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: Buffer) => (body += chunk.toString()));
          req.on("end", async () => {
            try {
              const { name } = JSON.parse(body);
              if (!name) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "name is required" }));
                return;
              }

              const now = new Date();
              const id =
                now.getFullYear().toString() +
                String(now.getMonth() + 1).padStart(2, "0") +
                String(now.getDate()).padStart(2, "0") +
                "-" +
                String(now.getHours()).padStart(2, "0") +
                String(now.getMinutes()).padStart(2, "0") +
                String(now.getSeconds()).padStart(2, "0");

              const snapshotDir = path.join(SNAPSHOTS_DIR, id);
              fs.mkdirSync(snapshotDir, { recursive: true });

              // Build OWL with esbuild
              await build({
                entryPoints: [OWL_ENTRY],
                bundle: true,
                format: "esm",
                outfile: path.join(snapshotDir, "owl.js"),
                sourcemap: false,
              });

              // Write setup.js
              fs.writeFileSync(
                path.join(snapshotDir, "setup.js"),
                generateSetupJs(id, name)
              );

              // Write meta.json
              const meta = { id, name, date: now.toISOString() };
              fs.writeFileSync(
                path.join(snapshotDir, "meta.json"),
                JSON.stringify(meta, null, 2)
              );

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(meta));
            } catch (err: any) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
