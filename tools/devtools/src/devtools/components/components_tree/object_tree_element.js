
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
    this.props.toggled = !this.props.toggled;
    this.props.children.forEach(child => {
        this.swapDisplay(child, this.props.toggled, this.props.toggled)
    });
    this.props.updateBag(this.props.path, this.props.toggled, this.props.display);
    this.props.updateObjectTreeElement(this.props);
  }

  swapDisplay(element, parentToggled, parentDisplayed){
    if(!parentDisplayed){
      // An element is always hidden if its parent is also hidden
      element.display = false;
    }
    else if(parentToggled){
      // If the parent is displayed and toggled then we display the child
      element.display = true;
    }
    this.props.updateBag(element.path, element.toggled, element.display);
    element.children.forEach(child => {
        this.swapDisplay(child, element.toggled, element.display)
    });
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



