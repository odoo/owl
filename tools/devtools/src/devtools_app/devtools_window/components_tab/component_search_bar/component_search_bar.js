import { useStore } from "../../../store/store";

const { Component } = owl;

export class ComponentSearchBar extends Component {
  static template = "devtools.ComponentSearchBar";

  setup() {
    this.store = useStore();
  }

  toggleSelector() {
    this.store.toggleSelector();
  }

  // On keyup
  updateSearch(event) {
    if (!(event.keyCode === 13)) {
      const search = event.target.value;
      this.store.updateSearch(search);
    }
  }

  // On keydown
  fastNextSearch(event) {
    if (event.keyCode === 13) this.getNextSearch();
  }

  clearSearch() {
    this.store.updateSearch("");
  }

  getNextSearch() {
    if (
      this.store.componentSearch.searchIndex > -1 &&
      this.store.componentSearch.searchIndex < this.store.componentSearch.searchResults.length - 1
    ) {
      this.store.setSearchIndex(this.store.componentSearch.searchIndex + 1);
    } else if (this.componentSearch.searchIndex === this.store.componentSearch.searchResults.length - 1) {
      this.store.setSearchIndex(0);
    }
  }

  getPrevSearch() {
    if (this.store.componentSearch.searchIndex > 0) {
      this.store.setSearchIndex(this.store.componentSearch.searchIndex - 1);
    } else if (this.store.componentSearch.searchIndex === 0) {
      this.store.setSearchIndex(this.store.componentSearch.searchResults.length - 1);
    }
  }
}
