const { Component, onWillDestroy, onMounted } = owl
import { Event } from "./event";

export class Events extends Component { 
  setup() {
  }

  toggleRecording(ev){
    this.props.toggleRecorder();
  }

  clearConsole(ev){
    this.props.clearEvents();
  }

  static template = "devtools.Events";

  static components = { Event };
}
