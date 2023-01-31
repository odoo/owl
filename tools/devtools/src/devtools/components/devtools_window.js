const { Component, markup, useState, onMounted, onWillUpdateProps } = owl
import { ComponentsTree } from './components_tree/components_tree';

export class DevtoolsWindow extends Component {
  setup(){}
  
  // Remove the highlight on the DOM element correponding to the component
  removeHighlight(ev){
    const script = "__OWL__DEVTOOLS_GLOBAL_HOOK__.removeHighlights()"
    chrome.devtools.inspectedWindow.eval(script);
  }
  
  static props = [];

  static template = "devtools.DevtoolsWindow";

  static components = { ComponentsTree };
}



