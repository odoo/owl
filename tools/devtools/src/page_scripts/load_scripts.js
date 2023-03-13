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
      window.top.postMessage({ source: "owl-devtools", type: "FrameReady" });
    },
  });
  // Do note that the reload message is not sent on the top window so that it is not intercepted when originating
  // from an iframe
  window.postMessage({ source: "owl-devtools", type: "Reload" });
} else if (window.__OWL_DEVTOOLS__?.Fiber !== undefined && !window.__OWL__DEVTOOLS_GLOBAL_HOOK__) {
  window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
  window.postMessage({ source: "owl-devtools", type: "Reload" });
}
// Completion value used by eval to assess whether the scripts have been properly loaded
export default __OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;
