import { getCurrent } from "./core/owl_node";
import { observe } from "./reactivity";

// -----------------------------------------------------------------------------
//  hooks
// -----------------------------------------------------------------------------

export function useState<T>(state: T): T {
  const node = getCurrent()!;
  return observe(state, () => node.render());
}
