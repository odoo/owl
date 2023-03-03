let owlStatus = 0;
let tabId;
let isChrome = false;
let isFirefox = false;

if (navigator.userAgent.indexOf("Chrome") !== -1) {
  isChrome = true;
} else if (navigator.userAgent.indexOf("Firefox") !== -1) {
  isFirefox = true;
}

let browserInstance = isFirefox ? browser : chrome;

// Check if owl is available and up to date on the given tab and adapt the extension icon accordingly
async function checkOwlStatus(tabId) {
  return new Promise((resolve) => {
    if (isChrome) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          func: () => {
            if (window.__OWL_DEVTOOLS__?.Fiber !== undefined) {
              return 2;
            }
            if (typeof owl === "object" && owl.hasOwnProperty("App")) {
              return 1;
            }
            return 0;
          },
          world: "MAIN",
        },
        (results) => {
          if (typeof results !== "undefined") {
            owlStatus = results[0].result;
            chrome.action.setIcon({
              path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png",
            });
            resolve(results[0].result);
          }
        }
      );
    } else if (isFirefox) {
      // TODO: Manifest v3 firefox
    }
  });
}

async function getActiveTabURL(isFirefox) {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let res = isFirefox
    ? await browser.tabs.query(queryOptions)
    : await chrome.tabs.query(queryOptions);
  let [tab] = res;
  return tab;
}

// Check owl status on tab update by implanting a message sender on the __OWL_DEVTOOLS__ hook
// if it is not already present on the page
browserInstance.tabs.onUpdated.addListener((tab) => {
  browserInstance.tabs.get(tab, (tabData) => {
    if (tabData.status === "complete") {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabData.id },
          func: () => {
            if (!window.__OWL_DEVTOOLS__) {
              let val;
              const descriptor = Object.getOwnPropertyDescriptor(window, "__OWL_DEVTOOLS__") || {
                get() {
                  return val;
                },
                set(value) {
                  val = value;
                },
              };
              Object.defineProperty(window, "__OWL_DEVTOOLS__", {
                get() {
                  return descriptor.get.call(this);
                },
                set(value) {
                  descriptor.set.call(this, value);
                  let result = 1;
                  if (value?.Fiber !== undefined) {
                    result = 2;
                  }
                  window.top.postMessage({ type: "owlDevtools__owlStatus", data: result });
                },
                configurable: true,
              });
              return 0;
            } else {
              let result = 1;
              if (window.__OWL_DEVTOOLS__.Fiber !== undefined) {
                result = 2;
              }
              return result;
            }
          },
          world: "MAIN",
        },
        (results) => {
          if (typeof results !== "undefined") {
            owlStatus = results[0].result;
            chrome.action.setIcon({
              path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png",
            });
          }
        }
      );
    }
  });
});

// ...and activation
browserInstance.tabs.onActivated.addListener((activeInfo) => {
  checkOwlStatus(activeInfo.tabId);
});

// Messages handler for the background script
browserInstance.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Send back the owl status to the sender
  if (message.type === "getOwlStatus") {
    getActiveTabURL(isFirefox).then(async (tab) => {
      if (tab) {
        tabId = tab.id;
        const result = await checkOwlStatus(tabId);
        sendResponse({ result: result });
      } else {
        sendResponse({ result: 0 });
      }
    });
    return true;
    // Relay the received message to the devtools app
  } else if (message.type === "owlStatus") {
    owlStatus = message.data;
    chrome.action.setIcon({
      path: owlStatus === 2 ? "assets/icon128.png" : "assets/icon_disabled128.png",
    });
  } else {
    browserInstance.runtime
      .connect({ name: "OwlDevtoolsPort" })
      .postMessage(
        message.data ? { type: message.type, data: message.data } : { type: message.type }
      );
  }
});
