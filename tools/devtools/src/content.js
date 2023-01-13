window.addEventListener("message", function (event) {
  if(event.data.type){
    if(event.data.type === "owlDevtools__Flush"){
      chrome.runtime.sendMessage({ type: "Flush", paths: event.data.paths })
    }
    else if(event.data.type === "owlDevtools__SelectElement"){
      chrome.runtime.sendMessage({ type: "SelectElement", path: event.data.path })
    }
    else if(event.data.type === "owlDevtools__StopSelector"){
      chrome.runtime.sendMessage({ type: "StopSelector" })
    }
  }
}, false);