/** @odoo-module **/
import { Counter } from "./counter/counter";
import { Todo } from "./todo/todo";
import { Card } from "./card/card";
import { Component, useState, useRef, onMounted, useEffect} from "@odoo/owl";

export default class Dashboard extends Component {
    setup(){
        useAutofocus("addTodoInput");
        this.todos = useState(
            [
                { id: 3, description: "buy milk", done: false},
                { id: 4, description: "buy eggs", done: true},
                { id: 5, description: "buy avocado", done: true}
            ]);
        this.nextId = 6;
    }
    addTodo(ev){
        if (ev.keyCode === 13 && ev.target.value != ""){
            this.todos.push({ id: this.nextId++, description: ev.target.value, done: false });
            ev.target.value = "";
        }
    }
    toggleTodo(id){
        const todo = this.todos.find((todo) => todo.id === id);
        if(todo){
            todo.done = !todo.done;
        }
    }
    removeTodo(id){
        const todoIndex = this.todos.findIndex((todo) => todo.id === id);
        if(todoIndex >= 0){
            this.todos.splice(todoIndex, 1);
        }
    }
}
function useAutofocus(name) {
    let ref = useRef(name);
    useEffect(
        (el) => el && el.focus(),
        () => [ref.el]
    );
}

Dashboard.components = {Counter, Todo, Card};
Dashboard.template = "devtools.dashboard";
