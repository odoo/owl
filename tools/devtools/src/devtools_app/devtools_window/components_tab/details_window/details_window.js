const { Component, useRef, useEffect } = owl;
import { useStore } from "../../../store/store";
import { ObjectTreeElement } from "./object_tree_element/object_tree_element";

export class DetailsWindow extends Component {
  static template = "devtools.DetailsWindow";
  static components = { ObjectTreeElement };
  setup() {
    this.store = useStore();
    this.contextMenu = useRef("contextmenu");
    this.contextMenuId = this.store.contextMenu.id++;
    this.contextMenuEvent;
    // Open the context menu when the ids match
    useEffect(
      (menuId) => {
        if (menuId === this.contextMenuId) {
          this.store.contextMenu.open(this.contextMenuEvent, this.contextMenu.el);
        }
      },
      () => [this.store.contextMenu.activeMenu]
    );
  }

  openMenu(ev) {
    this.contextMenuEvent = ev;
    this.store.contextMenu.activeMenu = this.contextMenuId;
  }

  toggleCategory(ev, category) {
    this.store.activeComponent[category].toggled = !this.store.activeComponent[category].toggled;
  }
}
