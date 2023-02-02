
const { Component, useState, onMounted } = owl

export class Event extends Component { 
  static template = "devtools.Event";

  setup() {
  }

  goToComponent(){
    this.props.selectComponent(this.props.path);
    this.props.switchTab("ComponentsTree");
  }

  addInstanceToBlacklist(){
    // this.props.addToBlacklist(this.props.component);
  }

  addComponentToBlacklist(){
    // this.props.bus.trigger("blacklistComponent", this.props.component)
  }
}
