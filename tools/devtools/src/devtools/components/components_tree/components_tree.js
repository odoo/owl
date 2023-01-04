/** @odoo-module **/

import { Component, useState, onWillStart, onWillPatch, onMounted} from "@odoo/owl";
import TreeElement from './tree_element';
import { DetailsWindow } from "./details_window";

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

    this.activeComponent = useState({
      path: "App",
      name: "App",
      properties: {}
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
            script = 'owlDevtools__SendComponentDetails("'+ this.activeComponent.path +'");';
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
      let script = 'owlDevtools__SendTree(null);';
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
      script = 'owlDevtools__SendComponentDetails(null);';
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

  updateProperties(inputProp) {
    let path_array = inputProp.path.split('/');
    let property = this.activeComponent.properties[path_array[0]];
    for (let i = 1; i < path_array.length; i++) {
      let match = path_array[i];
      if (path_array[i].startsWith('[') && path_array[i].endsWith(']')){
        match = Number(path_array[i].substring(1, path_array[i].length-1));
        property = property.children[match];
      }
      else
        property = property.children.filter(child => (child.name) === match)[0];
    }
    if (property.hasChildren && property.children.length === 0) {
      let script = 'owlDevtools__LoadPropsChildren("'+ this.activeComponent.path +'","'+ property.path +'", '+ property.depth +', "'+ property.propertyType +'");'
      console.log(script);
      chrome.devtools.inspectedWindow.eval(
        script,
        (result, isException) => {
          if (!isException) {
            console.log(result);
            property.children = result;
          }
        }
      );
    }
    property.toggled = inputProp.toggled;
    property.display = inputProp.display;
  }

  removeHighlight(ev){
    let script = "owlDevtools__RemoveHighlights()"
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {}
    );
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
  
  static components = { TreeElement, DetailsWindow };
    
}


