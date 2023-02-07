import { useStore } from "../../../store/store";

const { Component, markup, useState, onMounted, onWillUpdateProps } = owl


export class SearchBar extends Component {

  static template = "devtools.SearchBar";

  setup(){
    this.store = useStore();
  }

  toggleSelector(){
    this.store.toggleSelector();
  }

  // On keyup
  updateSearch(event){
    if(!(event.keyCode === 13)){
      const search = event.target.value;
      this.store.updateSearch(search);
    }
  }

  // On keydown
  fastNextSearch(event){
    if(event.keyCode === 13)
      this.getNextSearch();
  }

  clearSearch(){
    this.store.updateSearch('');
  }

  getNextSearch(){
    if(this.store.search.searchIndex > -1 && this.store.search.searchIndex < this.store.search.searchResults.length - 1){
      this.store.setSearchIndex(this.store.search.searchIndex + 1);
    }
    else if(this.store.search.searchIndex === this.store.search.searchResults.length - 1){
      this.store.setSearchIndex(0);
    }
  }

  getPrevSearch(){
    if(this.store.search.searchIndex > 0){
      this.store.setSearchIndex(this.store.search.searchIndex - 1);
    }
    else if(this.store.search.searchIndex === 0){
      this.store.setSearchIndex(this.store.search.searchResults.length - 1);
    }
  }
}



