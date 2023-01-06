
const { Component, useState, onWillStart } = owl;
import { getOwlStatus } from "../../utils.js";

export class PopUpApp extends Component {
  setup(){
    this.status = useState({value: "not_found"});
    onWillStart(async () => {
      let hasOwl = await getOwlStatus();
      this.status = { value: hasOwl ? "enabled" : "not_found" }; 
    });
  }
  
  static template = "popup.popup_app";
}


