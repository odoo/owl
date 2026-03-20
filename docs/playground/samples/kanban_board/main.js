import { Component, mount, signal, props, types as t } from "@odoo/owl";

class KanbanCard extends Component {
    static template = "tutorial.KanbanCard";
    props = props({ title: t.string, onDelete: t.function() });
}

class KanbanColumn extends Component {
    static template = "tutorial.KanbanColumn";
    static components = { KanbanCard };
    props = props({ column: t.object(), onAddCard: t.function(), onDeleteCard: t.function() });

    addCard() {
        const title = prompt("Card title:");
        if (title?.trim()) {
            this.props.onAddCard(this.props.column.id, title.trim());
        }
    }
}

class Root extends Component {
    static template = "tutorial.Root";
    static components = { KanbanColumn };

    setup() {
        this.nextId = 4;
        this.columns = signal([
            {
                id: 1, name: "To Do",
                cards: signal([
                    { id: 1, title: "Learn OWL basics" },
                    { id: 2, title: "Build a kanban board" },
                ]),
            },
            {
                id: 2, name: "In Progress",
                cards: signal([{ id: 3, title: "Read the docs" }]),
            },
            {
                id: 3, name: "Done",
                cards: signal([]),
            },
        ]);
    }

    addCard(columnId, title) {
        const col = this.columns().find((c) => c.id === columnId);
        if (col) {
            col.cards.set([...col.cards(), { id: this.nextId++, title }]);
        }
    }

    deleteCard(columnId, cardId) {
        const col = this.columns().find((c) => c.id === columnId);
        if (col) {
            col.cards.set(col.cards().filter((c) => c.id !== cardId));
        }
    }
}

mount(Root, document.body, { templates: TEMPLATES });
