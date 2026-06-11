import { mount } from "@odoo/owl";
import { TodoList } from "./todo_list/todo_list";
import { StoragePlugin } from "./storage_plugin";

mount(TodoList, document.body, { templates: TEMPLATES, dev: true, plugins: [StoragePlugin] });
