const { Component, markup, useState, onMounted, onWillUpdateProps } = owl
import { ComponentsTree } from './components_tree/components_tree';
import { Tab } from "./utils/tab";
import { Events } from './events/events';

export class DevtoolsWindow extends Component {
  setup(){
    this.state = useState({
      page: "ComponentsTree"
    })
  }
  
  // Remove the highlight on the DOM element correponding to the component
  removeHighlight(ev){
    const script = "__OWL__DEVTOOLS_GLOBAL_HOOK__.removeHighlights()"
    chrome.devtools.inspectedWindow.eval(script);
  }

  switchTab(componentName) {
      this.state.page = componentName
  };

  get selectPage() { 
    switch (this.state.page) {
      case 'Events':
        return Events;
      case 'ComponentsTree':
        return ComponentsTree;
      default: 
        return ComponentsTree;
    }
  }
  
  static props = [];

  static template = "devtools.DevtoolsWindow";

  static components = { ComponentsTree, Tab, Events };
}



