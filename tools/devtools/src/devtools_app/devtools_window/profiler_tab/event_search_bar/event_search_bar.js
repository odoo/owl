import { useStore } from "../../../store/store";

const { Component } = owl;

export class EventSearchBar extends Component {
  static template = "devtools.EventSearchBar";

  setup() {
    this.store = useStore();
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
