
const { Component, useState, onRendered, onWillUpdateProps } = owl;

export class ObjectTreeElement extends Component {
  setup(){
    this.state = useState({
      editMode: false
    });
    // onRendered(() => {
    //   if(this.state.editMode){
    //     console.log("subscriptionInput/"+this.props.path);
    //     let input = document.getElementById("subscriptionInput/"+this.props.path);
    //     console.log(input);
    //     // input.focus();
    //     // input.select();
    //   }
    // })
  }
  get content(){
    return this.props.content;
  }

  setupEditMode(ev){
    if(!this.state.editMode){
      if(this.props.objectType === "subscription" && ["number", "string", "boolean", "undefined"].includes(this.props.contentType)){
        this.state.editMode = true;
      }
    }
  }

  editState(ev){
    if (ev.keyCode === 13 && ev.target.value != ""){
      this.props.editReactiveState(this.props.path, ev.target.value);
      this.state.editMode = false;
    }
  }

  toggleDisplay(ev){
    ev.stopPropagation();
    this.props.toggled = !this.props.toggled;
    this.props.children.forEach(child => {
        this.swapDisplay(child, this.props.toggled, this.props.toggled)
    });
    this.props.updateBag(this.props.path, this.props.toggled, this.props.display);
    this.props.updateObjectTreeElement(this.props);
  }

  swapDisplay(element, toggled, display){
    if(!display){
        element.display = false;
    }
    else if(toggled){
        element.display = true;
    }
    this.props.updateBag(element.path, element.toggled, element.display);
    element.children.forEach(child => {
        this.swapDisplay(child, element.toggled, element.display)
    });
  }

  static props = ['name', 'content', 'children', 'display', 'toggled', 'depth', 'contentType', 'hasChildren', 'elementType', 'editReactiveState', 'updateBag'];

  static template = "devtools.object_tree_element";

  static components = { ObjectTreeElement };
}



