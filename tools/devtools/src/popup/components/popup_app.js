import { Component, useState } from "@odoo/owl";

export class PopUpApp extends Component {
    setup(){
        this.state = ({
            status: "enabled",
        });
    }

    static template = "popup.popup_app";
}
