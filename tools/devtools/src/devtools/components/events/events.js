const { Component, useState, onMounted } = owl

export class Events extends Component { 
  setup() {
    this.state = useState({
      activeRecorder: false,
      events: []
    })

    onMounted(async () => {
      // Connect to the port to communicate to the background script
      chrome.runtime.onConnect.addListener((port) => {
        port.onMessage.addListener((msg) => {
          // When message of type Event is received, add the received event to the list
          if (msg.type === "Event"){
            if(this.state.activeRecorder)
              this.state.events = [...this.state.events, msg.data];
          }
        });
      });
    });
  }

  toggleRecording(ev){
    this.state.activeRecorder = !this.state.activeRecorder;
  }

  clearConsole(ev){
    this.state.events = [];
  }

  static template = "devtools.Events";
}
