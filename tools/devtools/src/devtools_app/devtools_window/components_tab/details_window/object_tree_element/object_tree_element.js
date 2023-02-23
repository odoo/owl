import { evalInWindow } from "../../../../../utils";
import { useStore } from "../../../../store/store";

const { Component, useState, onWillUpdateProps, useEffect } = owl;

export class ObjectTreeElement extends Component {
  static props = [
    "name",
    "content",
    "children",
    "display",
    "toggled",
    "depth",
    "contentType",
    "hasChildren",
    "objectType",
    "editReactiveState",
    "updateBag",
    "componentPath",
    "loadGetterContent",
  ];

  static template = "devtools.ObjectTreeElement";

  static components = { ObjectTreeElement };

  setup() {
    this.state = useState({
      editMode: false,
    });
    this.store = useStore();
    useEffect(
      (editMode) => {
        // Focus on the input when it is created
        if (editMode) {
          const input = document.getElementById("objectEditionInput/" + this.pathAsString);
          input.focus();
          input.select();
        }
      },
      () => [this.state.editMode]
    );
  }

  get pathAsString() {
    return JSON.stringify(this.props.path);
  }

  get objectName() {
    if (this.props.contentType === "function" && this.props.content.startsWith("get ")) {
      return "get " + this.props.name;
    }
    return this.props.name;
  }

  get attenuateIfPrototype() {
    if(this.pathAsString.includes('{"type":"prototype"}')){
      return {'attenuate': true};
    }
    return {};
  }

  setupEditMode(ev) {
    if(this.store.activeComponent.path.length === 1)
      return;
    if (!this.state.editMode) {
      if (["number", "string", "boolean", "undefined"].includes(this.props.contentType)) {
        this.state.editMode = true;
      }
    }
  }

  editObject(ev) {
    let value = ev.target.value;
    if (ev.keyCode === 13 && value !== "") {
      if (this.props.contentType === "string") {
        value = JSON.stringify(value.substring(1, value.length - 1));
      }
      this.store.editObjectTreeElement(this.props.path, value, this.props.objectType);
      this.state.editMode = false;
    }
  }

  loadGetterContent(ev) {
    this.store.loadGetterContent(this.props);
  }

  toggleDisplay(ev) {
    this.store.toggleObjectTreeElementsDisplay(this.props);
  }

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

  inspectFunctionSource() {
    evalInWindow(
      "inspectFunctionSource",
      [JSON.stringify(this.store.activeComponent.path), JSON.stringify(this.props.path)],
      this.store.activeFrame
    );
  }

  storeObjectAsGlobal() {
    evalInWindow(
      "storeObjectAsGlobal",
      [JSON.stringify(this.store.activeComponent.path), JSON.stringify(this.props.path)],
      this.store.activeFrame
    );
  }
}
