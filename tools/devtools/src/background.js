import { IS_FIREFOX, getActiveTabURL, browserInstance } from "./utils";

let owlStatus = 0;

// Used to keep track of the tabs where the owl devtools have been opened
const activePanels = new Map();

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
    if (IS_FIREFOX) {
      return { result: owlStatus };
    }
    sendResponse({ result: owlStatus });
    return true;
  } else if (message.type === "owlStatus") {
    setOwlStatus(message.data);
    // Refresh panel connection timeout
  } else if (message.type === "keepAlive") {
    const panel = activePanels.get(message.id);
    if (panel) {
      clearTimeout(panel.expirationTimeout);
      panel.expirationTimeout = setTimeout(() => {
        activePanels.delete(message.id);
        panel.port.disconnect();
      }, 750);
    } else {
      const port = browserInstance.runtime.connect({ name: "OwlDevtoolsPort_" + message.id });
      const expirationTimeout = setTimeout(() => {
        activePanels.delete(message.id);
        port.disconnect();
      }, 750);
      activePanels.set(message.id, { port: port, expirationTimeout: expirationTimeout });
    }
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
    // Register a new port for the devtools panel
  } else if (message.type === "newDevtoolsPanel") {
    const id = message.id;
    const port = browserInstance.runtime.connect({ name: "OwlDevtoolsPort_" + id });
    const expirationTimeout = setTimeout(() => {
      activePanels.delete(id);
      port.disconnect();
    }, 750);
    activePanels.set(message.id, { port: port, expirationTimeout: expirationTimeout });
    // This is solely for firefox which doesnt allow access to the chrome.tabs api inside devtools
    // We therefore only use the firefox syntax to send the response here
  } else if (message.type === "getActiveTabURL") {
    const tab = await getActiveTabURL();
    return { result: tab };
  } else {
    const destinationPanel = activePanels.get(sender.tab.id);
    if (destinationPanel) {
      destinationPanel.port.postMessage(
        message.data
          ? { type: message.type, data: message.data, origin: message.origin }
          : { type: message.type, origin: message.origin }
      );
    }
  }
});
