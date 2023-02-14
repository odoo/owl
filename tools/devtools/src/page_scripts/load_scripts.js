import { OwlDevtoolsGlobalHook } from "./owl_devtools_global_hook";
// Ensure the scripts are loaded only once per page
if (!window.__OWL__DEVTOOLS_GLOBAL_HOOK__) {
  // Load the global hook for the devtools
  try {
    window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
    __OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined;
  } catch (e) {
    false;
  }
} else {
  true;
}
