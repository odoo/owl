import { isFirefox } from "../utils";

let created = false;
let checks = 0;
let browserInstance = isFirefox() ? browser : chrome;
let scriptsLoaded = false;

browserInstance.devtools.network.onNavigated.addListener(createPanelsIfOwl);
if(!isFirefox()){
  chrome.tabs.onUpdated.addListener((tab) => {
    chrome.tabs.get(tab, (tabData) => {
      if (tabData.status === "complete"){
        scriptsLoaded = false;
        setTimeout(() => {
          chrome.devtools.inspectedWindow.eval(
          'window.__OWL_DEVTOOLS__?.apps !== undefined;',
          (hasOwl) => {
            if (hasOwl){
              loadScripts();
            }
            chrome.runtime.sendMessage({ type: "Reload" })
        });
        }, 200);
      }
    });
  });
}
const checkInterval = setInterval(createPanelsIfOwl, 1000);
createPanelsIfOwl();

function loadScripts() {
  if(!scriptsLoaded){
    fetch('./page_scripts/load_scripts.js')
      .then((response) => response.text())
      .then((contents) => {
        browserInstance.devtools.inspectedWindow.eval(contents);
        scriptsLoaded = true;
      });
  }
}

function createPanelsIfOwl() {
  if(created || checks++ > 10){
    clearInterval(checkInterval);
    return;
  }
  browserInstance.devtools.inspectedWindow.eval(
    'window.__OWL_DEVTOOLS__?.apps !== undefined;',
    (hasOwl) => {
      if(!hasOwl || created){
        return;
      }
      clearInterval(checkInterval);
      created = true;
      loadScripts();
      browserInstance.devtools.panels.create("Owl", "../../assets/icon128.png", isFirefox() ? "components_panel.html" : "devtools/components_panel.html", function (panel) {});
      // chrome.devtools.panels.create("Owl Events", "../../assets/icon128.png", isFirefox() ? "events_panel.html" : "devtools/events_panel.html", function (panel) {});
    }
  )
}