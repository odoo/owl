/** @odoo-module **/

const { Component, onWillRender, onRendered, onMounted, markup} = owl

export default class TreeElement extends Component {
  setup(){
    onMounted(() => {
      if (this.props.selected){
        const tree_element = document.getElementById("tree_element/"+this.props.path);
        tree_element.scrollIntoView({block: "center"});
      }
    })
  }
  static template = "devtools.tree_element";

  static props = ['name', 'children', 'path', 'key', 'display', 'toggled', 'depth', 'selected', 'highlighted'];

  static components = { TreeElement };

  toggleDisplay(ev){
    this.props.toggled = !this.props.toggled;
    this.props.children.forEach(child => {
      this.swapDisplay(child, this.props.toggled, this.props.toggled)
    });
    this.props.updateComponent(this.props);
  }

  hoverComponent(ev){
    let script = 'owlDevtools__HighlightComponent("' + this.props.path + '")';
    chrome.devtools.inspectedWindow.eval(
      script,
      (result, isException) => {}
    );
  }

  getMinimizedKey(){
    let split = this.props.key.split("__");
    let key;
    if (split.length > 2){
      key = this.props.key.substring(4 + split[1].length, this.props.key.length);
      key = markup('<div class="key_wrapper">key</div>=<div class="key_name">"' + key + '"</div>');
    }
    else{
      key = "";
    }
    return key;
  }

  swapDisplay(element, toggled, display){
    if(!display){
      element.display = false;
    }
    else if(toggled){
      element.display = true;
    }
    element.children.forEach(child => {
      this.swapDisplay(child, element.toggled, element.display)
    });
  }

  toggleComponent(ev){
    if(!this.props.selected){
      this.props.selectComponent(this.props);
    }
  }
}
