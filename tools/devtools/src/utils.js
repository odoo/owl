export async function getOwlStatus(){
  let response = await chrome.runtime.sendMessage({type: "getOwlStatus"});
  console.log("response: " + response);
  return response.result;
}

export async function getActiveTabURL() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let res = await chrome.tabs.query(queryOptions);
  let [tab] = res;
  return tab;
}

// found from https://www.tutorialspoint.com/fuzzy-search-algorithm-in-javascript
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
    rect.left >= 0 &&
    rect.bottom >= 0.25*(window.innerHeight || document.documentElement.clientHeight) &&
    rect.bottom <= 0.75*(window.innerHeight || document.documentElement.clientHeight) &&
    rect.right >= 0.25*(window.innerWidth || document.documentElement.clientWidth) &&
    rect.right <= 0.75*(window.innerWidth || document.documentElement.clientWidth)
  );
}