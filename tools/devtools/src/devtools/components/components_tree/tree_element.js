/** @odoo-module **/

import { isElementInCenterViewport } from "../../../utils";

const { Component, onWillRender, useEffect, onMounted, markup, onWillUpdateProps} = owl

export class TreeElement extends Component {
  setup(){
    this.searched = false;
    this.highlightTimeout = false;
    onMounted(() => {
      if (this.props.selected){
        const treeElement = document.getElementById("treeElement/"+this.props.path);
        treeElement.scrollIntoView({block: "center", behavior: "smooth"});
      }
    });
    onWillUpdateProps(nextProps => {
      if(nextProps.selected){
        const treeElement = document.getElementById("treeElement/"+this.props.path);
        if(!isElementInCenterViewport(treeElement))
        treeElement.scrollIntoView({block: "center", behavior: "smooth"});
      }
      if(nextProps.searchResults.includes(this.props.path))
        this.searched = true;
      else
        this.searched = false;
    });
    useEffect(
      (renderPaths) => {
        if (renderPaths.includes(this.props.path)){
          clearTimeout(this.highlightTimeout);
          const treeElement = document.getElementById("treeElement/" + this.props.path);
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
      () => [this.props.renderPaths]
    );
  }

  get content() {
    if(this.searched){
      let content = this.props.name;
      let startIndex = 0;
      for (const searchLetter of this.props.search){
        let foundUpper = content.indexOf(searchLetter.toUpperCase(), startIndex);
        if (foundUpper < 0)
          foundUpper = Infinity;
        let foundLower = content.indexOf(searchLetter, startIndex);
        if (foundLower < 0)
          foundLower = Infinity;
        const found = Math.min(foundLower, foundUpper);
        const replacement = '<div class="highlight-search">'+ content[found] +'</div>';
        startIndex = found + replacement.length;
        content = content.replaceAt(found, replacement);
      }
      return markup(content);
    }
    else
      return this.props.name;
  }

  toggleDisplay(ev){
    this.props.toggleComponentTreeElementDisplay(this.props.path);
  }

  hoverComponent(ev){
    const elements = document.getElementsByClassName("highlight-fade");
    for (const element of elements) 
    element.classList.remove("highlight-fade");
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.highlightComponent("' + this.props.path + '")';
    chrome.devtools.inspectedWindow.eval(script);
  }
  
  getMinimizedKey(){
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2){
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
      key = markup('<div class="key-wrapper">key</div>=<div class="key-name">"' + key + '"</div>');
    }
    else{
      key = "";
    }
    return key;
  }

  toggleComponent(ev){
    if(!this.props.selected){
      this.props.selectComponent(this.props.path);
    }
  }

  openMenu(event){
    const menu = document.getElementById("customMenu/" + this.props.path);
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
    this.props.toggleComponentAndChildren(this.props.path, true);
  }

  foldAllChildren(ev){
    this.props.toggleComponentAndChildren(this.props.path, false);
  }

  static template = "devtools.TreeElement";
  
  static props = ['name', 'children', 'path', 'key', 'display', 'toggled', 'depth', 'selected', 'highlighted', 'search', 'searchResults', 'toggleComponentAndChildren'];
  
  static components = { TreeElement };
}

String.prototype.replaceAt = function(index, replacement) {
  return this.substring(0, index) + replacement + this.substring(index + 1);
}
