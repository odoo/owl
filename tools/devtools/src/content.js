// Relays the owlDevtools__... type top window messages to the background script so that it can relay it to the devtools app
window.addEventListener(
  "message",
  function (event) {
    if (event.data.type) {
      const type = event.data.type.replace("owlDevtools__", "");
      try{
        chrome.runtime.sendMessage(
          event.data.data ? { type: type, data: event.data.data, devtoolsId: event.data.devtoolsId } : { type: type, devtoolsId: event.data.devtoolsId }
        );
      } catch(e) {
        // Extension context invalidated, cannot be handled here since the whole communication system 
        // inside the extension is dead in this case.
      }
    }
  },
  false
);
