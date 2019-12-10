export const contentUtils = {
    getContentOfTab: (tabId) => {
        return new Promise((resolve, reject) => {
            // console.log('Inside getContentOfCurrentDocument ', tabId);

            const removeListeners = () => {
                chrome.tabs.onUpdated.removeListener(onUpdated);
                chrome.tabs.onRemoved.removeListener(onRemoved);
            };

            const onRemoved = () => {
                removeListeners();

                /**
                 * This is not required. This can be removed later if it's work correctly.
                 */

                // callback(''); // Tab closed, no response.
            };

            const onUpdated = (updatedTabId, details) => {
                // console.log('Inside onUpdated details.status ', details.status);
                if (details.status === 'complete') {
                    removeListeners();
                    chrome.runtime.onMessage.addListener((request) => {
                        // console.log('Inside onMessage ');
                        if (request.action === 'getSource') {
                            // console.log('request.source ', request.source);
                            // message.innerText = request.source;
                            return resolve(request.source);
                        }
                    });

                    chrome.tabs.executeScript(tabId, {
                        file: 'scripts/utils/getPagesSource.js'
                    }, () => {
                        // console.log('Inside executeScript ');
                        // If you try and inject into an extensions page or the webstore/NTP you'll get an error
                        if (chrome.runtime.lastError) {
                            console.log('chrome.runtime.lastError ', chrome.runtime.lastError);
                            return reject(chrome.runtime.lastError);
                        }
                    });
                }
            };
            // console.log('Start adding listeners');
            chrome.tabs.onUpdated.addListener(onUpdated);
            chrome.tabs.onRemoved.addListener(onRemoved);
            // console.log('Completed adding listeners');
        });
    }
};
