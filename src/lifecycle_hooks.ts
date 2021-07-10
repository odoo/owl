import { getCurrent } from "./core/owl_node";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function onWillStart(fn: () => Promise<void> | void) {
  const node = getCurrent()!;
  node.willStart.push(fn);
}
