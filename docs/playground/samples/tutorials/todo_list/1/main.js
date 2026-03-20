import { mount } from "@odoo/owl";
import { TodoList } from "./todo_list/todo_list";

mount(TodoList, document.body, { templates: TEMPLATES, dev: true });
