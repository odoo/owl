import { IS_FIREFOX } from "../utils";

let created = false;
let browserInstance = IS_FIREFOX ? browser : chrome;

// Try to load the owl panel each 1000 ms in case it (re)appears on the page later on
const checkInterval = setInterval(createPanelsIfOwl, 1000);

createPanelsIfOwl();

// Create the owl devtools panel if owl on the page is available at a sufficient version
function createPanelsIfOwl() {
  if (created) {
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
        IS_FIREFOX ? "devtools_panel.html" : "devtools_app/devtools_panel.html"
      );
    }
  );
}
