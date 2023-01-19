
const { Component, useState, onRendered, useEffect } = owl;

export class ObjectTreeElement extends Component {
  setup(){
    this.state = useState({
      editMode: false
    });
    useEffect(
      (editMode) => {
        // Focus on the input when it is created
        if(editMode){
          const input = document.getElementById("objectEditionInput/"+this.props.path);
          input.focus();
          input.select();
        }
      },
      () => [this.state.editMode]
    );
  }

  setupEditMode(ev){
    if(!this.state.editMode){
      if(["number", "string", "boolean", "undefined"].includes(this.props.contentType) && !this.props.path.startsWith("constructor")){
        this.state.editMode = true;
      }
    }
  }

  editObject(ev){
    if (ev.keyCode === 13 && ev.target.value !== ""){
      this.props.editObjectTreeElement(this.props.path, ev.target.value, this.props.objectType);
      this.state.editMode = false;
    }
  }

  toggleDisplay(ev){
    this.props.toggleObjectTreeElementsDisplay(this.props);
  }

  openMenu(event){
    const menu = document.getElementById("customMenu/" + this.props.path);
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
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectFunctionSource("' + this.props.componentPath +'", "' + this.props.path +'");';
    chrome.devtools.inspectedWindow.eval(script);
  }

  storeObjectAsGlobal(){
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.storeObjectAsGlobal("' + this.props.componentPath +'", "' + this.props.path +'");';
    chrome.devtools.inspectedWindow.eval(script);
  }

  static props = ['name', 'content', 'children', 'display', 'toggled', 'depth', 'contentType', 'hasChildren', 'objectType', 'editReactiveState', 'updateBag', 'componentPath'];

  static template = "devtools.ObjectTreeElement";

  static components = { ObjectTreeElement };
}



