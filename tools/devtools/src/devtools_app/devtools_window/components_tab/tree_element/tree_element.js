/** @odoo-module **/

import { evalInWindow, isElementInCenterViewport } from "../../../../utils";
import { useStore } from "../../../store/store";
import { HighlightText } from "./highlight_text/highlight_text";

const { Component, useState, useEffect, onMounted, onWillUpdateProps} = owl

export class TreeElement extends Component {
  static template = "devtools.TreeElement";
  
  static props = ['name', 'children', 'path', 'key', 'display', 'toggled', 'depth', 'selected', 'highlighted'];
  
  static components = { TreeElement, HighlightText };

  setup(){
    this.state = useState({
      searched: false,
    });
    this.highlightTimeout = false;
    this.store = useStore();
    onMounted(() => {
      if (this.props.selected){
        const treeElement = document.getElementById("treeElement/"+this.props.path.join("/"));
        treeElement.scrollIntoView({block: "center", behavior: "smooth"});
      }
    });
    onWillUpdateProps(nextProps => {
      if(nextProps.selected){
        const treeElement = document.getElementById("treeElement/"+this.props.path.join("/"));
        if(!isElementInCenterViewport(treeElement))
          treeElement.scrollIntoView({block: "center", behavior: "smooth"});
      }
    });
    useEffect(
      (renderPaths) => {
        let pathsAsStrings = renderPaths.map(p => p.join("/"));
        if (pathsAsStrings.includes(this.props.path.join("/"))){
          clearTimeout(this.highlightTimeout);
          const treeElement = document.getElementById("treeElement/" + this.props.path.join("/"));
          if(treeElement){
            treeElement.classList.remove("highlight-fade");
            treeElement.classList.add("render-highlight");
            this.highlightTimeout = setTimeout(() => {
              treeElement.classList.add("highlight-fade");
              treeElement.classList.remove("render-highlight");
            }, 50);
          } 
        }
      },
      () => [this.store.renderPaths]
    );
    useEffect(
      (searchResults) => {
        if(searchResults.includes(this.props.path))
          this.state.searched = true;
        else
          this.state.searched = false;
      },
      () => [this.store.search.searchResults]
    );
  }

  get pathAsString(){return this.props.path.join("/");}

  toggleDisplay(ev){
    this.store.toggleComponentTreeElementDisplay(this.props.path);
  }

  hoverComponent(ev){
    const elements = document.getElementsByClassName("highlight-fade");
    for (const element of elements) 
    element.classList.remove("highlight-fade");
    evalInWindow("highlightComponent", [JSON.stringify(this.props.path)]);
  }
  
  get minimizedKey(){
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2){
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
    }
    else{
      key = "";
    }
    return key;
  }

  toggleComponent(ev){
    if(this.store.settings.toggleOnSelected)
      this.toggleDisplay();
    if(!this.props.selected){
      this.store.selectComponent(this.props.path);
    }
  }

  openMenu(event){
    const menu = document.getElementById("customMenu/" + this.pathAsString);
    menu.classList.remove("hidden");
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    let x = event.clientX;
    let y = event.clientY;
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight;
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  expandAllChildren(ev){
    this.store.toggleComponentAndChildren(this.props.path, true);
  }

  foldAllChildren(ev){
    this.store.toggleComponentAndChildren(this.props.path, false);
  }
}

String.prototype.replaceAt = function(index, replacement) {
  return this.substring(0, index) + replacement + this.substring(index + 1);
}
