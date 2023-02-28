export async function getOwlStatus() {
  const response = isFirefox()
    ? await browser.runtime.sendMessage({ type: "getOwlStatus" })
    : await chrome.runtime.sendMessage({ type: "getOwlStatus" });
  return response.result;
}

export function isFirefox() {
  if (navigator.userAgent.indexOf("Firefox") !== -1) {
    return true;
  }
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

// General method for executing functions from the loaded scripts in the right frame of the page
// using the __OWL__DEVTOOLS_GLOBAL_HOOK__. Take the function's args as an array.
export async function evalInWindow(fn, args, frameUrl = "top") {
  const stringifiedArgs = [...args].map((arg) => {
    arg = JSON.stringify(arg);
    return arg;
  });
  const argsString = "(" + stringifiedArgs.join(", ") + ");";
  const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.${fn}${argsString}`;
  return new Promise((resolve) => {
    if (frameUrl !== "top") {
      chrome.devtools.inspectedWindow.eval(
        script,
        { frameURL: frameUrl },
        (result, isException) => {
          if (!isException) {
            resolve(result);
          } else {
            resolve(undefined);
          }
        }
      );
    } else {
      chrome.devtools.inspectedWindow.eval(script, (result, isException) => {
        if (!isException) {
          resolve(result);
        } else {
          resolve(undefined);
        }
      });
    }
  });
}
