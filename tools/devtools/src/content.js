window.addEventListener("message", function (event) {
  if(event.data.type && (event.data.type === "Flush")){
    chrome.runtime.sendMessage({ type: "Flush" })
  }
}, false);