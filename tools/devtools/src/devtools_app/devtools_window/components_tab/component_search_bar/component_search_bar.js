import { useStore } from "../../../store/store";

const { Component } = owl;

export class ComponentSearchBar extends Component {
  static template = "devtools.ComponentSearchBar";

  setup() {
    this.store = useStore();
  }

  updateSearch(event) {
    if (event.key !== "Enter") {
      this.store.updateSearch(event.target.value);
    }
  }

  // Go to the next search result repeatedly while enter is pressed
  onSearchKeyDown(event) {
    if (event.key === "Enter") {
      this.store.componentSearch.getNextSearch();
    }
  }
}
