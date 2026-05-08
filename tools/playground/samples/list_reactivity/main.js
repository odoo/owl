// Reactive list: a `proxy` array + a `computed` filter + `t-foreach` with `t-key`.
// Mutate the array (push, splice, property assignment) and the view updates.
// Try: filter via the input, toggle done, add new todos.
import { Component, mount, signal, computed, proxy, xml } from "@odoo/owl";

class TodoList extends Component {
  static template = xml`
    <div style="font-family:sans-serif;max-width:320px">
      <input placeholder="filter..." t-model="this.query"/>
      <button t-on-click="this.add">+ add</button>
      <ul>
        <t t-foreach="this.visible()" t-as="todo" t-key="todo.id">
          <li>
            <input type="checkbox" t-model="todo.done"/>
            <span t-out="todo.text" t-att-style="todo.done ? 'text-decoration:line-through;color:#888' : ''"/>
          </li>
        </t>
      </ul>
      <p><t t-out="this.visible().length"/> shown / <t t-out="this.todos.length"/> total</p>
    </div>`;

  query = signal("");
  nextId = 4;

  todos = proxy([
    { id: 1, text: "buy milk", done: false },
    { id: 2, text: "walk the dog", done: true },
    { id: 3, text: "ship Owl 4", done: false },
  ]);

  visible = computed(() => {
    const q = this.query().toLowerCase();
    return this.todos.filter((t) => t.text.toLowerCase().includes(q));
  });

  add() {
    const id = this.nextId++;
    this.todos.push({ id, text: "new todo " + id, done: false });
  }
}

mount(TodoList, document.body, { templates: TEMPLATES, dev: true });
