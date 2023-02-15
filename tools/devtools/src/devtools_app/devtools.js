import { isFirefox } from "../utils";

let created = false;
let checks = 0;
let browserInstance = isFirefox() ? browser : chrome;
let scriptsLoaded = false;

browserInstance.devtools.network.onNavigated.addListener(createPanelsIfOwl);
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
const checkInterval = setInterval(createPanelsIfOwl, 1000);
createPanelsIfOwl();

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
