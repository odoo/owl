const { Component, markup, useState, onMounted, onWillUpdateProps } = owl
import { ComponentsTree } from './components_tree/components_tree';
import { Tab } from "./utils/tab";
import { Events } from './events/events';

export class DevtoolsWindow extends Component {
  setup(){
    this.state = useState({
      page: "ComponentsTree",
      selectedPath: [],
      activeRecorder: false,
      events: [],
      owlStatus: true,
    })
    onMounted(() => {
      // Connect to the port to communicate to the background script
      chrome.runtime.onConnect.addListener((port) => {
        port.onMessage.addListener((msg) => {
          // When message of type Event is received, add the received event to the list
          if (msg.type === "Event"){
            if(this.state.activeRecorder)
              this.state.events = [...this.state.events, msg.data];
          }
        });
      });
    });
  }

  updateOwlStatus(status){
    this.state.owlStatus = status;
  }

  toggleRecorder(){
    this.state.activeRecorder = !this.state.activeRecorder;
  }

  clearEvents(){
    this.state.events = [];
  }
  
  // Remove the highlight on the DOM element correponding to the component
  removeHighlight(ev){
    const script = "__OWL__DEVTOOLS_GLOBAL_HOOK__.removeHighlights()";
    chrome.devtools.inspectedWindow.eval(script);
  }

  switchTab(componentName) {
    this.state.page = componentName;
  };

  selectComponent(path){
    this.state.selectedPath = path;
  }
  
  static props = [];

  static template = "devtools.DevtoolsWindow";

  static components = { ComponentsTree, Tab, Events };
}



