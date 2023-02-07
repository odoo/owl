import { evalInWindow } from "../../../../../utils";
import { useStore } from "../../../../store/store";

const { Component, useState, onWillUpdateProps, useEffect } = owl;

export class ObjectTreeElement extends Component {
  static props = ['name', 'content', 'children', 'display', 'toggled', 'depth', 'contentType', 'hasChildren', 'objectType', 'editReactiveState', 'updateBag', 'componentPath', 'loadGetterContent'];
  
  static template = "devtools.ObjectTreeElement";
  
  static components = { ObjectTreeElement };

  setup(){
    this.state = useState({
      editMode: false
    });
    this.store = useStore();
    useEffect(
      (editMode) => {
        // Focus on the input when it is created
        if(editMode){
          const input = document.getElementById("objectEditionInput/"+this.pathAsString);
          input.focus();
          input.select();
        }
      },
      () => [this.state.editMode]
    );
  }

  get pathAsString(){return JSON.stringify(this.props.path)}

  get objectName(){
    if(this.props.contentType === "function" && this.props.content.startsWith("get "))
      return "get " + this.props.name;
    return this.props.name;
  }

  setupEditMode(ev){
    if(!this.state.editMode){
      if(["number", "string", "boolean", "undefined"].includes(this.props.contentType)){
        this.state.editMode = true;
      }
    }
  }

  editObject(ev){
    if (ev.keyCode === 13 && ev.target.value !== ""){
      this.store.editObjectTreeElement(this.props.path, ev.target.value, this.props.objectType);
      this.state.editMode = false;
    }
  }

  loadGetterContent(ev){
    this.store.loadGetterContent(this.props);
  }

  toggleDisplay(ev){
    this.store.toggleObjectTreeElementsDisplay(this.props);
  }

  openMenu(event){
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
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  inspectFunctionSource(){
    evalInWindow("inspectFunctionSource", [JSON.stringify(this.store.activeComponent.path),JSON.stringify(this.props.path)]);
  }

  storeObjectAsGlobal(){
    evalInWindow("storeObjectAsGlobal", [JSON.stringify(this.store.activeComponent.path),JSON.stringify(this.props.path)]);
  }
}



