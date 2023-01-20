import globalHook from "./page_scripts/owl_devtools_global_hook";
import { IS_FIREFOX } from "./utils";

// Relays the owlDevtools__... type top window messages to the background script so that it can relay it to the devtools app
window.addEventListener(
  "message",
  function (event) {
    if (event.data.type && event.data.source === "owl-devtools") {
      try {
        chrome.runtime.sendMessage(
          event.data.data
            ? { type: event.data.type, data: event.data.data, origin: event.data.origin }
            : { type: event.data.type, origin: event.data.origin }
        );
      } catch (e) {
        // Extension context invalidated, cannot be handled here since the whole communication system
        // inside the extension is dead in this case.
      }
    }
  },
  false
);

// Load the devtools global hook this way when running on firefox
if (IS_FIREFOX) {
  const script = document.createElement("script");
  script.textContent = globalHook;
  document.documentElement.appendChild(script);
  script.parentNode.removeChild(script);
}
