/** @odoo-module **/

const { Component } = owl;
const getProps = owl.props;

export class HighlightText extends Component {
  props = getProps();

  get splitText() {
    const splitResult = this.splitFuzzySearch(this.props.originalText, this.props.searchValue);
    return this.props.searchValue.length && splitResult.length > 1
      ? splitResult
      : [this.props.originalText];
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
HighlightText.highlightClass = "highlight-search";
