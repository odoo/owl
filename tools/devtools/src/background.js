import { getActiveTabURL } from "./utils";

let owlStatus = true;
let devtoolsId;
let tree;
let devtoolsTreePort;
let tabId;

chrome.tabs.onUpdated.addListener((tab) => {
  chrome.tabs.get(tab, (tabData) => {
    if (tabData.status === "complete"){
      setTimeout(() => {
        checkOwlStatus(tabData.id);
      }, 1000)
    }
  })
});


function checkOwlStatus(tabId){
  chrome.scripting.executeScript(
    {
      target: {tabId: tabId},
      func: () => {
        return typeof owl !== "undefined";
      },
      world: "MAIN",
    },
    (results) => {
      if (typeof results !== "undefined"){
        owlStatus = results[0].result;
        chrome.action.setIcon({path: owlStatus ? "assets/icon128.png" : "assets/icon_disabled128.png"});
      }
    }
  );
}

function getOwlTree(tabId){
  if(owlStatus){
    chrome.scripting.executeScript(
      {
        target: {tabId: tabId},
        files: ["pageScript.js"],
        world: "MAIN",
      }
    );
  }
}

function getOwlApp(){
  chrome.devtools.inspectedWindow.eval("owl", (results) => {
    console.log(results);
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message")
  if(message.type === "getOwlStatus"){
    getActiveTabURL().then((tab) => {
      if (tab){
        tabId = tab.id;
      }
      checkOwlStatus(tabId);
      console.log("owlStatus message request received: " + owlStatus);
      sendResponse({result: owlStatus});
    })
    return true;
  }
  if(message.type === "loadOwlComponents"){
    getActiveTabURL().then((tab) => {
      if (tab){
        tabId = tab.id;
      }
      getOwlTree(tabId);
      console.log("owlComponents message request received from: ");
      console.log(sender);
      devtoolsId = sender.id;
    })
  }
  if(message.type === "FROM_PAGE"){
    console.log("FROM_PAGE message received from: ");
    console.log(sender);
    tree = JSON.parse(message.data);
    console.log("tree received: ")
    console.log(tree)
    devtoolsTreePort = chrome.runtime.connect({name: "devtoolsTree"});
    devtoolsTreePort.postMessage({data: tree});
    devtoolsTreePort.disconnect();
  }
});


  
    
