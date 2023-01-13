
const { Component, markup, useState, onMounted, onWillUpdateProps } = owl


export class SearchBar extends Component {
  setup(){
    this.enterTimeout = false;
    this.enterInterval = false;
  }

  toggleSelector(){
    this.props.toggleSelector();
  }

  // On keyup
  updateSearch(event){
    if(event.keyCode === 13){
      clearTimeout(this.enterTimeout);
      this.enterTimeout = false;
      clearInterval(this.enterInterval);
      this.enterInterval = false;
    }
    else {
      let search = event.target.value;
      this.props.updateSearch(search);
    }
  }

  // On keydown
  fastNextSearch(event){
    if(event.keyCode === 13){
      if(!this.enterInterval && !this.enterTimeout){
        this.getNextSearch();
        this.enterTimeout = setTimeout(() => {
          this.enterInterval = setInterval(() => {
            this.getNextSearch();
          }, 100);
        }, 500);
      }
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
  
  static props = ['updateSearch', 'setSearchIndex', 'toggleSelector', 'search', 'searchResults', 'searchIndex'];

  static template = "devtools.SearchBar";
}



