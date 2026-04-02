const { Component, plugin } = owl;
import { StorePlugin } from "../../store/store";
import { Event } from "./event/event";
import { EventNode } from "./event_node/event_node";
import { EventSearchBar } from "./event_search_bar/event_search_bar";

export class ProfilerTab extends Component {
  static template = "devtools.ProfilerTab";

  static components = { Event, EventNode, EventSearchBar };

  setup() {
    this.store = plugin(StorePlugin);
  }

  showHelp() {
    return this.store.events().length < 1 && !this.store.activeRecorder();
  }

  selectDisplayMode(ev) {
    const val = ev.target.value;
    if (val === "Tree") {
      this.store.buildEventsTree();
      this.store.eventsTreeView.set(true);
    } else {
      this.store.eventsTreeView.set(false);
    }
  }
}
