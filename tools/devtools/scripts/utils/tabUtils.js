export const tabUtils = {
    openLinkInNewTab: (newURL) => {
        // console.log('newURL ', newURL);
        // chrome.tabs.create({url: newURL}, callback);
        return new Promise((resolve, reject) => {
            chrome.tabs.create({url: newURL}, (response) => {
                return resolve(response);
            });
        });
    },

    close: (tabId) => {
        // console.log('tabId ', tabId);
        return new Promise((resolve, reject) => {
            chrome.tabs.remove(tabId, (response) => {
                return resolve(response);
            });
        });
    }
};
