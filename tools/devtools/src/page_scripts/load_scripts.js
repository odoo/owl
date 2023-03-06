import { OwlDevtoolsGlobalHook } from "./owl_devtools_global_hook";

if (!window.__OWL_DEVTOOLS__) {
  let val;
  const descriptor = Object.getOwnPropertyDescriptor(window, "__OWL_DEVTOOLS__") || {
    get() {
      return val;
    },
    set(value) {
      val = value;
    },
  };
  Object.defineProperty(window, "__OWL_DEVTOOLS__", {
    get() {
      return descriptor.get.call(this);
    },
    set(value) {
      descriptor.set.call(this, value);
      if (value?.Fiber !== undefined) {
        window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
      }
      window.top.postMessage({ type: "owlDevtools__FrameReady" });
    },
  });
  window.top.postMessage({ type: "owlDevtools__Reload" });
} else if (window.__OWL_DEVTOOLS__?.Fiber !== undefined && !window.__OWL__DEVTOOLS_GLOBAL_HOOK__) {
  window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
  window.top.postMessage({ type: "owlDevtools__Reload" });
}
// Completion value used by eval
__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;
