/** @odoo-module **/

const { Component, onWillRender } = owl;

export class HighlightText extends Component {
  setup() {
    onWillRender(() => {
      const splitText = this.splitFuzzySearch(this.props.originalText, this.props.searchValue);
      this.splitText =
        this.props.searchValue.length && splitText.length > 1
          ? splitText
          : [this.props.originalText];
    });
  }

  // Logic to split the text to highlight it according to a fuzzy search pattern
  splitFuzzySearch(text, search) {
    if (!search || search.length === 0) {
      return [text];
    }
    let splits = [""];
    let searchIndex = 0;
    for (const letter of text) {
      if (
        !(searchIndex >= search.length) &&
        (letter === search[searchIndex] || letter === search[searchIndex].toUpperCase())
      ) {
        if (splits.length % 2) {
          splits.push(letter);
        } else {
          splits[splits.length - 1] += letter;
        }
        searchIndex++;
      } else {
        if (splits.length % 2) {
          splits[splits.length - 1] += letter;
        } else {
          splits.push(letter);
        }
      }
    }
    return splits;
  }
}
HighlightText.template = "utils.HighlightText";
HighlightText.props = {
  originalText: String,
  searchValue: String,
};
HighlightText.highlightClass = "highlight-search";
