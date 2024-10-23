import { useStore } from "../store/store";

const { Component, useEffect, useRef } = owl;

export class ContextMenu extends Component {
  static template = "devtools.ContextMenu";
  static props = {
    items: Array,
  };
  setup() {
    this.store = useStore();
    this.contextMenu = useRef("contextmenu");
    useEffect(
      (position) => {
        const menu = this.contextMenu.el;
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let { x, y } = position;
        if (x + menuWidth > window.innerWidth) {
          x = window.innerWidth - menuWidth;
        }
        if (y + menuHeight > window.innerHeight) {
          y = window.innerHeight - menuHeight;
        }
        menu.style.left = x + "px";
        // Need 25px offset because of the main navbar from the browser devtools
        menu.style.top = y + "px";
      },
      () => [this.store.contextMenu?.position]
    );
  }
  onClickItem(action) {
    action();
    this.store.contextMenu = null;
  }
}
