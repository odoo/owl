import { getCurrent } from "./core/owl_node";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: () => Promise<void> | void) {
  const node = getCurrent()!;
  node.willStart.push(fn);
}

export function onMounted(fn: () => void) {
  const node = getCurrent()!;
  node.mounted.push(fn);
}

export function onBeforeUnmount(fn: () => Promise<void> | void) {
  const node = getCurrent()!;
  node.beforeUnmount.push(fn);
}
