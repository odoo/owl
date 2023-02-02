const { Component, onWillDestroy, onMounted } = owl
import { Event } from "./event";

export class Events extends Component { 
  static template = "devtools.Events";

  static components = { Event };
  
  setup() {
  }

  toggleRecording(){
    this.props.toggleRecorder();
  }

  clearConsole(){
    this.props.clearEvents();
  }

  blacklistAll(){
    this.props.bus.trigger("blacklistAll");
  }

  clearBlacklist(){
    this.props.clearBlacklist();
  }

  notInBlacklist(component){
    return !this.props.blacklist.has(component);
  }

}
