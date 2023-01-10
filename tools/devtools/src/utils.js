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