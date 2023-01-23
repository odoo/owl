
const { Component, useState, onWillStart } = owl;
import { getOwlStatus } from "../../utils.js";

export class PopUpApp extends Component {
  setup(){
    this.state = useState({status: 0});
    onWillStart(async () => {
      this.state.status = await getOwlStatus();
    });
  }
  
  static template = "popup.popup_app";
}


