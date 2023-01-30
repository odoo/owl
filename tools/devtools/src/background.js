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

// function loadScripts(tabId) {
//   // fetch('./devtools/page_scripts/load_scripts.js')
//   //   .then((response) => response.text())
//   //   .then((contents) => {
//   //     console.log(contents);
//   //     browser.tabs.executeScript(tabId, { code: contents });
//   //   });
//   console.log("loaded scripts");
//   browser.tabs.executeScript({ 
//     file: './devtools/page_scripts/load_scripts.js',
//     allFrames: true, 
//   });

// }


browserInstance.tabs.onUpdated.addListener((tab) => {
  browserInstance.tabs.get(tab, (tabData) => {
    if (tabData.status === "complete"){
      setTimeout(() => {
        checkOwlStatus(tabData.id);
        // console.log(tabData.id)
        // if(isFirefox){
        //   browser.tabs.executeScript({
        //     code: 'window.__OWL_DEVTOOLS__?.apps !== undefined; console.log(window.__OWL_DEVTOOLS__);',
        //     allFrames: true,
        //   }, (result) => {
        //     console.log(result[0]);
        //     if (result[0]){
        //       loadScripts(tabData.id);
        //     }
        //     setTimeout(() => {
        //       browserInstance.runtime.connect({name: "DevtoolsTreePort"}).postMessage({type: "Reload"});
        //     }, 200);
        //   });
        // }
      }, 200);
    }
  });
});

browserInstance.tabs.onActivated.addListener((activeInfo) => {
  setTimeout(() => {
    checkOwlStatus(activeInfo.tabId);
  }, 200);
});


async function checkOwlStatus(tabId) {
  return new Promise(resolve => {
    if (isChrome) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          func: () => {
            if (window.__OWL_DEVTOOLS__?.apps !== undefined)
              return 2;
            if (typeof owl === "object" && owl.hasOwnProperty('App'))
              return 1;
            return 0;
          },
          world: "MAIN",
        },
        (results) => {
          if (typeof results !== "undefined") {
            owlStatus = results[0].result;
            chrome.action.setIcon({ path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png" });
            resolve(results[0].result);
          }
        }
      );
    } else if (isFirefox) {
      // TODO: Manifest v3 firefox
      // browser.tabs.executeScript({
      //   code: `
      //       if (window.__OWL_DEVTOOLS__?.apps !== undefined)
      //         return 2;
      //       if (typeof owl === "object" && owl.hasOwnProperty(App))
      //         return 1;
      //       return 0;
      //     `,
      //   allFrames: true, 
      // }, (result) => {
      //   console.log(result);
      //   owlStatus = result[0];
      //   browser.browserAction.setIcon({ path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png" });
      //   resolve(result[0]);
      // });
    }
  });
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
      checkOwlStatus(tabId).then((res) => {
        sendResponse({result: res})
      });
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
  if(message.type === "RefreshApps"){
    browserInstance.runtime.connect({name: "DevtoolsTreePort"}).postMessage({type: "RefreshApps"});
  }
});


  
    
