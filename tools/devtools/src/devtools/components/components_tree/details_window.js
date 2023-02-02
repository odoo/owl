
const {Component, onRendered, onWillStart} = owl
import { ObjectTreeElement } from './object_tree_element'
import { Subscriptions } from './subscriptions';

export class DetailsWindow extends Component {

  static props = ['activeComponent', 'toggleObjectTreeElementsDisplay', 'expandSubscriptionsKeys', 'editObjectTreeElement', 'width', 'loadGetterContent'];
  
  static template = "devtools.DetailsWindow";

  static components = { ObjectTreeElement, Subscriptions };

  setup(){
  }

  refreshComponent(){
    this.props.refreshComponent();
  }

  logComponentInConsole(type){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.sendObjectToConsole(${JSON.stringify(this.props.activeComponent.path)}, '${type}');`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectComponentInDOM(){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponentDOM(${JSON.stringify(this.props.activeComponent.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectComponentSource(){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponentSource(${JSON.stringify(this.props.activeComponent.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectCompiledTemplate(){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponentCompiledTemplate(${JSON.stringify(this.props.activeComponent.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectRAwTemplate(){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponentRawTemplate(${JSON.stringify(this.props.activeComponent.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }
}


