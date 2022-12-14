/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class Todo extends Component {
    static template = "devtools.todo";
    static props={
        todo: {type: Object, shape: {id: Number, description: String, done: Boolean}},
        toggleState: {type: Function},
        removeState: {type: Function}
    }
    checkEvent(ev){
        this.props.toggleState(this.props.todo.id);
    }
    removeEvent(ev){
        this.props.removeState(this.props.todo.id);
    }
}
