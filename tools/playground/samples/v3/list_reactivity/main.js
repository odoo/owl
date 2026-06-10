import { Component, mount, signal, computed, proxy, shallowEqual, xml } from "@odoo/owl";

// Reactive list: a `proxy` array + a `computed` filter + `t-foreach` with `t-key`.
// Mutate the array (push, splice, property assignment) and the view updates.
// Try: filter via the input, toggle done, add new todos.
// The filter produces a fresh array on every recompute: `equals: shallowEqual`
// stops the propagation (and the re-render) when its contents are unchanged.

let _nextId = 1;
const getId = () => _nextId++;

class TodoList extends Component {
    static template = xml`
        <div>
          <input placeholder="filter..." t-model="this.query"/>
          <button t-on-click="this.add">+ add</button>
          <ul>
            <t t-foreach="this.visible()" t-as="todo" t-key="todo.id">
              <li>
                <input type="checkbox" t-model.proxy="todo.done"/>
                <span t-out="todo.text" t-att-style="todo.done ? 'text-decoration:line-through;color:#888' : ''"/>
              </li>
            </t>
          </ul>
          <p><t t-out="this.visible().length"/> shown / <t t-out="this.todos.length"/> total</p>
        </div>`;

    query = signal("");

    todos = proxy([
        { id: getId(), text: "buy milk", done: false },
        { id: getId(), text: "walk the dog", done: true },
        { id: getId(), text: "ship Owl 4", done: false },
    ]);

    visible = computed(() => {
        const q = this.query().toLowerCase();
        return this.todos.filter((t) => t.text.toLowerCase().includes(q));
    }, { equals: shallowEqual });

    add() {
        const id = getId();
        this.todos.push({ id, text: "new todo " + id, done: false });
    }
}

mount(TodoList, document.body, { templates: TEMPLATES, dev: true });
