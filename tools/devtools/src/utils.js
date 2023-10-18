export const IS_FIREFOX = navigator.userAgent.indexOf("Firefox") !== -1;

export const browserInstance = IS_FIREFOX ? browser : chrome;

export async function getOwlStatus() {
  const response = await browserInstance.runtime.sendMessage({ type: "getOwlStatus" });
  return response.result;
}

export async function getActiveTabURL() {
  const window = await browserInstance.windows.getLastFocused({ populate: true });
  const activeTab = window.tabs.find((tab) => tab.active);
  return activeTab.id;
}

// inspired from https://www.tutorialspoint.com/fuzzy-search-algorithm-in-javascript
// Check if the query matches with the base in a fuzzy search way
export function fuzzySearch(baseString, queryString) {
  const base = baseString.toLowerCase();
  const query = queryString.toLowerCase();
  let queryIndex = 0;
  let baseIndex = -1;
  let character;
  // Loop through each character in the query string
  while ((character = query[queryIndex++])) {
    // Find the index of the character in the base string, starting from the previous index plus 1
    baseIndex = base.indexOf(character, baseIndex + 1);
    // If the character is not found, return false
    if (baseIndex === -1) {
      return false;
    }
  }
  // All characters in the query string were found in the base string, so return true
  return true;
}

// Check if the given element is vertically centered in the user view (between 25 and 75% of the height)
export function isElementInCenterViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.bottom >= 0.25 * (window.innerHeight || document.documentElement.clientHeight) &&
    rect.bottom <= 0.75 * (window.innerHeight || document.documentElement.clientHeight)
  );
}

// Formatting for displaying the key of the component
export function minimizeKey(key) {
  if (key.startsWith("__")) {
    const split = key.split("__");
    if (split.length > 2) {
      key = key.substring(4 + split[1].length, key.length);
    } else {
      key = "";
    }
    return key;
  }
  return key;
}
