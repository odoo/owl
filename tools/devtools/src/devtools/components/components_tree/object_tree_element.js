
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
          let input = document.getElementById("objectEditionInput/"+this.props.path);
          input.focus();
          input.select();
        }
      },
      () => [this.state.editMode]
    );
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
      this.props.editObjectTreeElement(this.props.path, ev.target.value, this.props.objectType);
      this.state.editMode = false;
    }
  }

  toggleDisplay(ev){
    this.props.toggled = !this.props.toggled;
    this.props.children.forEach(child => {
        this.swapDisplay(child, this.props.toggled, this.props.toggled)
    });
    this.props.updateBag(this.props.path, this.props.objectType, this.props.toggled, this.props.display);
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
    this.props.updateBag(element.path, element.objectType, element.toggled, element.display);
    element.children.forEach(child => {
        this.swapDisplay(child, element.toggled, element.display)
    });
  }

  static props = ['name', 'content', 'children', 'display', 'toggled', 'depth', 'contentType', 'hasChildren', 'objectType', 'editReactiveState', 'updateBag'];

  static template = "devtools.ObjectTreeElement";

  static components = { ObjectTreeElement };
}



