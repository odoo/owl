
const { Component, useState, onWillUpdateProps, useEffect } = owl;

export class ObjectTreeElement extends Component {
  setup(){
    this.state = useState({
      editMode: false
    });
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
    onWillUpdateProps(nextProps => {
      debugger;
      console.log(nextProps);
    });
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
      this.props.editObjectTreeElement(this.props.path, ev.target.value, this.props.objectType);
      this.state.editMode = false;
    }
  }

  underlineIfGetter

  loadGetterContent(ev){
    this.props.loadGetterContent(this.props);
  }

  toggleDisplay(ev){
    this.props.toggleObjectTreeElementsDisplay(this.props);
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
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectFunctionSource(${JSON.stringify(this.props.componentPath)}, ${JSON.stringify(this.props.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  storeObjectAsGlobal(){
    const script = `__OWL__DEVTOOLS_GLOBAL_HOOK__.storeObjectAsGlobal(${JSON.stringify(this.props.componentPath)}, ${JSON.stringify(this.props.path)});`;
    chrome.devtools.inspectedWindow.eval(script);
  }

  static props = ['name', 'content', 'children', 'display', 'toggled', 'depth', 'contentType', 'hasChildren', 'objectType', 'editReactiveState', 'updateBag', 'componentPath', 'loadGetterContent'];

  static template = "devtools.ObjectTreeElement";

  static components = { ObjectTreeElement };
}



