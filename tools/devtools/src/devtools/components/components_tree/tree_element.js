/** @odoo-module **/

import { isElementInCenterViewport } from "../../../utils";

const { Component, onWillRender, useEffect, onMounted, markup, onWillUpdateProps} = owl

export class TreeElement extends Component {
  setup(){
    this.searched = false;
    this.highlightTimeout = false;
    onMounted(() => {
      if (this.props.selected){
        const tree_element = document.getElementById("tree_element/"+this.props.path);
        tree_element.scrollIntoView({block: "center", behavior: "smooth"});
      }
    });
    onWillUpdateProps(nextProps => {
      if(nextProps.selected){
        const tree_element = document.getElementById("tree_element/"+this.props.path);
        if(!isElementInCenterViewport(tree_element))
          tree_element.scrollIntoView({block: "center", behavior: "smooth"});
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
          const treeElement = document.getElementById("tree_element/" + this.props.path);
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
      let start_index = 0;
      for (const searchLetter of this.props.search){
        let foundUpper = content.indexOf(searchLetter.toUpperCase(), start_index);
        if (foundUpper < 0)
          foundUpper = Infinity;
        let foundLower = content.indexOf(searchLetter, start_index);
        if (foundLower < 0)
          foundLower = Infinity;
        const found = Math.min(foundLower, foundUpper);
        const replacement = '<div class="highlight-search">'+ content[found] +'</div>';
        start_index = found + replacement.length;
        content = content.replaceAt(found, replacement);
      }
      return markup(content);
    }
    else
      return this.props.name;
  }

  static template = "devtools.TreeElement";
  
  static props = ['name', 'children', 'path', 'key', 'display', 'toggled', 'depth', 'selected', 'highlighted', 'search', 'searchResults'];
  
  static components = { TreeElement };
  
  toggleDisplay(ev){
    this.props.toggled = !this.props.toggled;
    this.props.children.forEach(child => {
      this.swapDisplay(child, this.props.toggled, this.props.toggled)
    });
    this.props.updateComponent(this.props);
  }

  hoverComponent(ev){
    const elements = document.getElementsByClassName("highlight-fade");
    for (const element of elements) 
      element.classList.remove("highlight-fade");
    const script = 'owlDevtools__HighlightComponent("' + this.props.path + '")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  getMinimizedKey(){
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2){
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
      key = markup('<div class="key_wrapper">key</div>=<div class="key_name">"' + key + '"</div>');
    }
    else{
      key = "";
    }
    return key;
  }

  swapDisplay(element, toggled, display){
    if(!display){
      element.display = false;
    }
    else if(toggled){
      element.display = true;
    }
    element.children.forEach(child => {
      this.swapDisplay(child, element.toggled, element.display)
    });
  }

  toggleComponent(ev){
    if(!this.props.selected){
      this.props.selectComponent(this.props.path);
    }
  }
}

String.prototype.replaceAt = function(index, replacement) {
  return this.substring(0, index) + replacement + this.substring(index + 1);
}
