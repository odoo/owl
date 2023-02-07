/** @odoo-module **/

const { Component, useState, useEffect, onWillUnmount, onMounted} = owl
import { TreeElement } from './tree_element/tree_element';
import { DetailsWindow } from "./details_window/details_window";
import { SearchBar } from './search_bar/search_bar';
import { useStore } from '../../store/store';

export class ComponentsTab extends Component {

  static template = "devtools.ComponentsTab";
  
  static components = { TreeElement, DetailsWindow, SearchBar };

  setup(){
    this.store = useStore();
    this.flushRendersTimeout = false;
    onMounted(async () => {
      // On mount, retreive the component tree from the page and the details of the inspected component
      this.computeWindowWidth();
      //use useExternalListener into setup
      window.addEventListener("resize", this.computeWindowWidth);
      document.addEventListener('click', this.hideContextMenus, true);
      document.addEventListener('contextmenu', this.hideContextMenus, true);
      document.addEventListener('keydown', this.handleCommands);
    });

    onWillUnmount(() => {
      window.removeEventListener("resize", this.computeWindowWidth);
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("mouseup", this.handleMouseUp);
      document.removeEventListener('click', this.hideContextMenus);
      document.removeEventListener('contextmenu', this.hideContextMenus);
      document.removeEventListener('keydown', this.handleCommands);
    });
  }

  hideContextMenus = (event) => {
    const customMenus = document.querySelectorAll(".custom-menu");
    customMenus.forEach(menu => menu.classList.add("hidden"));
  }

  handleCommands = (event) => {
    switch(event.keyCode) {
      case 37:
        this.store.toggleOrSelectPrevElement(true);
        event.preventDefault();
        break;
      case 38:
        this.store.toggleOrSelectPrevElement(false);
        event.preventDefault();
        break;
      case 39:
        this.store.toggleOrSelectNextElement(true);
        event.preventDefault();
        break;
      case 40:
        this.store.toggleOrSelectNextElement(false);
        event.preventDefault();
        break;
    }
  }

  // Compute the width of the left and right windows based on the split position
  computeWindowWidth = (event) => {
    const width = window.innerWidth || document.body.clientWidth;
    this.store.leftWidth = (this.store.splitPosition/100) * width - 2;
    this.store.rightWidth = (1 - this.store.splitPosition/100) * width;
  }

  getTreeWrapperWidth(){
    let treeWrapper = document.getElementById('tree-wrapper');
    return Math.max(treeWrapper.style.minWidth, this.store.leftWidth);
  }

  handleMouseDown = (event) => {
    // Add event listeners for mouse move and mouse up events
    // to allow the user to drag the split screen border
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  }
  
  handleMouseMove = (event) => {
    this.store.splitPosition = Math.max(Math.min(event.clientX / window.innerWidth * 100, 85), 15);
    this.computeWindowWidth();
  }
  
  handleMouseUp = (event) => {
  // Remove the event listeners when the user releases the mouse button
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }
}


