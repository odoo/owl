
const { Component, markup, useState, onMounted, onWillUpdateProps } = owl


export class SearchBar extends Component {
  setup(){

  }

  updateSearch(event){
    if(event.keyCode === 13){
      this.getNextSearch();
    }
    else {
      let search = event.target.value;
      this.props.updateSearch(search);
    }
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
  
  static props = ['updateSearch', 'setSearchIndex', 'search', 'searchResults', 'searchIndex'];

  static template = "devtools.searchbar";
}



