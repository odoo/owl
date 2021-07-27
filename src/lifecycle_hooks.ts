import { getCurrent } from "./b_node";

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

export function onWillPatch(fn: () => Promise<void> | any | void) {
  const node = getCurrent()!;
  node.willPatch.push(fn);
}

export function onPatched(fn: () => void | any) {
  const node = getCurrent()!;
  node.patched.push(fn);
}

export function onWillUnmount(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.willUnmount.push(fn);
}

export function onDestroyed(fn: () => Promise<void> | void | any) {
  const node = getCurrent()!;
  node.destroyed.push(fn);
}

export function onRender(fn: () => void | any) {
  const node = getCurrent()!;
  const renderFn = node.renderFn;
  node.renderFn = () => {
    fn();
    return renderFn();
  };
}
