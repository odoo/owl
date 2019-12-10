window.console = chrome.extension.getBackgroundPage().console;

const init = () => {
    console.log('Init popup.js');
};

window.onload = init;
