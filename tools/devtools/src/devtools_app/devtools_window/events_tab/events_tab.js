const { Component, onWillDestroy, onMounted } = owl;
import { evalInWindow } from "../../../utils";
import { useStore } from "../../store/store";
import { Event } from "./event/event";
import { EventSearchBar } from "./event_search_bar/event_search_bar";

export class EventsTab extends Component {
  static template = "devtools.EventsTab";

  static components = { Event, EventSearchBar };

  setup() {
    this.store = useStore();
  }

  toggleRecording() {
    evalInWindow("toggleEventsRecording", [!this.store.activeRecorder], this.store.activeFrame).then(
      (result) => (this.store.activeRecorder = result)
    );
  }

  clearConsole() {
    this.store.events = [];
    evalInWindow("resetEvents", [], this.store.activeFrame);
  }
}
