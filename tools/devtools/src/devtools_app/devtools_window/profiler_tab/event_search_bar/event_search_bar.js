import { StorePlugin } from "../../../store/store";

const { Component, plugin } = owl;

export class EventSearchBar extends Component {
  static template = "devtools.EventSearchBar";

  setup() {
    this.store = plugin(StorePlugin);
  }

  // On keyup
  updateSearch(event) {
    if (!(event.keyCode === 13)) {
      const search = event.target.value;
      this.store.updateSearch(search);
    }
  }

  clearSearch() {
    this.store.updateSearch("");
  }
}
