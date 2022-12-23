// window.addEventListener("message", function (event) {
//     console.log(event);
//     if(event.data.type && (event.data.type === "FROM_PAGE")){
//         chrome.runtime.sendMessage({ type: "FROM_PAGE", data: event.data.tree })
//     }
// }, false);