import { Component, mount, signal, computed } from "@odoo/owl";

class NavBar extends Component {
    static template = "demo.NavBar";
}

class Sidebar extends Component {
    static template = "demo.Sidebar";
}

class Breadcrumbs extends Component {
    static template = "demo.Breadcrumbs";
}

class ListView extends Component {
    static template = "demo.ListView";
}

class FormView extends Component {
    static template = "demo.FormView";
}

class Root extends Component {
    static template = "demo.Root";
    static components = { NavBar, Sidebar, Breadcrumbs, ListView, FormView };

    setup() {
        this.currentApp = signal("CRM");
        this.currentView = signal("list");
        this.selectedRecord = signal(null);
        this.sidebarCollapsed = signal(false);

        this.apps = [
            { name: "CRM", icon: "📊" },
            { name: "Sales", icon: "💰" },
            { name: "Inventory", icon: "📦" },
            { name: "Contacts", icon: "👥" },
        ];

        this.records = signal([
            { id: 1, name: "Acme Corp", stage: "Qualified", value: "$12,000", date: "2025-03-01" },
            { id: 2, name: "Globex Inc", stage: "Proposition", value: "$8,500", date: "2025-03-05" },
            { id: 3, name: "Initech LLC", stage: "Won", value: "$25,000", date: "2025-02-28" },
            { id: 4, name: "Umbrella Co", stage: "New", value: "$3,200", date: "2025-03-10" },
            { id: 5, name: "Stark Industries", stage: "Qualified", value: "$45,000", date: "2025-03-12" },
        ]);

        this.breadcrumbs = computed(() => {
            const crumbs = [this.currentApp()];
            if (this.selectedRecord()) {
                crumbs.push(this.selectedRecord().name);
            }
            return crumbs;
        });
    }

    switchApp(appName) {
        this.currentApp.set(appName);
        this.currentView.set("list");
        this.selectedRecord.set(null);
    }

    openRecord(record) {
        this.selectedRecord.set(record);
        this.currentView.set("form");
    }

    goBack() {
        this.selectedRecord.set(null);
        this.currentView.set("list");
    }

    toggleSidebar() {
        this.sidebarCollapsed.set(!this.sidebarCollapsed());
    }
}

mount(Root, document.body, { templates: TEMPLATES });
