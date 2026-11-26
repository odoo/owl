export * from "./shared";

import type { BenchmarkApp, BenchmarkDef, OwlSetup } from "./shared";
import { BENCHMARKS } from "./shared";

// --- Render waiting ---

export function afterRender(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    }, 0);
  });
}

// --- Config & DOM ---

function inputModel(id: keyof typeof config) {
  const input = document.getElementById(id) as HTMLInputElement;
  const isCheckbox = input.getAttribute("type") === "checkbox";
  const searchParamKey = input.getAttribute("name")!;
  if (url.searchParams.has(searchParamKey)) {
    config[id] = Number(url.searchParams.get(searchParamKey)) || 0;
  }
  if (isCheckbox) {
    input.checked = !!config[id];
  } else {
    input.value = String(config[id]);
  }

  input.addEventListener("input", () => {
    const value = Number(isCheckbox ? input.checked : input.value) || 0;
    config[id] = value;
    url.searchParams.set(searchParamKey, String(value));
    history.replaceState({}, "", url.toString());
  });
}

const owlSetups: OwlSetup[] = [];
const buttonsContainer = document.getElementById("render-buttons") as HTMLDivElement;
const checkboxContainer = document.getElementById("framework-checkboxes") as HTMLDivElement;
const snapshotCheckboxContainer = document.getElementById("snapshot-checkboxes") as HTMLDivElement;
const controlsContainer = document.getElementById("controls") as HTMLDivElement;
const url = new URL(window.location.toString());
const config = {
  duration: 5,
};

inputModel("duration");

// --- Benchmark selection dropdown ---
const benchSelect = document.getElementById("bench-select") as HTMLSelectElement;
{
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All benchmarks";
  benchSelect.appendChild(allOpt);
  for (let i = 0; i < BENCHMARKS.length; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = BENCHMARKS[i]!.label;
    benchSelect.appendChild(opt);
  }
  if (url.searchParams.has("bench")) {
    benchSelect.value = url.searchParams.get("bench")!;
  }
  benchSelect.addEventListener("change", () => {
    if (benchSelect.value === "all") {
      url.searchParams.delete("bench");
    } else {
      url.searchParams.set("bench", benchSelect.value);
    }
    history.replaceState({}, "", url.toString());
  });
}

export function getSelectedBenchmarks(): BenchmarkDef[] {
  const val = benchSelect.value;
  if (val === "all") return BENCHMARKS;
  const idx = Number(val);
  return [BENCHMARKS[idx]!];
}

let currentApp: BenchmarkApp | null = null;

const PREVIEW_ACTIONS: { label: string; action: (app: BenchmarkApp) => void }[] = [
  { label: "Create 2,000", action: (app) => app.create(2_000) },
  { label: "Create 10,000", action: (app) => app.create(10_000) },
  { label: "Append 1,000", action: (app) => app.append(1_000) },
  { label: "Update 10th", action: (app) => app.update(10) },
  { label: "Select #1", action: (app) => app.select(1) },
  { label: "Swap 1↔998", action: (app) => app.swap(1, 998) },
  { label: "Remove #4", action: (app) => app.remove(4) },
  { label: "Click 10th counter", action: (app) => app.incrementCounters(10) },
  { label: "Clear", action: (app) => app.clear() },
];

function showControls(app: BenchmarkApp) {
  controlsContainer.innerHTML = "";
  controlsContainer.classList.remove("d-none");
  for (const { label, action } of PREVIEW_ACTIONS) {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-secondary";
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", () => action(app));
    controlsContainer.appendChild(btn);
  }
}

export function hideControls() {
  controlsContainer.classList.add("d-none");
  controlsContainer.innerHTML = "";
}

function getDisabledSet(): Set<string> {
  const param = url.searchParams.get("disabled");
  return param ? new Set(param.split(",")) : new Set();
}

function syncDisabledParam() {
  const disabled = owlSetups.filter((s) => !s.enabled).map((s) => s.label);
  if (disabled.length > 0) {
    url.searchParams.set("disabled", disabled.join(","));
  } else {
    url.searchParams.delete("disabled");
  }
  history.replaceState({}, "", url.toString());
}

let activeButton: HTMLButtonElement | null = null;
const previewCssCheckbox = document.getElementById("preview-css") as HTMLInputElement;
const previewVisibleCheckbox = document.getElementById("preview-visible") as HTMLInputElement;

export function addSetup(setup: OwlSetup) {
  const disabledSet = getDisabledSet();
  setup.enabled = !disabledSet.has(setup.label);
  owlSetups.push(setup);

  // --- Checkbox ---
  const wrapper = document.createElement("div");
  wrapper.className = "form-check d-flex align-items-center";
  const checkbox = document.createElement("input");
  checkbox.className = "form-check-input";
  checkbox.type = "checkbox";
  checkbox.checked = setup.enabled;
  checkbox.id = `fw-${owlSetups.length}`;
  const cbLabel = document.createElement("label");
  cbLabel.className = "form-check-label small";
  cbLabel.htmlFor = checkbox.id;
  cbLabel.textContent = setup.label;
  wrapper.appendChild(checkbox);
  wrapper.appendChild(cbLabel);

  // --- Trash button for snapshots ---
  if (setup.snapshotId) {
    const trash = document.createElement("button");
    trash.className = "btn btn-sm btn-link text-danger p-0 ms-auto";
    trash.type = "button";
    trash.title = "Delete snapshot";
    trash.innerHTML = "&#128465;"; // 🗑
    trash.style.fontSize = "0.75rem";
    trash.style.lineHeight = "1";
    trash.addEventListener("click", async () => {
      if (!confirm(`Delete snapshot "${setup.label}"?`)) return;
      const res = await fetch(`/__api__/snapshots/${setup.snapshotId}`, { method: "DELETE" });
      if (!res.ok) return;
      const idx = owlSetups.indexOf(setup);
      if (idx !== -1) owlSetups.splice(idx, 1);
      wrapper.remove();
      button.remove();
      syncDisabledParam();
    });
    wrapper.appendChild(trash);
  }

  (setup.snapshotId ? snapshotCheckboxContainer : checkboxContainer).appendChild(wrapper);

  checkbox.addEventListener("change", () => {
    setup.enabled = checkbox.checked;
    syncDisabledParam();
  });

  // --- Preview button ---
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-outline-primary d-block w-100";
  button.type = "button";
  button.textContent = setup.label;
  button.addEventListener("click", async () => {
    if (currentApp) {
      await currentApp.destroy();
      currentApp = null;
    }
    if (activeButton) {
      activeButton.classList.replace("btn-primary", "btn-outline-primary");
    }
    button.classList.replace("btn-outline-primary", "btn-primary");
    activeButton = button;
    const app = await setup.createApp({ css: previewCssCheckbox.checked, visible: previewVisibleCheckbox.checked });
    app.create(100);
    currentApp = app;
    showControls(app);
  });
  buttonsContainer.appendChild(button);
}

export function getConfig() {
  return config;
}

export function getSetups() {
  return owlSetups.filter((s) => s.enabled);
}

// --- Snapshots ---

async function loadSnapshots() {
  try {
    const res = await fetch("/__api__/snapshots");
    const snapshots: { id: string; name: string }[] = await res.json();
    for (const snap of snapshots) {
      await import(/* @vite-ignore */ `/snapshots/${snap.id}/setup.js`);
    }
  } catch {
    // snapshots dir may not exist yet — that's fine
  }
}

export const snapshotsReady = loadSnapshots();

document.getElementById("snapshot-btn")!.addEventListener("click", async () => {
  const name = prompt("Snapshot name:");
  if (!name) return;
  const res = await fetch("/__api__/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    alert("Snapshot failed: " + (await res.text()));
    return;
  }
  const meta: { id: string } = await res.json();
  await import(/* @vite-ignore */ `/snapshots/${meta.id}/setup.js`);
});

// --- Mode switching ---
const modeBenchmarkBtn = document.getElementById("mode-benchmark") as HTMLButtonElement;
const modePreviewBtn = document.getElementById("mode-preview") as HTMLButtonElement;
const sidebarBenchmark = document.getElementById("sidebar-benchmark") as HTMLDivElement;
const sidebarPreview = document.getElementById("sidebar-preview") as HTMLDivElement;

modeBenchmarkBtn.addEventListener("click", async () => {
  sidebarBenchmark.classList.remove("d-none");
  sidebarPreview.classList.add("d-none");
  modeBenchmarkBtn.className = "btn btn-sm btn-warning";
  modePreviewBtn.className = "btn btn-sm btn-outline-warning";
  hideControls();
  if (currentApp) {
    await currentApp.destroy();
    currentApp = null;
  }
  if (activeButton) {
    activeButton.classList.replace("btn-primary", "btn-outline-primary");
    activeButton = null;
  }
  fixture.innerHTML = "";
});

modePreviewBtn.addEventListener("click", () => {
  sidebarBenchmark.classList.add("d-none");
  sidebarPreview.classList.remove("d-none");
  modePreviewBtn.className = "btn btn-sm btn-warning";
  modeBenchmarkBtn.className = "btn btn-sm btn-outline-warning";
  hideControls();
  if (!currentApp) {
    fixture.innerHTML = "";
  }
});

export function hashHas(value: string) {
  return url.hash.includes(value);
}

export function setHash(value: string) {
  url.hash = value;
  history.replaceState({}, "", url.toString());
}

export const fixture = document.getElementById("fixture") as HTMLDivElement;

/**
 * Creates a same-origin iframe inside `fixture` and returns a mount target
 * element inside it. Call `cleanup()` to remove the iframe entirely, which
 * lets the browser discard the whole document and its DOM tree at once.
 */
export function createIsolatedContainer({ css = true, visible = true }: { css?: boolean; visible?: boolean } = {}): {
  container: HTMLElement;
  cleanup: () => void;
} {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = visible ? "width:100%;height:100%;border:none;display:block;" : "display:none;";
  fixture.appendChild(iframe);
  const doc = iframe.contentDocument!;
  // Copy bootstrap stylesheet into the iframe for consistent rendering
  if (css) {
    for (const link of document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]'
    )) {
      const clone = doc.createElement("link");
      clone.rel = "stylesheet";
      clone.href = link.href;
      doc.head.appendChild(clone);
    }
  }
  const container = doc.createElement("div");
  doc.body.appendChild(container);
  return {
    container,
    cleanup() {
      iframe.remove();
    },
  };
}
