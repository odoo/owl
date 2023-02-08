const { Component, useState, onWillStart } = owl;
import { getOwlStatus } from "../../utils.js";

export class PopUpApp extends Component {
  static template = "popup.PopUpApp";

  setup() {
    this.state = useState({ status: 0 });
    onWillStart(async () => {
      let status = await getOwlStatus();
      this.state.status = status;
    });
  }
}
