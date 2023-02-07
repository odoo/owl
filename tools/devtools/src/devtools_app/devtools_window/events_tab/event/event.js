import { useStore } from "../../../store/store";

const { Component, useState, onMounted } = owl

export class Event extends Component { 
  static template = "devtools.Event";

  setup() {
    this.store = useStore();
  }

  goToComponent(){
    this.store.selectComponent(this.props.path);
    this.store.switchTab("ComponentsTab");
  }

  addInstanceToBlacklist(){
  }

  addComponentToBlacklist(){
  }
}
