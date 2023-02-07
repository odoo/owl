const { Component, onWillDestroy, onMounted } = owl
import { Event } from "./event/event";

export class EventsTab extends Component { 
  static template = "devtools.EventsTab";

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
