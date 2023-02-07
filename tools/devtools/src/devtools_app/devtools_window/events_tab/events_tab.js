const { Component, onWillDestroy, onMounted } = owl
import { useStore } from "../../store/store";
import { Event } from "./event/event";

export class EventsTab extends Component { 
  static template = "devtools.EventsTab";

  static components = { Event };
  
  setup() {
    this.store = useStore();
  }

  toggleRecording(){
    this.store.activeRecorder = !this.store.activeRecorder;
  }

  clearConsole(){
    this.store.events = [];
  }

}
