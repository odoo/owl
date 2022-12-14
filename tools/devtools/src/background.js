
const init = () => {
    console.log("Init background.js");
};

chrome.tabs.onUpdated.addListener((tabId, tab) => {
    init();
});
    
