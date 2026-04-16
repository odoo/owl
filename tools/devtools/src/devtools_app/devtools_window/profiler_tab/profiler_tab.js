const { Component, plugin } = owl;
import { ProfilerPlugin } from "../../store/profiler_plugin";
import { Event } from "./event/event";
import { EventNode } from "./event_node/event_node";
import { EventSearchBar } from "./event_search_bar/event_search_bar";

export class ProfilerTab extends Component {
  static template = "devtools.ProfilerTab";

  static components = { Event, EventNode, EventSearchBar };

  setup() {
    this.profiler = plugin(ProfilerPlugin);
  }

  showHelp() {
    return this.profiler.events().length < 1 && !this.profiler.activeRecorder();
  }

  selectDisplayMode(ev) {
    const val = ev.target.value;
    if (val === "Tree") {
      this.profiler.buildEventsTree();
      this.profiler.eventsTreeView.set(true);
    } else {
      this.profiler.eventsTreeView.set(false);
    }
  }
}
