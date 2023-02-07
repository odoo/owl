
const { Component, markup, useState, onMounted, onWillUpdateProps } = owl


export class SearchBar extends Component {
  static props = ['updateSearch', 'setSearchIndex', 'toggleSelector', 'search', 'searchResults', 'searchIndex'];
  
  static template = "devtools.SearchBar";

  setup(){}

  toggleSelector(){
    this.props.toggleSelector();
  }

  // On keyup
  updateSearch(event){
    if(!(event.keyCode === 13)){
      const search = event.target.value;
      this.props.updateSearch(search);
    }
  }

  // On keydown
  fastNextSearch(event){
    if(event.keyCode === 13)
      this.getNextSearch();
  }

  clearSearch(){
    this.props.updateSearch('');
  }

  getNextSearch(){
    if(this.props.searchIndex > -1 && this.props.searchIndex < this.props.searchResults.length - 1){
      this.props.setSearchIndex(this.props.searchIndex + 1);
    }
    else if(this.props.searchIndex === this.props.searchResults.length - 1){
      this.props.setSearchIndex(0);
    }
  }

  getPrevSearch(){
    if(this.props.searchIndex > 0){
      this.props.setSearchIndex(this.props.searchIndex - 1);
    }
    else if(this.props.searchIndex === 0){
      this.props.setSearchIndex(this.props.searchResults.length - 1);
    }
  }
}



