export async function getOwlStatus(){
  let response = isFirefox() ? await browser.runtime.sendMessage({type: "getOwlStatus"}) : await chrome.runtime.sendMessage({type: "getOwlStatus"});
  return response.result;
}

export function isFirefox(){
  if (navigator.userAgent.indexOf("Firefox") !== -1) {
    return true;
  }
}

export async function getActiveTabURL(isFirefox) {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let res = isFirefox ? await browser.tabs.query(queryOptions) : await chrome.tabs.query(queryOptions);
  let [tab] = res;
  return tab;
}

// inspired from https://www.tutorialspoint.com/fuzzy-search-algorithm-in-javascript
export function fuzzySearch(base, query) {
  const str = base.toLowerCase();
  let i = 0, n = -1, l;
  query = query.toLowerCase();
  for (; l = query[i++] ;){
     if (!~(n = str.indexOf(l, n + 1))){
        return false;
     };
  };
  return true;
};

export function isElementInCenterViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.bottom >= 0.25*(window.innerHeight || document.documentElement.clientHeight) &&
    rect.bottom <= 0.75*(window.innerHeight || document.documentElement.clientHeight)
  );
}

export async function evalInWindow(fn, args) {
  const argsString = "(" + args.join(', ') + ");";
  const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.${fn}${argsString}`;
  console.log(script);
  return new Promise(resolve => {
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        console.log(result);
        if (!isException) 
          resolve(result);
        else
          resolve(undefined);
      }
    );
  });
}

/**
 * Escapes a string to use as a RegExp.
 * @url https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
 *
 * @param {string} str
 * @returns {string} escaped string to use as a RegExp
 */
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}