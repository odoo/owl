import { getActiveTabURL } from "./utils";

let owlStatus = 2;
let tabId;
let isChrome = false;
let isFirefox = false;

let browserInstance = isFirefox ? browser : chrome;

if (navigator.userAgent.indexOf("Chrome") !== -1) {
  isChrome = true;
} else if (navigator.userAgent.indexOf("Firefox") !== -1) {
  isFirefox = true;
}

browserInstance.tabs.onUpdated.addListener((tab) => {
  browserInstance.tabs.get(tab, (tabData) => {
    if (tabData.status === "complete"){
      setTimeout(() => {
        checkOwlStatus(tabData.id);
      }, 200);
    }
  });
});


function checkOwlStatus(tabId){
  if(isChrome){
    chrome.scripting.executeScript(
      {
        target: {tabId: tabId},
        func: () => {
          if (window.__OWL_DEVTOOLS__?.apps !== undefined)
            return 2;
          if (typeof owl !== "undefined")
            return 1;
          return 0;
        },
        world: "MAIN",
      },
      (results) => {
        if (typeof results !== "undefined"){
          owlStatus = results[0].result;
          chrome.action.setIcon({path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png"});
        }
      }
    );
  }
  else if(isFirefox){
    browser.tabs.executeScript(tabId, {
      code: `
        if (window.__OWL_DEVTOOLS__?.apps !== undefined)
          return 2;
        if (typeof owl !== "undefined")
          return 1;
        return 0;
      `
    }, (result) => {
      owlStatus = result[0];
      browser.browserAction.setIcon({path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png"});
    });
  }
}

browserInstance.runtime.onConnect.addListener(function(port) {
  console.assert(port.name == "DevtoolsTreePort");
});

browserInstance.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(message.type === "getOwlStatus"){
    getActiveTabURL(isFirefox).then((tab) => {
      if (tab){
        tabId = tab.id;
      }
      checkOwlStatus(tabId)
      sendResponse({result: owlStatus});
    });
    return true;
  }
  if(message.type === "Flush"){
    browserInstance.runtime.connect({name: "DevtoolsTreePort"}).postMessage({type: "Flush", paths: message.paths});
  }
  if(message.type === "SelectElement"){
    browserInstance.runtime.connect({name: "DevtoolsTreePort"}).postMessage({type: "SelectElement", path: message.path});
  }
  if(message.type === "StopSelector"){
    browserInstance.runtime.connect({name: "DevtoolsTreePort"}).postMessage({type: "StopSelector"});
  }
  if(message.type === "Reload"){
    browserInstance.runtime.connect({name: "DevtoolsTreePort"}).postMessage({type: "Reload"});
  }
});


  
    
