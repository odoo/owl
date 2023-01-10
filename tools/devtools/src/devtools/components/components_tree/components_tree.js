/** @odoo-module **/

const { Component, useState, onWillStart, onWillPatch, onMounted} = owl
import TreeElement from './tree_element';
import { DetailsWindow } from "./details_window";
import { SearchBar } from './search_bar';
import { fuzzySearch } from '../../../utils';

export class ComponentsTree extends Component {
  setup(){
    this.state = useState({
      splitPosition: 60
    });
    this.root = useState({
      name: "Test",
      path: "App",
      key: "",
      depth: 0,
      display: true,
      toggled: false,
      selected: false,
      children: [],
      highlighted: false
    });

    this.search = useState({
      search: '',
      searchResults: [],
      searchIndex: 0
    })

    this.activeComponent = useState({
      path: "App",
      name: "App",
      subscriptions: [],
      properties: {},
      expandBag: {}
    });

    onMounted(async () => {
      chrome.runtime.onConnect.addListener((port) => {
        console.assert(port.name === "DevtoolsTreePort");
        port.onMessage.addListener((msg) => {
          if (msg.type === "Flush"){
            let script = 'owlDevtools__SendTree("'+ this.activeComponent.path +'");';
            chrome.devtools.inspectedWindow.eval(
              script,
              (result, isException) => {
                if (!isException) {
                  Object.keys(this.root).forEach(key => {
                    this.root[key] = result.root[key]
                  });
                }
              }
            );
            let expandBag = JSON.stringify(this.activeComponent.expandBag);
            script = 'owlDevtools__SendComponentDetails("'+ this.activeComponent.path +'", \''+ expandBag +'\');';
            chrome.devtools.inspectedWindow.eval(
              script,
              (result, isException) => {
                if (!isException) {
                  Object.keys(this.activeComponent).forEach(key => {
                    this.activeComponent[key] = result[key];
                  });
                }
              }
            );
          }
        });
      });
      let script = 'owlDevtools__SendTree();';
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            Object.keys(this.root).forEach(key => {
              this.root[key] = result.root[key]
            });
          }
        }
      );
      script = 'owlDevtools__SendComponentDetails();';
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            Object.keys(this.activeComponent).forEach(key => {
              this.activeComponent[key] = result[key];
            });
          }
        }
      );
    });
  }

  updateSearch(search){
    this.search.search = search;
    this.search.searchResults = [];
    this.getSearchResults(search, this.root);
    if(this.search.searchResults.length > 0){
      this.search.searchIndex = 0;
      this.selectComponent(this.search.searchResults[0]);
    }
    else
      this.search.searchIndex = -1;
  }

  getSearchResults(search, node){
    if(search.length < 1)
      return;
    if (fuzzySearch(node.name, search)) {
      this.search.searchResults.push(node.path)
    }
    if(node.children) {
      node.children.forEach(child => this.getSearchResults(search, child));
    }
  }

  setSearchIndex(index){
    this.search.searchIndex = index;
    this.selectComponent(this.search.searchResults[index]);
  }
  
  updateTree(component) {
    let path_array = component.path.split('/');
    let element = this.root;
    for (let i = 1; i < path_array.length; i++) {
      element = element.children.filter(child => (child.key) === path_array[i])[0];
    }
    element.children = component.children;
    element.toggled = component.toggled;
    element.display = component.display;
  }

  editReactiveState(subscription_path, value){
    let script = 'owlDevtools__EditReactiveState("'+ this.activeComponent.path +'", "'+ subscription_path +'", '+ value +');';
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {}
    );
  }

  updateExpandBag(path, toggled, display){
    this.activeComponent.expandBag[path] = {
      toggled: toggled,
      display: display
    }
  }

  updateObjectTreeElements(inputObj) {
    let path_array = inputObj.path.split('/');
    let obj;
    if (inputObj.objectType === 'props')
      obj = this.activeComponent.properties[path_array[0]];
    else if (inputObj.objectType === 'subscription')
      obj = this.activeComponent.subscriptions[Number(path_array[0])].target;
    for (let i = 1; i < path_array.length; i++) {
      let match = path_array[i];
      if (obj.contentType === "array") 
        obj = obj.children[match];
      else
        obj = obj.children.filter(child => (child.name) === match)[0];
    }
    if (obj.hasChildren && obj.children.length === 0) {
      let expandBag = JSON.stringify(this.activeComponent.expandBag);
      let script = 'owlDevtools__LoadObjectChildren("'+ this.activeComponent.path +'","'+ obj.path +'", '+ obj.depth +', "'+ obj.contentType +'", "'+ obj.objectType +'", '+ expandBag +');';
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            obj.children = result;
          }
        }
      );
    }
    obj.toggled = inputObj.toggled;
    obj.display = inputObj.display;
  }

  expandSubscriptionsKeys(index){
    this.activeComponent.subscriptions[index].keysExpanded = !this.activeComponent.subscriptions[index].keysExpanded;
  }

  removeHighlight(ev){
    let script = "owlDevtools__RemoveHighlights()"
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {}
    );
  }

  selectComponent(path) {
    this.root.selected = false;
    this.root.highlighted = false;
    this.root.children.forEach(child => {
      this.deselectComponent(child)
    });
    let path_array = path.split('/');
    let element = this.root;
    for (let i = 1; i < path_array.length; i++) {
      element = element.children.filter(child => (child.key) === path_array[i])[0];
    }
    element.selected = true;
    this.highlightChildren(element);
    let script = 'owlDevtools__SendComponentDetails("' + element.path + '");';
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (!isException) {
          Object.keys(this.activeComponent).forEach(key => {
            this.activeComponent[key] = result[key];
          });
        }
      }
    );
  }

  highlightChildren(component){
    component.children.forEach((child) => {
      child.highlighted = true;
      this.highlightChildren(child);
    })
  }

  deselectComponent(component){
    component.selected = false;
    component.highlighted = false;
    component.children.forEach(child => {
      this.deselectComponent(child)
    });
  }

  handleMouseDown = (event) => {
    // Add event listeners for mouse move and mouse up events
    // to allow the user to drag the split screen border
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  }
  
  handleMouseMove = (event) => {
    this.state.splitPosition = Math.max(Math.min(event.clientX / window.innerWidth * 100, 85), 15);
  }
  
  handleMouseUp = (event) => {
  // Remove the event listeners when the user releases the mouse button
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }

  static template = "devtools.components_tree";
  
  static components = { TreeElement, DetailsWindow, SearchBar };
    
}


