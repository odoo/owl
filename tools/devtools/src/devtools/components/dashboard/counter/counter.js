/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class Counter extends Component {
    static template = "devtools.counter";

    setup(){
        this.state = useState({ count: 0});
    }

    increment(){
        this.state.count++;
    }
}
