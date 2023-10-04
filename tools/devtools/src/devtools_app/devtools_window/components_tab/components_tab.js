/** @odoo-module **/

const { Component, onWillUnmount, useExternalListener } = owl;
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
    useExternalListener(document, "keydown", this.onKeyboardEvent);
    useExternalListener(window, "resize", this.onWindowResize);

    onWillUnmount(() => {
      window.removeEventListener("mousemove", this.onMouseMove);
      window.removeEventListener("mouseup", this.onMouseUp);
    });
  }

  // Apply the right action depending on which arrow key is pressed (on keydown)
  onKeyboardEvent(event) {
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
    this.store.splitPosition = Math.max(
      Math.min((event.clientX / window.innerWidth) * 100, maxWidth),
      minWidth
    );
  };

  onMouseUp = () => {
    // Remove the event listeners when the user releases the mouse button
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
  };

  onWindowResize = () => {
    const minWidth = (147 / window.innerWidth) * 100;
    this.store.splitPosition = Math.max(this.store.splitPosition, minWidth);
  };
}
