import { IS_FIREFOX, getActiveTabURL } from "./utils";

let owlStatus = 0;

const browserInstance = IS_FIREFOX ? browser : chrome;

// Used to keep track of the tabs where the owl devtools have been opened
const activePanels = new Set();

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
  if (IS_FIREFOX) {
    browser.browserAction.setIcon({
      path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png",
    });
  } else {
    browserInstance.action.setIcon({
      path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png",
    });
  }
}

// Delete from the set when the tab is closed
browserInstance.tabs.onRemoved.addListener((tabId) => {
  activePanels.delete(tabId);
});

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
  checkOwlStatus(activeInfo.tabId);
});

// send a message to the window which will be intercepted by the page script and will result in a response of type owlStatus
function checkOwlStatus(tabId) {
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
browserInstance.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  // Send back the owl status to the sender
  if (message.type === "getOwlStatus") {
    sendResponse({ result: owlStatus });
    return true;
  } else if (message.type === "owlStatus") {
    setOwlStatus(message.data);
    // Dummy message to test if the extension context is still valid
  } else if (message.type === "keepAlive") {
    return;
    // Open the devtools documentation in a new tab
  } else if (message.type === "openDoc") {
    browserInstance.tabs.create(
      { url: "https://github.com/odoo/owl/blob/master/doc/tools/devtools_guide.md", active: false },
      function (tab) {
        browserInstance.tabs.update(tab.id, { active: true });
      }
    );
    return;
    // Relay the received message to the devtools app
  } else if (message.type === "newDevtoolsPanel") {
    const tab = await getActiveTabURL();
    activePanels.add(tab);
    // This is solely for firefox which doesnt allow access to the chrome.tabs api inside devtools
  } else if (message.type === "getActiveTabURL") {
    getActiveTabURL().then((tab) => {
      sendResponse({ result: tab });
    });
    return true;
  } else {
    const tab = await getActiveTabURL();
    if (!activePanels.has(tab)) {
      return;
    }
    const port = browserInstance.runtime.connect({ name: "OwlDevtoolsPort" });
    port.postMessage(
      message.data
        ? { type: message.type, data: message.data, origin: message.origin }
        : { type: message.type, origin: message.origin }
    );
  }
});
