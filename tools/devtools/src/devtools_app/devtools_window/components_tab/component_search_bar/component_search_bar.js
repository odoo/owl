import { ComponentsPlugin } from "../../../store/components_plugin";

const { Component, usePlugin } = owl;

export class ComponentSearchBar extends Component {
  static template = "devtools.ComponentSearchBar";

  setup() {
    this.components = usePlugin(ComponentsPlugin);
  }

  updateSearch(event) {
    this.components.updateSearch(event.target.value);
  }

  // Go to the next search result repeatedly while enter is pressed
  onSearchKeyDown(event) {
    if (event.key === "Enter") {
      this.components.getNextSearch();
    }
  }
}
