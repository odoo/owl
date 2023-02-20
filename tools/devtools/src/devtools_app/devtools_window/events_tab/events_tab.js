const { Component, onWillDestroy, onMounted } = owl;
import { evalInWindow } from "../../../utils";
import { useStore } from "../../store/store";
import { Event } from "./event/event";
import { EventNode } from "./event_node/event_node";
import { EventSearchBar } from "./event_search_bar/event_search_bar";

export class EventsTab extends Component {
  static template = "devtools.EventsTab";

  static components = { Event, EventNode, EventSearchBar };

  setup() {
    this.store = useStore();
  }

  showHelp(){
    return (this.store.events.length < 1 && !this.store.activeRecorder);
  }

  toggleRecording() {
    evalInWindow(
      "toggleEventsRecording",
      [!this.store.activeRecorder, this.store.events.length],
      this.store.activeFrame
    ).then((result) => (this.store.activeRecorder = result));
  }

  clearConsole() {
    this.store.events = [];
    this.store.eventsTree = [];
    evalInWindow("resetEvents", [], this.store.activeFrame);
  }

  toggleEventsAsTree() {
    if (!this.store.eventsTreeView) this.store.buildEventsTree();
    this.store.eventsTreeView = !this.store.eventsTreeView;
  }
}
