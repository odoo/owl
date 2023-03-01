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
    this.store = useStore();
    this.contextMenu = useRef("contextmenu");
    this.contextMenuId = this.store.contextMenu.id++;
    this.contextMenuEvent,
      // Scroll to the selected element when it changes
      onMounted(() => {
        if (this.props.component.selected) {
          const treeElement = document.getElementById(
            "treeElement/" + this.props.component.path.join("/")
          );
          treeElement.scrollIntoView({ block: "center", behavior: "auto" });
        }
      });
    onWillUpdateProps((nextProps) => {
      if (nextProps.selected) {
        const treeElement = document.getElementById(
          "treeElement/" + this.props.component.path.join("/")
        );
        if (!isElementInCenterViewport(treeElement)) {
          treeElement.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    });
    useEffect(
      (menuId) => {
        if (menuId === this.contextMenuId) {
          this.store.contextMenu.open(this.contextMenuEvent, this.contextMenu.el);
        }
      },
      () => [this.store.contextMenu.activeMenu]
    );
    // Effect to apply a short highlight effect to the component when it is rendered
    useEffect(
      (renderPaths) => {
        let pathsAsStrings = renderPaths.map((p) => p.join("/"));
        if (pathsAsStrings.includes(this.props.component.path.join("/"))) {
          const treeElement = document.getElementById(
            "treeElement/" + this.props.component.path.join("/")
          );
          if (treeElement) {
            treeElement.classList.add("render-highlight");
            setTimeout(() => {
              treeElement.classList.add("highlight-fade");
              treeElement.classList.remove("render-highlight");
              setTimeout(() => {
                treeElement.classList.remove("highlight-fade");
              }, 500);
            }, 50);
          }
        }
      },
      () => [this.store.renderPaths]
    );
    // Used to know when the component is in the search bar results
    useEffect(
      (searchResults) => {
        if (searchResults.includes(this.props.component.path)) {
          this.state.searched = true;
        } else {
          this.state.searched = false;
        }
      },
      () => [this.store.componentSearch.searchResults]
    );
  }

  get pathAsString() {
    return this.props.component.path.join("/");
  }

  get componentPadding() {
    return this.props.component.depth * 0.8;
  }

  get minimizedKey() {
    return minimizeKey(this.props.component.key);
  }

  openMenu(ev) {
    this.contextMenuEvent = ev;
    this.store.contextMenu.activeMenu = this.contextMenuId;
  }

  // Expand/fold the component node
  toggleDisplay() {
    this.props.component.toggled = !this.props.component.toggled;
  }

  // Used to select the component node
  toggleComponent() {
    if (this.store.settings.toggleOnSelected) {
      this.toggleDisplay();
    }
    if (!this.props.component.selected) {
      this.store.selectComponent(this.props.component.path);
    }
  }
}
