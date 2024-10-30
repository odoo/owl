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
    const inputRef = useRef("input");
    this.store = useStore();
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

  get keyChanges() {
    return this.props.object.keys?.includes("Symbol(Key changes)");
  }

  classFor(object) {
    // Prototype items will be dyed down to appear less important
    if (object.path.some((item) => item?.type === "prototype") && !object.keepLit) {
      return "attenuate";
    }
    // Same for subscription items which are not present in the keys while the keys will be bold
    if (object.objectType === "subscription" && object.depth > 0) {
      if (this.props.object.keys?.includes(object.name.toString())) {
        return "fw-bolder";
      }
      return "attenuate";
    }
  }

  get objectPadding() {
    return this.props.object.depth * 0.8 + 0.3;
  }

  get contextMenuItems() {
    return [
      {
        title: "Store as global variable",
        show: true,
        action: () => this.store.logObjectInConsole(this.props.object.path),
      },
      {
        title: "Inspect function source code",
        show: this.props.object.contentType === "function",
        action: () => this.store.inspectFunctionSource(this.props.object.path),
      },
      {
        title: "Observe variable",
        show: this.props.object.objectType !== "observed",
        action: () => this.store.observeVariable(this.props.object.path),
      },
      {
        title: "Unobserve variable",
        show: this.props.object.objectType === "observed",
        action: () => this.store.clearObservedVariable(this.props.index),
      },
      {
        title: "Inject breakpoint on component",
        show: this.props.object.contentType === "array" && this.props.object.objectType === "hook",
        action: () =>
          this.store.injectBreakpoint(this.props.object.name, this.store.activeComponent.path),
      },
      {
        title: "Inject conditional breakpoint on component",
        show: this.props.object.contentType === "array" && this.props.object.objectType === "hook",
        action: () => {
          const condition = window.prompt("Enter the condition");
          if (condition) {
            this.store.injectBreakpoint(
              this.props.object.name,
              this.store.activeComponent.path,
              false,
              condition
            );
          }
        },
      },
      {
        title: "Inject breakpoint on instance",
        show:
          this.props.object.contentType === "array" &&
          this.props.object.objectType === "hook" &&
          !["mounted", "willStart"].includes(this.props.object.name),
        action: () =>
          this.store.injectBreakpoint(
            this.props.object.name,
            this.store.activeComponent.path,
            true
          ),
      },
    ];
  }

  openMenu(ev) {
    this.store.openContextMenu(ev, this.contextMenuItems);
  }

  setupEditMode() {
    if (
      !this.state.editMode &&
      !this.props.object.hasChildren &&
      !(this.props.object.objectType === "observed")
    ) {
      this.state.editMode = true;
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
