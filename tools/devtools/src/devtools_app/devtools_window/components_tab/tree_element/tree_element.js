/** @odoo-module **/

import { evalInWindow, isElementInCenterViewport } from "../../../../utils";
import { useStore } from "../../../store/store";
import { HighlightText } from "./highlight_text/highlight_text";

const { Component, useState, useEffect, onMounted, onWillUpdateProps } = owl;

export class TreeElement extends Component {
  static template = "devtools.TreeElement";

  static props = [
    "name",
    "children",
    "path",
    "key",
    "display",
    "toggled",
    "depth",
    "selected",
    "highlighted",
  ];

  static components = { TreeElement, HighlightText };

  setup() {
    this.state = useState({
      searched: false,
    });
    this.highlightTimeout = false;
    this.store = useStore();
    // Scroll to the selected element when it changes
    onMounted(() => {
      if (this.props.selected) {
        const treeElement = document.getElementById("treeElement/" + this.props.path.join("/"));
        treeElement.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
    onWillUpdateProps((nextProps) => {
      if (nextProps.selected) {
        const treeElement = document.getElementById("treeElement/" + this.props.path.join("/"));
        if (!isElementInCenterViewport(treeElement))
          treeElement.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
    // Effect to apply a short highlight effect to the component when it is rendered
    useEffect(
      (renderPaths) => {
        let pathsAsStrings = renderPaths.map((p) => p.join("/"));
        if (pathsAsStrings.includes(this.props.path.join("/"))) {
          clearTimeout(this.highlightTimeout);
          const treeElement = document.getElementById("treeElement/" + this.props.path.join("/"));
          if (treeElement) {
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
    // Used to know when the component is in the search bar results
    useEffect(
      (searchResults) => {
        if (searchResults.includes(this.props.path)) this.state.searched = true;
        else this.state.searched = false;
      },
      () => [this.store.componentSearch.searchResults]
    );
  }

  get pathAsString() {
    return this.props.path.join("/");
  }

  // Expand/fold the component node
  toggleDisplay(ev) {
    this.store.toggleComponentTreeElementDisplay(this.props.path);
  }

  // Trigger the highlight on the component in the page when the node is hovered
  hoverComponent(ev) {
    evalInWindow("highlightComponent", [JSON.stringify(this.props.path)], this.store.activeFrame);
  }

  // Formatting for displaying the key of the component
  get minimizedKey() {
    const split = this.props.key.split("__");
    let key;
    if (split.length > 2) {
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
    } else {
      key = "";
    }
    return key;
  }

  // Used to select the component node
  toggleComponent(ev) {
    if (this.store.settings.toggleOnSelected) this.toggleDisplay();
    if (!this.props.selected) {
      this.store.selectComponent(this.props.path);
    }
  }

  // Display the custom context menu to access the expandAll and foldAll methods
  openMenu(event) {
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
    menu.style.left = x + "px";
    // Need 25px offset because of the main navbar from the browser devtools
    menu.style.top = y - 25 + "px";
  }

  expandAllChildren(ev) {
    this.store.toggleComponentAndChildren(this.props.path, true);
  }

  foldAllChildren(ev) {
    this.store.toggleComponentAndChildren(this.props.path, false);
  }
}
