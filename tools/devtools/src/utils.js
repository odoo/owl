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