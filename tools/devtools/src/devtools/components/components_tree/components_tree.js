/** @odoo-module **/

import { Component, useState, onWillStart, onWillPatch, onMounted} from "@odoo/owl";
import TreeElement from './tree_element'
import { loadOwlComponents } from "../../../utils.js";

export class ComponentsTree extends Component {
  setup(){
    this.state = useState({
      splitPosition: 60
    })
    this.root = useState({
      name: "Test",
      properties: { id: "app" },
      path: "App",
      key: "",
      depth: 0,
      display: true,
      toggled: false,
      selected: false,
      children: [],
      highlighted: false
    });

    this.activeComponent = useState(this.root);

    onMounted(async () => {
      // chrome.runtime.onConnect.addListener((port) => {
      //     if(port.name === "devtoolsTree"){
      //         let treeListener = (message, sender, sendResponse) => {
      //             Object.keys(this.root).forEach(key => {
      //                 this.root[key] = message.data.root[key]
      //             });
      //         }
      //         port.onMessage.addListener(treeListener);
      //         port.onDisconnect.addListener(() => {
      //             port.onMessage.removeListener(treeListener);
      //         });
      //     }
      // });
      // loadOwlComponents();
      fetch('./page_scripts/get_tree.js')
        .then((response) => response.text())
        .then((contents) => {
          chrome.devtools.inspectedWindow.eval(
            contents,
            (result, isException) => {
              if (!isException) {
                Object.keys(this.root).forEach(key => {
                  this.root[key] = result.root[key]
                });
              }
            }
          );
        });
    });
  }
  
  updateTree(component) {
    let path_array = component.path.split('/');
    let element = this.root;
    for (let i = 1; i < path_array.length; i++) {
      element = element.children.filter(child => (child.name + child.key) === path_array[i])[0];
    }
    element.properties = component.properties;
    element.children = component.children;
    element.toggled = component.toggled;
    element.display = component.display;
  }

  selectComponent(component) {
    this.root.selected = false;
    this.root.highlighted = false;
    this.root.children.forEach(child => {
      this.deselectComponent(child)
    });
    let path_array = component.path.split('/');
    let element = this.root;
    for (let i = 1; i < path_array.length; i++) {
      element = element.children.filter(child => (child.name +  child.key) === path_array[i])[0];
    }
    element.selected = true;
    this.highlightChildren(element);
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
  
  static components = { TreeElement };
    
}


