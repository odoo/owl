import { isFirefox } from "../utils";

let created = false;
let checks = 0;
let browserInstance = isFirefox() ? browser : chrome;
let scriptsLoaded = false;

// When the tab gets reloaded or url changes while devtools are oppened, try to reload the scripts
// and send a reload message to the devtools owl app (relayed by the background thread)
if (!isFirefox()) {
  chrome.tabs.onUpdated.addListener((tab) => {
    chrome.tabs.get(tab, async (tabData) => {
      if (tabData?.status === "complete") {
        scriptsLoaded = false;
        if (created) {
          await loadScripts();
        }
      }
    });
  });
}
// Try to load the owl panel each 500 ms up to 10 times to make sure we load it if owl is available but delayed
const checkInterval = setInterval(createPanelsIfOwl, 500);

// Load the scripts on the page in order to define the __OWL__DEVTOOLS_GLOBAL_HOOK__
async function loadScripts() {
  if (scriptsLoaded) {
    return true;
  }
  return new Promise(async (resolve) => {
    const response = await fetch("../page_scripts/load_scripts.js");
    const contents = await response.text();
    browserInstance.devtools.inspectedWindow.eval(contents, (result) => {
      scriptsLoaded = result;
      resolve(result);
    });
  });
}

// Load the scripts and create the owl devtools panel if owl on the page is available at a sufficient version
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
      await loadScripts();
      browserInstance.devtools.panels.create(
        "Owl",
        "../../assets/icon128.png",
        isFirefox() ? "devtools_panel.html" : "devtools_app/devtools_panel.html"
      );
    }
  );
}
