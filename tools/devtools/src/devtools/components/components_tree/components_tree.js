/** @odoo-module **/

const { Component, useState, useEffect, onWillUnmount, onMounted} = owl
import { TreeElement } from './tree_element';
import { DetailsWindow } from "./details_window";
import { SearchBar } from './search_bar';
import { fuzzySearch } from '../../../utils';

export class ComponentsTree extends Component {
  setup(){
    this.state = useState({
      splitPosition: 60,
      leftWidth: 0,
      rightWidth: 0,
      hasOwl: true,
      root: {
        name: "Test",
        path: ["App"],
        key: "",
        depth: 0,
        toggled: false,
        selected: false,
        children: [],
        highlighted: false
      },
      activeComponent:{
        path: ["App"],
        name: "App",
        subscriptions: [],
        props: {},
        env: {},
        instance: {}
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
      // Connect to the port to communicate to the background script
      chrome.runtime.onConnect.addListener((port) => {
        console.assert(port.name === "DevtoolsTreePort");
        port.onMessage.addListener((msg) => {
          // When message of type Flush is received, overwrite the component tree with the new one from page
          // A flush message is sent everytime a component is rendered on the page
          if (msg.type === "Flush"){
            this.state.renderPaths =  this.state.renderPaths.concat(msg.paths);
            clearTimeout(this.flushRendersTimeout);
            this.flushRendersTimeout = setTimeout(() => {this.state.renderPaths = []},200);
            const oldComponentsTree = JSON.stringify(this.state.root);
            let script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.getComponentsTree(${JSON.stringify(this.state.activeComponent.path)}, ${oldComponentsTree});`;
            chrome.devtools.inspectedWindow.eval(
              script,
              (result, isException) => {
                if (!isException) {
                  this.state.root = result.root
                }
              }
            );
            const oldObjectsTree = JSON.stringify(this.state.activeComponent);
            script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.getComponentDetails(${JSON.stringify(this.state.activeComponent.path)}, ${oldObjectsTree});`;
            chrome.devtools.inspectedWindow.eval(
              script,
              (result, isException) => {
                if (!isException) {
                  this.state.activeComponent = result;
                }
              }
            );
          }
          // Select the component based on the path received with the SelectElement message
          if (msg.type === "SelectElement"){
            this.selectComponent(msg.path);
          }
          // Stop the DOM element selector tool upon receiving the StopSelector message
          if (msg.type === "StopSelector"){
            this.state.search.activeSelector = false;
          }

          if (msg.type === "Reload"){
            chrome.devtools.inspectedWindow.eval(
              'window.__OWL__DEVTOOLS_GLOBAL_HOOK__ !== undefined',
              (result) => {
                this.state.hasOwl = result;
                if (result){
                  this.loadBaseComponentsTree();
                }
              }
            )
          }
        });
      });
      // On mount, retreive the component tree from the page and the details of the inspected component
      this.loadBaseComponentsTree();
      this.computeWindowWidth();
      window.addEventListener("resize", this.computeWindowWidth);
      document.addEventListener('click', this.hideContextMenus, true);
      document.addEventListener('contextmenu', this.hideContextMenus, true);
    });
    onWillUnmount(() => {
      window.removeEventListener("resize", this.computeWindowWidth);
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("mouseup", this.handleMouseUp);
      document.removeEventListener('click', this.hideContextMenus);
      document.removeEventListener('contextmenu', this.hideContextMenus);
    });
  }

  loadBaseComponentsTree(){
    let script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.getComponentsTree();';
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (!isException) {
          this.state.root = result.root;
          this.expandComponents(this.state.root);
        }
      }
    );
    script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.getComponentDetails();';
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (!isException) {
          this.state.activeComponent = result;
        }
      }
    );
  }
  // Expand the component given in entry and all of its children
  expandComponents(component) {
    component.toggled = true;
    component.children.forEach(child => {
      this.expandComponents(child)
    });
  }
  // Fold the component given in entry and all of its children
  foldComponents(component) {
    component.toggled = false;
    component.children.forEach(child => {
      this.foldComponents(child)
    });
  }
  // Search the component given its path and expand/fold itself and its children based on toggle 
  toggleComponentAndChildren(path, toggle){
    let cp = [...path];
    cp.shift();
    let component = this.state.root;
    for (const key of cp) {
      component = component.children.filter(child => (child.key) === key)[0];
    }
    toggle ? this.expandComponents(component) : this.foldComponents(component);
  }

  toggleComponentParents(path){
    let cp = [...path];
    cp.shift();
    let component = this.state.root;
    for (const key of cp) {
      component.toggled = true;
      component = component.children.filter(child => (child.key) === key)[0];
    }
  }

  hideContextMenus = (event) => {
    const customMenus = document.querySelectorAll(".custom-menu");
    customMenus.forEach(menu => menu.classList.add("hidden"));
  }

  // Toggle the selector tool which is used to select a component based on the hovered Dom element
  toggleSelector(){
    this.state.search.activeSelector = !this.state.search.activeSelector;
    let script;
    if(this.state.search.activeSelector)
      script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.enableHTMLSelector();';
    else
      script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.disableHTMLSelector();';
    chrome.devtools.inspectedWindow.eval(script);
  }

  // Update the search state value with the current search string and trigger the search
  updateSearch(search){
    this.state.search.search = search;
    this.state.search.searchResults = [];
    this.getSearchResults(search, this.state.root);
    if(this.state.search.searchResults.length > 0){
      this.state.search.searchIndex = 0;
      this.selectComponent(this.state.search.searchResults[0]);
      this.foldComponents(this.state.root);
      for(const result of this.state.search.searchResults){
        this.toggleComponentParents(result);
      }
    }
    else
      this.state.search.searchIndex = -1;
  }

  // Search for results in the components tree given the current search string (in a fuzzy way)
  getSearchResults(search, node){
    if(search.length < 1)
      return;
    if (fuzzySearch(node.name, search)) {
      this.state.search.searchResults.push(node.path);
    }
    if(node.children) {
      node.children.forEach(child => this.getSearchResults(search, child));
    }
  }

  // Set the search index to the provided one in order to select the current searched component
  setSearchIndex(index){
    this.state.search.searchIndex = index;
    this.selectComponent(this.state.search.searchResults[index]);
  }
  
  // Toggle expansion of the component tree element given by the path
  toggleComponentTreeElementDisplay(path) {
    let cp = [...path];
    cp.shift();
    let component = this.state.root;
    for (const key of cp) {
      component = component.children.filter(child => (child.key) === key)[0];
    }
    component.toggled = !component.toggled;
  }

  findObjectInTree(inputObj){
    let path = [...inputObj.path];
    let obj;
    if(inputObj.objectType !== 'instance')
      path.shift();
    if (typeof path[0] === 'object'){
      if(path[0].type === 'prototype'){
        path[0] = "[[Prototype]]";
      }
      else
        path[0] = path[0].key;
    }
    if (inputObj.objectType === 'props')
      obj = this.state.activeComponent.props[path[0]];
    else if (inputObj.objectType === 'env')
      obj = this.state.activeComponent.env[path[0]];
    else if (inputObj.objectType === 'instance')
      obj = this.state.activeComponent.instance[path[0]];
    else if (inputObj.objectType === 'subscription')
      obj = this.state.activeComponent.subscriptions[path[0]].target;
    for (let i = 1; i < path.length; i++) {
      const match = path[i];
      if(typeof match === 'object'){
        switch(match.type){
          case 'map entries':
          case 'set entries': 
            obj = obj.children.filter(child => (child.name) === '[[Entries]]')[0];
            break;
          case 'map entry':
          case 'set entry':
            obj = obj.children[match.index];
            break;
          case 'map key':
          case 'set value': 
            obj = obj.children[0];
            break;
          case 'map value':
            obj = obj.children[1];
            break;
          case 'prototype':
            obj = obj.children.filter(child => (child.name) === "[[Prototype]]")[0];
            break;
          case 'symbol':
            obj = obj.children.filter(child => (child.name) === match.key)[0];
        }
      }
      else if (obj.contentType === "array") 
        obj = obj.children[match];
      else
        obj = obj.children.filter(child => (child.name) === match)[0];
    }
    return obj;
  }

  loadGetterContent(inputObj){
    let obj = this.findObjectInTree(inputObj);
    const getter = JSON.stringify(obj);
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.loadGetterContent(${JSON.stringify(this.state.activeComponent.path)}, ${getter});`;
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (!isException) {
          Object.keys(obj).forEach(key => {
            obj[key] = result[key];
          });
          obj.children = [];
        }
      }
    );
  }
  
  // Expand the children of the input object property and load it from page if necessary
  toggleObjectTreeElementsDisplay(inputObj) {
    if(!inputObj.hasChildren)
      return;
    let obj = this.findObjectInTree(inputObj);
    if (obj.hasChildren && obj.children.length === 0) {
      const oldObjectsTree = JSON.stringify(this.state.activeComponent);
      const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.loadObjectChildren(${JSON.stringify(this.state.activeComponent.path)}, ${JSON.stringify(obj.path)}, ${obj.depth}, '${obj.contentType}', '${obj.objectType}', ${oldObjectsTree});`;
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            obj.children = result;
          }
        }
      );
    }
    obj.toggled = !obj.toggled;
  }

  // Update the value of the given object with the new provided one
  editObjectTreeElement(objectPath, value, objectType){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.editObject(${JSON.stringify(this.state.activeComponent.path)}, ${JSON.stringify(objectPath)}, ${value}, '${objectType}');`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  // Triggers manually the rendering of the selected component
  refreshComponent() {
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.refreshComponent(${JSON.stringify(this.state.activeComponent.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  // Toggle opening or closing the subscription keys at provided index
  expandSubscriptionsKeys(index){
    this.state.activeComponent.subscriptions[index].keysExpanded = !this.state.activeComponent.subscriptions[index].keysExpanded;
  }

  // Remove the highlight on the DOM element correponding to the component
  removeHighlight(ev){
    const script = "__OWL__DEVTOOLS_GLOBAL_HOOK__.removeHighlights()"
    chrome.devtools.inspectedWindow.eval(script);
  }

  // Select a component by retrieving its details from the page based on its path
  selectComponent(path) {
    // Deselect all components starting from root
    this.state.root.selected = false;
    this.state.root.highlighted = false;
    this.state.root.children.forEach(child => {
      this.deselectComponent(child)
    });
    let element = this.state.root;
    for (let i = 1; i < path.length; i++) {
      element.toggled = true;
      element = element.children.filter(child => (child.key) === path[i])[0];
    }
    element.selected = true;
    this.highlightChildren(element);
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.getComponentDetails(${JSON.stringify(element.path)});`;
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {
        if (!isException) {
          this.state.activeComponent = result;
        }
      }
    );
  }

  // Apply highlight recursively to all children of a selected component
  highlightChildren(component){
    component.children.forEach((child) => {
      child.highlighted = true;
      this.highlightChildren(child);
    })
  }

  // Deselect component and remove highlight on all children
  deselectComponent(component){
    component.selected = false;
    component.highlighted = false;
    component.children.forEach(child => {
      this.deselectComponent(child)
    });
  }

  // Compute the width of the left and right windows based on the split position
  computeWindowWidth = (event) => {
    const width = window.innerWidth || document.body.clientWidth;
    this.state.leftWidth = (this.state.splitPosition/100) * width - 2;
    this.state.rightWidth = (1 - this.state.splitPosition/100) * width;
  }

  handleMouseDown = (event) => {
    // Add event listeners for mouse move and mouse up events
    // to allow the user to drag the split screen border
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  }
  
  handleMouseMove = (event) => {
    this.state.splitPosition = Math.max(Math.min(event.clientX / window.innerWidth * 100, 85), 15);
    this.computeWindowWidth();
  }
  
  handleMouseUp = (event) => {
  // Remove the event listeners when the user releases the mouse button
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }

  static template = "devtools.ComponentsTree";
  
  static components = { TreeElement, DetailsWindow, SearchBar };
}


