// Relays the owlDevtools__... type top window messages to the background script so that it can relay it to the devtools app
window.addEventListener(
  "message",
  function (event) {
    if (event.data.type && event.data.source === "owl-devtools") {
      try {
        chrome.runtime.sendMessage(
          event.data.data
            ? { type: event.data.type, data: event.data.data, devtoolsId: event.data.devtoolsId }
            : { type: event.data.type, devtoolsId: event.data.devtoolsId }
        );
      } catch (e) {
        // Extension context invalidated, cannot be handled here since the whole communication system
        // inside the extension is dead in this case.
      }
    }
  },
  false
);
