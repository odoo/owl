import { useStore } from "../../../../store/store";

const { Component, useState, useEffect, useRef } = owl;

export class ObjectTreeElement extends Component {
  static template = "devtools.ObjectTreeElement";

  static components = { ObjectTreeElement };

  setup() {
    this.state = useState({
      editMode: false,
      menuTop: 0,
      menuLeft: 0,
    });
    this.contextMenu = useRef("contextmenu");
    const inputRef = useRef("input");
    this.store = useStore();
    this.contextMenuId = this.store.contextMenu.id++;
    this.contextMenuEvent,
      useEffect(
        (menuId) => {
          if (menuId === this.contextMenuId) {
            this.store.contextMenu.open(this.contextMenuEvent, this.contextMenu.el);
          }
        },
        () => [this.store.contextMenu.activeMenu]
      );
    useEffect(
      (editMode) => {
        // Focus on the input when it is created
        if (editMode) {
          inputRef.el.select();
        }
      },
      () => [this.state.editMode]
    );
  }

  get pathAsString() {
    return JSON.stringify(this.props.object.path);
  }

  get objectName() {
    return this.props.object.name;
  }

  get objectLineClass() {
    // Prototype items will be dyed down to appear less important
    if (this.pathAsString.includes('{"type":"prototype",')) {
      return { attenuate: true };
    }
    // Same for subscription items which are not present in the keys while the keys will be bold
    if (this.props.object.objectType === "subscription" && this.props.object.depth > 0) {
      if (this.props.keys.includes(this.props.object.name.toString())) {
        return { "fw-bolder": true };
      }
      return { attenuate: true };
    }
    return {};
  }

  get objectPadding() {
    return this.props.object.depth * 0.8 + 0.3;
  }

  openMenu(ev) {
    this.contextMenuEvent = ev;
    this.store.contextMenu.activeMenu = this.contextMenuId;
  }

  setupEditMode() {
    if (!this.state.editMode) {
      if (!this.props.object.hasChildren) {
        this.state.editMode = true;
      }
    }
  }

  editObject(ev) {
    let value = ev.target.value;
    if (ev.keyCode === 13 && value !== "") {
      this.store.editObjectTreeElement(this.props.object.path, value, this.props.object.objectType);
      this.state.editMode = false;
    }
  }
}
