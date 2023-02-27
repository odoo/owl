import { evalInWindow } from "../../../../../utils";
import { useStore } from "../../../../store/store";

const { Component, useState, useEffect, useRef } = owl;

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
      menuTop: 0,
      menuLeft: 0,
    });
    this.contextMenu = useRef("contextmenu");
    const inputRef = useRef("input");
    this.store = useStore();
    useEffect(
      (editMode) => {
        // Focus on the input when it is created
        if (editMode) {
          inputRef.el.focus();
          inputRef.el.select();
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
    if (this.pathAsString.includes('{"type":"prototype"}')) {
      return { attenuate: true };
    }
    return {};
  }

  get objectPadding() {
    return this.props.depth * 0.8 + 0.3;
  }

  setupEditMode() {
    if (this.store.activeComponent.path.length === 1) {
      return;
    }
    if (!this.state.editMode) {
      if (
        ["number", "string", "boolean", "undefined"].includes(this.props.contentType) ||
        this.props.content === "null"
      ) {
        this.state.editMode = true;
      }
    }
  }

  editObject(ev) {
    let value = ev.target.value;
    if (ev.keyCode === 13 && value !== "") {
      this.store.editObjectTreeElement(this.props.path, value, this.props.objectType);
      this.state.editMode = false;
    }
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
