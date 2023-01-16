import {OwlDevtoolsGlobalHook} from "./owl_devtools_global_hook"
// Ensure the scripts are loaded only once per page
if(!window.__OWL__DEVTOOLS_GLOBAL_HOOK__){
  // Load the global hook for the devtools
  window.__OWL__DEVTOOLS_GLOBAL_HOOK__ = new OwlDevtoolsGlobalHook();
  // Edit the flush method inside owl to provide information on which component is being re-rendered
  const owlDevtools__originalFlush = [...owl.App.apps][0].scheduler.flush;
  [...owl.App.apps][0].scheduler.flush = function() {
    let pathArray = [];
    [...this.tasks].map((fiber) => {
      if (fiber.counter === 0 && !__OWL__DEVTOOLS_GLOBAL_HOOK__.fibersMap.has(fiber)){
        __OWL__DEVTOOLS_GLOBAL_HOOK__.fibersMap.set(fiber, "");
        const path = __OWL__DEVTOOLS_GLOBAL_HOOK__.getComponentPath(fiber.node);
        pathArray.push(path);
      }
    });
    owlDevtools__originalFlush.call(this, ...arguments);
    /*
     * Add a functionnality to the flush function which sends a message to the window every time it is triggered.                          
     * This message is intercepted by the content script which informs the background script to ask the devtools app tree to be refreshed. 
     * This process may be long but is necessary. More information in the docs:                                                            
     * https://developer.chrome.com/docs/extensions/mv3/devtools/#evaluated-scripts-to-devtools                                            
     */
    window.postMessage({type: "owlDevtools__Flush", paths: pathArray});
  };
}
