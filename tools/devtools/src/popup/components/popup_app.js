
import { Component, useState, onWillStart } from "@odoo/owl";
import { getOwlStatus } from "../../utils.js";

export class PopUpApp extends Component {
  setup(){
    this.status = useState({value: "not_found"});
    onWillStart(async () => {
      chrome.devtools.inspectedWindow.eval(
        'typeof owl !== "undefined";',
        (hasOwl) => {
          this.status = { value: hasOwl ? "enabled" : "not_found" }; 
        }
      )
    });
  }
  
  static template = "popup.popup_app";
}


