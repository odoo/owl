import { isFirefox } from "../utils";

let created = false;
let checks = 0;
let browserInstance = isFirefox() ? browser : chrome;

// Try to load the owl panel each 500 ms up to 10 times to make sure we load it if owl is available but delayed
const checkInterval = setInterval(createPanelsIfOwl, 500);

// Create the owl devtools panel if owl on the page is available at a sufficient version
function createPanelsIfOwl() {
  if (created || checks++ > 10) {
    clearInterval(checkInterval);
    return;
  }
  browserInstance.devtools.inspectedWindow.eval(
    "window.__OWL_DEVTOOLS__?.Fiber !== undefined;",
    async (hasOwl) => {
      if (!hasOwl || created) {
        return;
      }
      clearInterval(checkInterval);
      created = true;
      browserInstance.devtools.panels.create(
        "Owl",
        "../../assets/icon128.png",
        isFirefox() ? "devtools_panel.html" : "devtools_app/devtools_panel.html"
      );
    }
  );
}
