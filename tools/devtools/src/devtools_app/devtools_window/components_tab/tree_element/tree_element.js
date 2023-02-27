/** @odoo-module **/

import { isElementInCenterViewport, minimizeKey } from "../../../../utils";
import { useStore } from "../../../store/store";
import { HighlightText } from "./highlight_text/highlight_text";

const { Component, useRef, useState, useEffect, onMounted, onWillUpdateProps } = owl;

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
    this.contextMenu = useRef("contextmenu");
    // Scroll to the selected element when it changes
    onMounted(() => {
      if (this.props.selected) {
        const treeElement = document.getElementById("treeElement/" + this.props.path.join("/"));
        treeElement.scrollIntoView({ block: "center", behavior: "auto" });
      }
    });
    onWillUpdateProps((nextProps) => {
      if (nextProps.selected) {
        const treeElement = document.getElementById("treeElement/" + this.props.path.join("/"));
        if (!isElementInCenterViewport(treeElement)) {
          treeElement.scrollIntoView({ block: "center", behavior: "smooth" });
        }
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
        if (searchResults.includes(this.props.path)) {
          this.state.searched = true;
        } else {
          this.state.searched = false;
        }
      },
      () => [this.store.componentSearch.searchResults]
    );
  }

  get pathAsString() {
    return this.props.path.join("/");
  }

  get componentPadding() {
    return this.props.depth * 0.8;
  }

  // Expand/fold the component node
  toggleDisplay(ev) {
    this.store.toggleComponentTreeElementDisplay(this.props.path);
  }

  get minimizedKey() {
    return minimizeKey(this.props.key);
  }

  // Used to select the component node
  toggleComponent(ev) {
    if (this.store.settings.toggleOnSelected) {
      this.toggleDisplay();
    }
    if (!this.props.selected) {
      this.store.selectComponent(this.props.path);
    }
  }
}
