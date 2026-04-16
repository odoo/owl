/** @odoo-module **/

const { Component, onWillDestroy, useListener, plugin } = owl;
import { TreeElement } from "./tree_element/tree_element";
import { DetailsWindow } from "./details_window/details_window";
import { ComponentSearchBar } from "./component_search_bar/component_search_bar";
import { StorePlugin } from "../../store/store";
import { ComponentsPlugin } from "../../store/components_plugin";

export class ComponentsTab extends Component {
  static template = "devtools.ComponentsTab";

  static components = { TreeElement, DetailsWindow, ComponentSearchBar };

  setup() {
    this.store = plugin(StorePlugin);
    this.components = plugin(ComponentsPlugin);
    this.flushRendersTimeout = false;
    useListener(document, "keydown", this.onKeyboardEvent.bind(this));
    useListener(window, "resize", this.onWindowResize);

    onWillDestroy(() => {
      window.removeEventListener("mousemove", this.onMouseMove);
      window.removeEventListener("mouseup", this.onMouseUp);
    });
  }

  // Apply the right action depending on which arrow key is pressed (on keydown)
  onKeyboardEvent(event) {
    switch (event.key) {
      case "ArrowLeft":
        this.components.toggleOrSelectPrevElement(true);
        event.preventDefault();
        break;
      case "ArrowUp":
        this.components.toggleOrSelectPrevElement(false);
        event.preventDefault();
        break;
      case "ArrowRight":
        this.components.toggleOrSelectNextElement(true);
        event.preventDefault();
        break;
      case "ArrowDown":
        this.components.toggleOrSelectNextElement(false);
        event.preventDefault();
        break;
    }
  }

  onMouseDown = () => {
    // Add event listeners for mouse move and mouse up events
    // to allow the user to drag the split screen border
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
  };

  // Adjust the position of the split between the left and right right window of the components tab
  onMouseMove = (event) => {
    const minWidth = (147 / window.innerWidth) * 100;
    const maxWidth = 100 - (100 / window.innerWidth) * 100;
    this.store.splitPosition.set(
      Math.max(Math.min((event.clientX / window.innerWidth) * 100, maxWidth), minWidth)
    );
  };

  onMouseUp = () => {
    // Remove the event listeners when the user releases the mouse button
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
  };

  onWindowResize = () => {
    const minWidth = (147 / window.innerWidth) * 100;
    if (minWidth <= 100) {
      this.store.splitPosition.set(Math.max(this.store.splitPosition(), minWidth));
    }
  };
}
