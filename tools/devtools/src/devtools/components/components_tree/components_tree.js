/** @odoo-module **/

const { Component, useState, useEffect, onWillPatch, onMounted} = owl
import { TreeElement } from './tree_element';
import { DetailsWindow } from "./details_window";
import { SearchBar } from './search_bar';
import { fuzzySearch } from '../../../utils';

export class ComponentsTree extends Component {
  setup(){
    this.state = useState({
      splitPosition: 60,
      root: {
        name: "Test",
        path: "App",
        key: "",
        depth: 0,
        display: true,
        toggled: false,
        selected: false,
        children: [],
        highlighted: false
      },
      activeComponent:{
        path: "App",
        name: "App",
        subscriptions: [],
        properties: {},
        env: {},
        expandBag: {
          props: {},
          env: {},
          subscription: {}
        }
      },
      search: {
        search: '',
        searchResults: [],
        searchIndex: 0,
        activeSelector: false
      },
      renderPaths: []
    });
    this.flushRendersTimeout = false;
    onMounted(async () => {
      chrome.runtime.onConnect.addListener((port) => {
        console.assert(port.name === "DevtoolsTreePort");
        port.onMessage.addListener((msg) => {
          if (msg.type === "Flush"){
            this.state.renderPaths =  this.state.renderPaths.concat(msg.paths);
            clearTimeout(this.flushRendersTimeout);
            this.flushRendersTimeout = setTimeout(() => {this.state.renderPaths = []},200);
            let script = 'owlDevtools__SendTree("'+ this.state.activeComponent.path +'");';
            chrome.devtools.inspectedWindow.eval(
              script,
              (result, isException) => {
                if (!isException) {
                  this.state.root = result.root
                }
              }
            );
            const expandBag = JSON.stringify(this.state.activeComponent.expandBag);
            script = 'owlDevtools__SendComponentDetails("'+ this.state.activeComponent.path +'", \''+ expandBag +'\');';
            chrome.devtools.inspectedWindow.eval(
              script,
              (result, isException) => {
                if (!isException) {
                  this.state.activeComponent= result;
                }
              }
            );
          }
          if (msg.type === "SelectElement"){
            this.selectComponent(msg.path);
          }
          if (msg.type === "StopSelector"){
            this.state.search.activeSelector = false;
          }
        });
      });
      let script = 'owlDevtools__SendTree();';
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            this.state.root = result.root
          }
        }
      );
      script = 'owlDevtools__SendComponentDetails();';
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            this.state.activeComponent = result;
          }
        }
      );
    });
  }

  toggleSelector(){
    this.state.search.activeSelector = !this.state.search.activeSelector;
    let script;
    if(this.state.search.activeSelector)
      script = 'owlDevtools__EnableHTMLSelector();';
    else
      script = 'owlDevtools__DisableHTMLSelector();';
    chrome.devtools.inspectedWindow.eval(script);
  }

  updateSearch(search){
    this.state.search.search = search;
    this.state.search.searchResults = [];
    this.getSearchResults(search, this.state.root);
    if(this.state.search.searchResults.length > 0){
      this.state.search.searchIndex = 0;
      this.selectComponent(this.state.search.searchResults[0]);
    }
    else
      this.state.search.searchIndex = -1;
  }

  getSearchResults(search, node){
    if(search.length < 1)
      return;
    if (fuzzySearch(node.name, search)) {
      this.state.search.searchResults.push(node.path)
    }
    if(node.children) {
      node.children.forEach(child => this.getSearchResults(search, child));
    }
  }

  setSearchIndex(index){
    this.state.search.searchIndex = index;
    this.selectComponent(this.state.search.searchResults[index]);
  }
  
  updateTree(component) {
    const pathArray = component.path.split('/');
    let element = this.state.root;
    for (const key of pathArray) {
      element = element.children.filter(child => (child.key) === key)[0];
    }
    element.children = component.children;
    element.toggled = component.toggled;
    element.display = component.display;
  }

  editObjectTreeElement(objectPath, value, objectType){
    const script = 'owlDevtools__EditObject("'+ this.state.activeComponent.path +'", "'+ objectPath +'", '+ value +', "' + objectType + '");';
    chrome.devtools.inspectedWindow.eval(script);
  }

  updateExpandBag(path, type, toggled, display){
    this.state.activeComponent.expandBag[type][path] = {
      toggled: toggled,
      display: display
    }
  }

  updateObjectTreeElements(inputObj) {
    const pathArray = inputObj.path.split('/');
    let obj;
    if (inputObj.objectType === 'props')
      obj = this.state.activeComponent.properties[pathArray[0]];
    else if (inputObj.objectType === 'env')
      obj = this.state.activeComponent.env[pathArray[0]];
    else if (inputObj.objectType === 'subscription')
      obj = this.state.activeComponent.subscriptions[Number(pathArray[0])].target;
    for (let i = 1; i < pathArray.length; i++) {
      const match = pathArray[i];
      if (obj.contentType === "array") 
        obj = obj.children[match];
      else
        obj = obj.children.filter(child => (child.name) === match)[0];
    }
    if (obj.hasChildren && obj.children.length === 0) {
      const expandBag = JSON.stringify(this.state.activeComponent.expandBag);
      const script = 'owlDevtools__LoadObjectChildren("'+ this.state.activeComponent.path +'","'+ obj.path +'", '+ obj.depth +', "'+ obj.contentType +'", "'+ obj.objectType +'", '+ expandBag +');';
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

  refreshComponent() {
    const script = 'owlDevtools__RefreshComponent("'+ this.state.activeComponent.path +'")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  expandSubscriptionsKeys(index){
    this.state.activeComponent.subscriptions[index].keysExpanded = !this.state.activeComponent.subscriptions[index].keysExpanded;
  }

  removeHighlight(ev){
    const script = "owlDevtools__RemoveHighlights()"
    chrome.devtools.inspectedWindow.eval(script);
  }

  selectComponent(path) {
    this.state.root.selected = false;
    this.state.root.highlighted = false;
    this.state.root.children.forEach(child => {
      this.deselectComponent(child)
    });
    const pathArray = path.split('/');
    let element = this.state.root;
    for (let i = 1; i < pathArray.length; i++) {
      element = element.children.filter(child => (child.key) === pathArray[i])[0];
    }
    element.selected = true;
    this.highlightChildren(element);
    const script = 'owlDevtools__SendComponentDetails("' + element.path + '");';
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (!isException) {
          this.state.activeComponent = result;
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
  static template = "devtools.ComponentsTree";
  
  static components = { TreeElement, DetailsWindow, SearchBar };
    
}


