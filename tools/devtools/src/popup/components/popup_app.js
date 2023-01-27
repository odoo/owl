
const { Component, useState, onWillStart, onMounted, useEffect } = owl;
import { getOwlStatus } from "../../utils.js";

export class PopUpApp extends Component {
  setup(){
    this.state = useState({status: 0});
    onMounted(async () => {
      let status = await getOwlStatus();
      this.state.status = status;
    });
  }
  
  static template = "popup.popup_app";
}


