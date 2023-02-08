window.addEventListener("message", function (event) {
  if(event.data.type){
    const type = event.data.type.replace("owlDevtools__", "");
    chrome.runtime.sendMessage(event.data.data ? { type: type, data: event.data.data } : { type: type })
  }
}, false);