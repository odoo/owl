/** @odoo-module **/

const { Component, useState, useEffect, onWillUnmount, onMounted } = owl;
import { TreeElement } from "./tree_element/tree_element";
import { DetailsWindow } from "./details_window/details_window";
import { ComponentSearchBar } from "./component_search_bar/component_search_bar";
import { useStore } from "../../store/store";

export class ComponentsTab extends Component {
  static template = "devtools.ComponentsTab";

  static components = { TreeElement, DetailsWindow, ComponentSearchBar };

  setup() {
    this.store = useStore();
    this.flushRendersTimeout = false;
    onMounted(async () => {
      this.computeWindowWidth();
      window.addEventListener("resize", this.computeWindowWidth);
      document.addEventListener("keydown", this.handleCommands);
    });

    onWillUnmount(() => {
      window.removeEventListener("resize", this.computeWindowWidth);
      window.removeEventListener("mousemove", this.handleMouseMove);
      window.removeEventListener("mouseup", this.handleMouseUp);
      document.removeEventListener("keydown", this.handleCommands);
    });
  }

  // Apply the right action depending on which arrow key is pressed (on keydown)
  handleCommands = (event) => {
    switch (event.key) {
      case "ArrowLeft":
        this.store.toggleOrSelectPrevElement(true);
        event.preventDefault();
        break;
      case "ArrowUp":
        this.store.toggleOrSelectPrevElement(false);
        event.preventDefault();
        break;
      case "ArrowRight":
        this.store.toggleOrSelectNextElement(true);
        event.preventDefault();
        break;
      case "ArrowDown":
        this.store.toggleOrSelectNextElement(false);
        event.preventDefault();
        break;
    }
  };

  // Compute the width of the left and right windows based on the split position
  computeWindowWidth = (event) => {
    const width = window.innerWidth || document.body.clientWidth;
    this.store.leftWidth = (this.store.splitPosition / 100) * width - 2;
    this.store.rightWidth = (1 - this.store.splitPosition / 100) * width;
  };

  // Get the width of the component node display so that it remains correct while scrolling horizontally.
  getTreeWrapperWidth() {
    let treeWrapper = document.getElementById("tree-wrapper");
    return Math.max(treeWrapper.style.minWidth, this.store.leftWidth);
  }

  handleMouseDown = (event) => {
    // Add event listeners for mouse move and mouse up events
    // to allow the user to drag the split screen border
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  };

  // Adjust the position of the split between the left and right right window of the components tab
  handleMouseMove = (event) => {
    this.store.splitPosition = Math.max(
      Math.min((event.clientX / window.innerWidth) * 100, 85),
      15
    );
    this.computeWindowWidth();
  };

  handleMouseUp = (event) => {
    // Remove the event listeners when the user releases the mouse button
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
  };
}
