import { isFirefox } from "../utils";

let created = false;
let checks = 0;
let browserInstance = isFirefox() ? browser : chrome;
let scriptsLoaded = false;

// Trigger createPanelsIfOwl when the active tab changes to an other tab
browserInstance.devtools.network.onNavigated.addListener(createPanelsIfOwl);

// When the tab gets reloaded or url changes while devtools are oppened, try to reload the scripts
// and send a reload message to the devtools owl app (relayed by the background thread)
if (!isFirefox()) {
  chrome.tabs.onUpdated.addListener((tab) => {
    chrome.tabs.get(tab, (tabData) => {
      if (tabData?.status === "complete") {
        scriptsLoaded = false;
        setTimeout(() => {
          loadScripts().then(() => {
            chrome.runtime.sendMessage({ type: "Reload" });
          });
        }, 100);
      }
    });
  });
}
// Try to load the owl panel each second up to 10 times to make sure we load it if owl is available but delayed
const checkInterval = setInterval(createPanelsIfOwl, 1000);
createPanelsIfOwl();

// Load the scripts on the page in order to define the __OWL__DEVTOOLS_GLOBAL_HOOK__
async function loadScripts() {
  return new Promise((resolve) => {
    if (!scriptsLoaded) {
      fetch("../page_scripts/load_scripts.js")
        .then((response) => response.text())
        .then((contents) => {
          browserInstance.devtools.inspectedWindow.eval(contents, (...args) => {
            scriptsLoaded = args;
            Promise.resolve().then(() => resolve(args));
          });
        });
    } else {
      resolve(true);
    }
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
    (hasOwl) => {
      if (!hasOwl || created) {
        return;
      }
      clearInterval(checkInterval);
      created = true;
      loadScripts().then((result) => {
        if (result) {
          browserInstance.devtools.panels.create(
            "Owl",
            "../../assets/icon128.png",
            isFirefox() ? "devtools_panel.html" : "devtools_app/devtools_panel.html",
            function (panel) {}
          );
        }
      });
    }
  );
}
