
let created = false;
let checks = 0;

chrome.devtools.network.onNavigated.addListener(createPanelsIfOwl);
const checkInterval = setInterval(createPanelsIfOwl, 1000);
createPanelsIfOwl();

function createPanelsIfOwl() {
  if(created || checks++ > 10){
    clearInterval(checkInterval);
    return;
  }
  chrome.devtools.inspectedWindow.eval(
    'typeof owl !== "undefined";',
    (hasOwl) => {
      if(!hasOwl ||created){
        return;
      }
      clearInterval(checkInterval);
      created = true;
      chrome.devtools.panels.create("Owl Components", "../../assets/icon128.png", "devtools/components_panel.html", function (panel) {});
      chrome.devtools.panels.create("Owl Events", "../../assets/icon128.png", "devtools/events_panel.html", function (panel) {});
    }
  )
}