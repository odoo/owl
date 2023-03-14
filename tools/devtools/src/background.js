import { IS_FIREFOX } from "./utils";

let owlStatus = 0;

let browserInstance = IS_FIREFOX ? browser : chrome;

// Load the devtools global hook this way when running on manifest v3 chrome
if (!IS_FIREFOX) {
  chrome.scripting.registerContentScripts([
    {
      id: "owlDevtoolsGLobalHook",
      matches: ["<all_urls>"],
      js: ["page_scripts/owl_devtools_global_hook.js"],
      world: chrome.scripting.ExecutionWorld.MAIN,
    },
  ]);
}

// Update the owlStatus variable and the extension icon accordingly
function setOwlStatus(status) {
  owlStatus = status;
  if(IS_FIREFOX){
    browser.browserAction.setIcon({path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png"});
  }else{
    browserInstance.action.setIcon({
      path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png"
    });
  }
}

async function getActiveTabURL(IS_FIREFOX) {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let res = IS_FIREFOX
    ? await browser.tabs.query(queryOptions)
    : await chrome.tabs.query(queryOptions);
  let [tab] = res;
  return tab;
}

// Check owl status on tab update
browserInstance.tabs.onUpdated.addListener((tab) => {
  browserInstance.tabs.get(tab, (tabData) => {
    if (tabData.status === "complete") {
      setOwlStatus(0);
      checkOwlStatus(tabData.id);
    }
  });
});

// Check owl status on tab activation
browserInstance.tabs.onActivated.addListener((activeInfo) => {
  setOwlStatus(0);
  checkOwlStatus(activeInfo.tabId)
});

// send a message to the window which will be intercepted by the page script and will result in a response of type owlStatus
function checkOwlStatus(tabId){
  browserInstance.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      window.postMessage({
        source: "owl-devtools-background",
        type: "checkOwlStatus",
      });
    },
  });
}

// Messages handler for the background script
browserInstance.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Send back the owl status to the sender
  if (message.type === "getOwlStatus") {
    sendResponse({ result: owlStatus });
    return true;
  } else if (message.type === "owlStatus") {
    setOwlStatus(message.data);
    // Dummy message to test if the extension context is still valid
  } else if (message.type === "keepAlive") {
    return;
    // Relay the received message to the devtools app
  } else {
    const port = browserInstance.runtime.connect({ name: "OwlDevtoolsPort" });
    port.postMessage(
      message.data
        ? { type: message.type, data: message.data, devtoolsId: message.devtoolsId }
        : { type: message.type, devtoolsId: message.devtoolsId }
    );
  }
});
