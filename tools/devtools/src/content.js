window.addEventListener("message", function (event) {
  if(event.data.type){
    if(event.data.type === "owlDevtools__Flush"){
      chrome.runtime.sendMessage({ type: "Flush", path: event.data.path })
    }
    else if(event.data.type === "owlDevtools__SelectElement"){
      chrome.runtime.sendMessage({ type: "SelectElement", path: event.data.path })
    }
    else if(event.data.type === "owlDevtools__StopSelector"){
      chrome.runtime.sendMessage({ type: "StopSelector" })
    }
    else if(event.data.type === "owlDevtools__RefreshApps"){
      chrome.runtime.sendMessage({ type: "RefreshApps" })
    }
    else if(event.data.type === "owlDevtools__Event"){
      chrome.runtime.sendMessage({ type: "Event", data: event.data.data})
    }
  }
}, false);