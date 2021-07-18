import { getCurrent } from "./owl_node";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willStart.push(fn);
}

export function onWillUpdateProps(fn: (nextProps: any) => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willUpdateProps.push(fn);
}

export function onMounted(fn: () => void | any) {
  const node = getCurrent()!;
  node.mounted.push(fn);
}

export function onBeforePatch(fn: () => Promise<void> | any | void) {
  const node = getCurrent()!;
  node.beforePatch.push(fn);
}

export function onPatched(fn: () => void | any) {
  const node = getCurrent()!;
  node.patched.push(fn);
}

export function onBeforeUnmount(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.beforeUnmount.push(fn);
}

export function onDestroyed(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.destroyed.push(fn);
}
