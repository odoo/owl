import { Component, signal, computed, proxy, useEffect, mount, xml } from "@odoo/owl";

class ShoppingCart extends Component {
    static template = "example.ShoppingCart";

    // --- SIGNALS --- 
    query = signal("");

    // --- PROXY (replace useState and reactive from owl 2) ---
    products = proxy([
        { id: 1, name: "Phone", price: 500, qty: 1 },
        { id: 34, name: "Laptop", price: 1200, qty: 0 },
        { id: 42, name: "Headphones", price: 100, qty: 2 },
    ]);

    // --- COMPUTED ---
    filteredProducts = computed(() => {
        // note that this.query needs to be called!
        const q = this.query().toLowerCase();
        return this.products.filter(p =>
            p.name.toLowerCase().includes(q)
        );
    });

    total = computed(() => {
        // this computed value will subscribe to each price and qty
        return this.products.reduce((sum, p) => {
            return sum + p.price * p.qty;
        }, 0);
    });

    setup() {
        // an effect: it will be executed immediately, and then
        // every time the total is updated
        useEffect(() => {
            console.log("Total updated:", this.total());
        });
    }

    increase(product) {
        // p is a proxy, it can be manipulated directly
        product.qty++;
    }

    decrease(product) {
        if (product.qty > 0) {
            product.qty--;
        }
    }
}

mount(ShoppingCart, document.body, { templates: TEMPLATES, dev: true });
