// This example is an implementation of the TodoList application, from the
// www.todomvc.com project.  This is a non trivial application with some
// interesting user interactions. It uses the local storage for persistence.
import {
    Component,
    computed,
    effect,
    mount,
    plugin,
    Plugin,
    PluginManager,
    props,
    signal,
    useEffect,
    onWillDestroy,
} from "@odoo/owl";

const ENTER_KEY = 13;
const ESC_KEY = 27;

class TodoItem {
    #list;

    constructor(list, { id, text, isCompleted }) {
        this.#list = list;
        this.id = id;
        this.text = signal(text);
        this.isCompleted = signal(isCompleted);
    }

    delete() {
        this.#list.delete(this);
    }

    toggle() {
        this.isCompleted.update((value) => !value);
    }
}

class LocalStoragePlugin extends Plugin {
    static id = "local_storage";

    cleanups = [];

    setup() {
        onWillDestroy(() => {
            for (let cleanup of cleanups) {
                cleanup();
            }
        });
    }

    open({ key, encode, decode }) {
        const str = localStorage.getItem(key);
        const result = signal(decode(str));
        this.cleanups.push(
            effect(() => {
                const str = encode(result());
                localStorage.setItem(key, str);
            })
        );
        return result;
    }
}

class TodoListPlugin extends Plugin {
    static id = "todo_list";
    todos = signal([]);

    localStorage = plugin(LocalStoragePlugin);
    todos = this.localStorage.open({
        key: "todoapp",
        encode: (data) => {
            const json = data.map((todo) => ({
                id: todo.id,
                text: todo.text(),
                isCompleted: todo.isCompleted(),
            }));
            return JSON.stringify(json);
        },
        decode: (str) => {
            const data = JSON.parse(str || "[]");
            return data.map((todo) => new TodoItem(this, todo));
        },
    });

    generateId() {
        return Math.random().toString(36).substring(2, 10);
    }

    isEmpty = computed(() => !this.todos().length);

    add(text) {
        text = text.trim();
        if (text) {
            const data = { id: this.generateId(), text, isComplete: false };
            const todo = new TodoItem(this, data);
            this.todos().push(todo);
            this.todos.update();
        }
    }

    delete(todo) {
        const result = this.todos().filter((t) => t !== todo);
        this.todos.set(result);
    }

    toggleAll(value) {
        for (let todo of this.todos()) {
            todo.isCompleted.set(value);
        }
    }

    clearCompleted() {
        const todos = this.todos().filter((t) => t.isCompleted());
        for (let todo of todos) {
            this.delete(todo);
        }
    }
}

//------------------------------------------------------------------------------
// Todo
//------------------------------------------------------------------------------
class Todo extends Component {
    static template = "Todo";

    props = props({ todo: TodoItem });
    todo = this.props.todo;
    isEditing = signal(false);
    input = signal(null);
    text = signal(this.todo.text());

    setup() {
        useEffect(
            (el) => el && el.focus(),
            () => [this.input()]
        );
    }

    stopEditing() {
        this.isEditing.set(false);
    }

    handleKeyup(ev) {
        if (ev.keyCode === ENTER_KEY) {
            this.todo.text.set(this.text());
            this.stopEditing();
        }
        if (ev.keyCode === ESC_KEY) {
            this.text.set(this.todo.text());
            this.stopEditing();
        }
    }

    handleBlur(ev) {
        this.todo.text.set(this.text());
        this.stopEditing();
    }
}

//------------------------------------------------------------------------------
// TodoList
//------------------------------------------------------------------------------
class TodoList extends Component {
    static template = "TodoList";
    static components = { Todo };

    todoList = plugin(TodoListPlugin);
    filter = signal("all");

    visibleTodos = computed(() => {
        const todos = this.todoList.todos();
        switch (this.filter()) {
            case "active":
                return todos.filter((t) => !t.isCompleted());
            case "completed":
                return todos.filter((t) => t.isCompleted());
            case "all":
                return todos;
        }
    });

    remaining = computed(() => {
        const todos = this.todoList.todos();
        return todos.filter((todo) => !todo.isCompleted()).length;
    });

    remainingText = computed(() => {
        return ` ${this.remaining() < 2 ? "item" : "items"} left`;
    });

    allChecked = computed(() => this.remaining() === 0);

    addTodo(ev) {
        if (ev.keyCode === ENTER_KEY) {
            const text = ev.target.value;
            if (text.trim()) {
                this.todoList.add(text);
            }
            ev.target.value = "";
        }
    }
}

//------------------------------------------------------------------------------
// App Initialization
//------------------------------------------------------------------------------
const pluginManager = new PluginManager();
pluginManager.startPlugins([TodoListPlugin]);

mount(TodoList, document.body, { templates: TEMPLATES, pluginManager, dev: true });
