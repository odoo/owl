
const { Component, useState, onMounted } = owl

export class Event extends Component { 
  setup() {
  }

  goToComponent(){
    this.props.selectComponent(this.props.path);
    this.props.switchTab("ComponentsTree");
  }

  static template = "devtools.Event";
}
