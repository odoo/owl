import { isFirefox } from "../utils";

let created = false;
let checks = 0;
let browserInstance = isFirefox() ? browser : chrome;
let scriptsLoaded = false;

// When the tab gets reloaded or url changes while devtools are oppened, try to reload the scripts
// and send a reload message to the devtools owl app (relayed by the background thread)
if (!isFirefox()) {
  chrome.tabs.onUpdated.addListener((tab) => {
    chrome.tabs.get(tab, (tabData) => {
      if (tabData?.status === "complete") {
        scriptsLoaded = false;
        // Again we need to wait until owl has got the time to load on the page before loading the scripts
        setTimeout(() => {
          loadScripts().then(() => {
            if (created) {
              chrome.runtime.sendMessage({ type: "Reload" });
            }
          });
        }, 200);
      }
    });
  });
}
// Try to load the owl panel each 300 ms up to 3 times to make sure we load it if owl is available but delayed
const checkInterval = setInterval(createPanelsIfOwl, 300);

// Load the scripts on the page in order to define the __OWL__DEVTOOLS_GLOBAL_HOOK__
async function loadScripts() {
  if (scriptsLoaded) return true;
  return new Promise((resolve) => {
    fetch("../page_scripts/load_scripts.js")
      .then((response) => response.text())
      .then((contents) => {
        browserInstance.devtools.inspectedWindow.eval(contents, (result, isException) => {
          if (!isException) {
            scriptsLoaded = result;
            resolve(result);
          } else {
            resolve(false);
          }
        });
      });
  });
}

// Load the scripts and create the owl devtools panel if owl on the page is available at a sufficient version
function createPanelsIfOwl() {
  if (created || checks++ > 3) {
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
            isFirefox() ? "devtools_panel.html" : "devtools_app/devtools_panel.html"
          );
        }
      });
    }
  );
}
